using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Pim.Api.Auth;
using Pim.Api.Controllers;
using Pim.Api.Data;
using Pim.Api.Repository;

namespace Pim.Api.IntegrationTests;

public sealed class TransactionsEndpointTests : IClassFixture<ApiWebApplicationFactory>, IAsyncLifetime
{
    // ReadFromJsonAsync<T>() with no explicit options defaults to JsonSerializerDefaults.Web
    // (case-insensitive, camelCase) - matching that here since the Api writes camelCase
    // (Program.cs's controller JSON options).
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    // Matches a real TM Bank export: Date, <blank>, Description, <blank>, Amount, running
    // Balance - 6 columns, not the 5 originally assumed. Balance (last column) is never read.
    private const string ValidCsv =
        "131150S1,,,,,\n" +
        "01 JUN 2026,,\"Coffee Shop\",,-4.50,637.57\n" +
        "15 JUN 2026,,\"Salary\",,2500.00,3137.57\n";

    private readonly ApiWebApplicationFactory _factory;
    private readonly string _email = $"integration-test-{Guid.NewGuid():N}@example.com";
    private readonly List<string> _seededMonthIds = [];

    public TransactionsEndpointTests(ApiWebApplicationFactory factory)
    {
        _factory = factory;
    }

    public async Task InitializeAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<IRepository<User>>();
        await users.AddAsync(new User { Email = _email, PasswordHash = "unused-in-these-tests" });
    }

    public async Task DisposeAsync()
    {
        using var scope = _factory.Services.CreateScope();

        var transactionMonths = scope.ServiceProvider.GetRequiredService<IRepository<TransactionMonth>>();
        foreach (var id in _seededMonthIds)
        {
            await transactionMonths.DeleteAsync(id);
        }

        var users = scope.ServiceProvider.GetRequiredService<IRepository<User>>();
        await users.DeleteAsync(_email);

        var transactionDescriptions = scope.ServiceProvider.GetRequiredService<IRepository<TransactionDescriptions>>();
        await transactionDescriptions.DeleteAsync(_email);
    }

    [Fact]
    public async Task Post_SavesParsedTransactions_WithEmptyCategory()
    {
        var client = AuthenticatedClient();
        using var content = BuildMultipartContent("Everyday", ValidCsv);

        var response = await client.PostAsync("/transactions/file", content);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        var monthId = TransactionMonth.BuildId(_email, 2026, 6);
        _seededMonthIds.Add(monthId);
        using var scope = _factory.Services.CreateScope();
        var repository = scope.ServiceProvider.GetRequiredService<IRepository<TransactionMonth>>();
        var month = await repository.GetAsync(monthId);

        Assert.NotNull(month);
        Assert.Equal(2, month.Transactions.Count);
        Assert.Contains(month.Transactions, t => t.Description == "Coffee Shop" && t.Amount == -4.50m && t.Category == "" && t.Account == "Everyday");
        Assert.Contains(month.Transactions, t => t.Description == "Salary" && t.Amount == 2500.00m);
    }

    [Fact]
    public async Task Post_SkipsDuplicates_WhenTheSameFileIsUploadedTwice()
    {
        var client = AuthenticatedClient();

        using (var firstUpload = BuildMultipartContent("Everyday", ValidCsv))
        {
            var firstResponse = await client.PostAsync("/transactions/file", firstUpload);
            Assert.Equal(HttpStatusCode.NoContent, firstResponse.StatusCode);
        }

        using (var secondUpload = BuildMultipartContent("Everyday", ValidCsv))
        {
            var secondResponse = await client.PostAsync("/transactions/file", secondUpload);
            Assert.Equal(HttpStatusCode.NoContent, secondResponse.StatusCode);
        }

        var monthId = TransactionMonth.BuildId(_email, 2026, 6);
        _seededMonthIds.Add(monthId);
        using var scope = _factory.Services.CreateScope();
        var repository = scope.ServiceProvider.GetRequiredService<IRepository<TransactionMonth>>();
        var month = await repository.GetAsync(monthId);

        Assert.NotNull(month);
        Assert.Equal(2, month.Transactions.Count);
    }

    [Fact]
    public async Task Post_SavesParsedTransactions_ForAQifFile()
    {
        var qif =
            "!Type:Bank\n" +
            "D01/06/26\n" +
            "MCoffee Shop\n" +
            "T-4.50\n" +
            "^\n" +
            "D15/06/26\n" +
            "MSalary\n" +
            "T2500.00\n" +
            "^\n";
        var client = AuthenticatedClient();
        using var content = BuildMultipartContent("Everyday", qif, "transactions.qif");

        var response = await client.PostAsync("/transactions/file", content);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        var monthId = TransactionMonth.BuildId(_email, 2026, 6);
        _seededMonthIds.Add(monthId);
        using var scope = _factory.Services.CreateScope();
        var repository = scope.ServiceProvider.GetRequiredService<IRepository<TransactionMonth>>();
        var month = await repository.GetAsync(monthId);

        Assert.NotNull(month);
        Assert.Equal(2, month.Transactions.Count);
        Assert.Contains(month.Transactions, t => t.Description == "Coffee Shop" && t.Amount == -4.50m && t.Category == "" && t.Account == "Everyday");
        Assert.Contains(month.Transactions, t => t.Description == "Salary" && t.Amount == 2500.00m);
    }

    [Fact]
    public async Task Post_ReturnsBadRequest_WhenFileCannotBeParsed()
    {
        var client = AuthenticatedClient();
        using var content = BuildMultipartContent("Everyday", "131150S1,,,,,\nnot-a-date,,\"Coffee\",,-4.50,637.57\n");

        var response = await client.PostAsync("/transactions/file", content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Post_ReturnsBadRequest_ForAnUnrecognisedFileExtension()
    {
        var client = AuthenticatedClient();
        using var content = BuildMultipartContent("Everyday", ValidCsv, "transactions.pdf");

        var response = await client.PostAsync("/transactions/file", content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Get_ReturnsBadRequest_WhenDateParamsAreMissing()
    {
        var client = AuthenticatedClient();

        var response = await client.GetAsync("/transactions");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Get_ReturnsBadRequest_WhenStartDateIsAfterEndDate()
    {
        var client = AuthenticatedClient();

        var response = await client.GetAsync("/transactions?startDate=2026-06-30&endDate=2026-06-01");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Get_ReturnsTransactionsWithinRange_AndHandlesAMonthWithNoDataAtAll()
    {
        var client = AuthenticatedClient();
        using var scope = _factory.Services.CreateScope();
        var repository = scope.ServiceProvider.GetRequiredService<IRepository<TransactionMonth>>();

        var juneId = TransactionMonth.BuildId(_email, 2026, 6);
        _seededMonthIds.Add(juneId);
        await repository.AddAsync(new TransactionMonth
        {
            Email = _email,
            Year = 2026,
            Month = 6,
            Transactions =
            [
                new Transaction { Account = "Everyday", Date = new DateOnly(2026, 6, 10), Description = "In range", Category = "", Amount = -4.50m },
                new Transaction { Account = "Everyday", Date = new DateOnly(2026, 6, 1), Description = "Before range", Category = "", Amount = -1m },
            ],
        });

        // July intentionally has no bucket at all - proves a gap in the middle of the requested
        // range doesn't error, per the ticket's "handle not all date ranges being populated".
        var augustId = TransactionMonth.BuildId(_email, 2026, 8);
        _seededMonthIds.Add(augustId);
        await repository.AddAsync(new TransactionMonth
        {
            Email = _email,
            Year = 2026,
            Month = 8,
            Transactions = [new Transaction { Account = "Everyday", Date = new DateOnly(2026, 8, 1), Description = "August", Category = "", Amount = 100m }],
        });

        var response = await client.GetAsync("/transactions?startDate=2026-06-05&endDate=2026-08-31");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<TransactionsResponse>(JsonOptions);
        Assert.Equal(2, body!.Transactions.Count);
        Assert.Contains(body.Transactions, t => t.Description == "In range");
        Assert.Contains(body.Transactions, t => t.Description == "August");
        Assert.DoesNotContain(body.Transactions, t => t.Description == "Before range");
    }

    [Fact]
    public async Task Get_ResolvesStartDate_FromRealMinTransactionDate_AfterUpload()
    {
        var client = AuthenticatedClient();
        using (var upload = BuildMultipartContent("Everyday", ValidCsv))
        {
            var uploadResponse = await client.PostAsync("/transactions/file", upload);
            Assert.Equal(HttpStatusCode.NoContent, uploadResponse.StatusCode);
        }
        _seededMonthIds.Add(TransactionMonth.BuildId(_email, 2026, 6));

        // ValidCsv's earliest row is 01 JUN 2026 - startDate is omitted, so this only succeeds if
        // the real (not mocked) MinTransactionDate flow resolved it correctly.
        var response = await client.GetAsync("/transactions?endDate=2026-06-30");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<TransactionsResponse>(JsonOptions);
        Assert.Equal(2, body!.Transactions.Count);
        Assert.Contains(body.Transactions, t => t.Description == "Coffee Shop");
        Assert.Contains(body.Transactions, t => t.Description == "Salary");
    }

    [Fact]
    public async Task Get_ReturnsEmptyTransactions_WhenStartDateOmittedAndUserHasNeverUploaded()
    {
        var client = AuthenticatedClient();

        var response = await client.GetAsync("/transactions?endDate=2026-06-30");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<TransactionsResponse>(JsonOptions);
        Assert.Empty(body!.Transactions);
    }

    [Fact]
    public async Task Post_PopulatesTransactionDescriptions_WithNewlyParsedDescriptions()
    {
        var client = AuthenticatedClient();
        using var content = BuildMultipartContent("Everyday", ValidCsv);

        var response = await client.PostAsync("/transactions/file", content);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        _seededMonthIds.Add(TransactionMonth.BuildId(_email, 2026, 6));

        var descriptionsResponse = await client.GetAsync("/transactions/descriptions");
        Assert.Equal(HttpStatusCode.OK, descriptionsResponse.StatusCode);
        var body = await descriptionsResponse.Content.ReadFromJsonAsync<TransactionDescriptionsResponse>(JsonOptions);
        Assert.Equal(2, body!.Descriptions.Count);
        var coffee = body.Descriptions.Single(d => d.Description == "Coffee Shop");
        Assert.Equal(1, coffee.TransactionCount);
        Assert.Equal(1, coffee.UnclassifiedCount);
        var salary = body.Descriptions.Single(d => d.Description == "Salary");
        Assert.Equal(1, salary.TransactionCount);
        Assert.Equal(1, salary.UnclassifiedCount);
    }

    [Fact]
    public async Task Get_TransactionDescriptions_ReturnsEmptyList_WhenUserHasNeverUploaded()
    {
        var client = AuthenticatedClient();

        var response = await client.GetAsync("/transactions/descriptions");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<TransactionDescriptionsResponse>(JsonOptions);
        Assert.Empty(body!.Descriptions);
    }

    [Fact]
    public async Task Put_UpdatesTheCategory_OnTheMatchingStoredTransaction()
    {
        var client = AuthenticatedClient();
        var monthId = TransactionMonth.BuildId(_email, 2026, 6);
        _seededMonthIds.Add(monthId);
        using var scope = _factory.Services.CreateScope();
        var repository = scope.ServiceProvider.GetRequiredService<IRepository<TransactionMonth>>();
        await repository.AddAsync(new TransactionMonth
        {
            Email = _email,
            Year = 2026,
            Month = 6,
            Transactions = [new Transaction { Account = "Everyday", Date = new DateOnly(2026, 6, 10), Description = "Coffee Shop", Category = "", Amount = -4.50m }],
        });

        var updated = new Transaction { Account = "Everyday", Date = new DateOnly(2026, 6, 10), Description = "Coffee Shop", Category = "Dining", Amount = -4.50m };
        var response = await client.PutAsJsonAsync("/transactions", new List<Transaction> { updated });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var month = await repository.GetAsync(monthId);
        Assert.Equal("Dining", month!.Transactions.Single().Category);
    }

    [Fact]
    public async Task Put_UpdatesInactive_OnTheMatchingStoredTransaction_AndItRoundTripsThroughGet()
    {
        var client = AuthenticatedClient();
        var monthId = TransactionMonth.BuildId(_email, 2026, 6);
        _seededMonthIds.Add(monthId);
        using var scope = _factory.Services.CreateScope();
        var repository = scope.ServiceProvider.GetRequiredService<IRepository<TransactionMonth>>();
        await repository.AddAsync(new TransactionMonth
        {
            Email = _email,
            Year = 2026,
            Month = 6,
            Transactions = [new Transaction { Account = "Everyday", Date = new DateOnly(2026, 6, 10), Description = "Coffee Shop", Category = "", Amount = -4.50m }],
        });

        var setInactive = new Transaction { Account = "Everyday", Date = new DateOnly(2026, 6, 10), Description = "Coffee Shop", Category = "", Amount = -4.50m, Inactive = true };
        var setInactiveResponse = await client.PutAsJsonAsync("/transactions", new List<Transaction> { setInactive });
        Assert.Equal(HttpStatusCode.NoContent, setInactiveResponse.StatusCode);

        var getResponse = await client.GetAsync("/transactions?startDate=2026-06-01&endDate=2026-06-30");
        var body = await getResponse.Content.ReadFromJsonAsync<TransactionsResponse>(JsonOptions);
        Assert.True(body!.Transactions.Single().Inactive);

        var setActive = new Transaction { Account = "Everyday", Date = new DateOnly(2026, 6, 10), Description = "Coffee Shop", Category = "", Amount = -4.50m, Inactive = false };
        var setActiveResponse = await client.PutAsJsonAsync("/transactions", new List<Transaction> { setActive });
        Assert.Equal(HttpStatusCode.NoContent, setActiveResponse.StatusCode);

        var month = await repository.GetAsync(monthId);
        Assert.False(month!.Transactions.Single().Inactive);
    }

    [Fact]
    public async Task Put_ReturnsBadRequest_WhenListIsEmpty()
    {
        var client = AuthenticatedClient();

        var response = await client.PutAsJsonAsync("/transactions", new List<Transaction>());

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private static MultipartFormDataContent BuildMultipartContent(string account, string fileText, string fileName = "transactions.csv")
    {
        var content = new MultipartFormDataContent
        {
            { new StringContent(account), "account" },
        };
        var fileContent = new ByteArrayContent(Encoding.UTF8.GetBytes(fileText));
        fileContent.Headers.ContentType = new MediaTypeHeaderValue(fileName.EndsWith(".qif", StringComparison.OrdinalIgnoreCase) ? "text/plain" : "text/csv");
        content.Add(fileContent, "file", fileName);
        return content;
    }

    private HttpClient AuthenticatedClient()
    {
        var client = _factory.CreateClient();
        var tokenGenerator = _factory.Services.GetRequiredService<IJwtTokenGenerator>();
        var token = tokenGenerator.GenerateToken(_email);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }
}
