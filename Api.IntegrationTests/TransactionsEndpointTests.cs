using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.DependencyInjection;
using Pim.Api.Auth;
using Pim.Api.Controllers;
using Pim.Api.Data;
using Pim.Api.Repository;

namespace Pim.Api.IntegrationTests;

public sealed class TransactionsEndpointTests : IClassFixture<ApiWebApplicationFactory>, IAsyncLifetime
{
    // ReadFromJsonAsync<T>() with no explicit options defaults to JsonSerializerDefaults.Web
    // (case-insensitive, camelCase) - matching that here since we also need
    // JsonStringEnumConverter to read the string Transaction.Type the Api writes (Program.cs),
    // same as SettingsEndpointTests.cs's Account.AccountType.
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
    };

    private const string ValidQif =
        "!Type:Bank\n" +
        "D01/06/26\n" +
        "MCoffee Shop\n" +
        "T-4.50\n" +
        "^\n" +
        "D15/06/26\n" +
        "MSalary\n" +
        "T2500.00\n" +
        "^\n";

    private readonly ApiWebApplicationFactory _factory;
    private readonly string _email = $"integration-test-{Guid.NewGuid():N}@example.com";
    private readonly List<string> _seededMonthIds = [];
    private readonly List<string> _seededApiKeys = [];

    public TransactionsEndpointTests(ApiWebApplicationFactory factory)
    {
        _factory = factory;
    }

    public async Task InitializeAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<IRepository<User>>();
        await users.AddAsync(new User
        {
            Email = _email,
            PasswordHash = "unused-in-these-tests",
            Accounts =
            [
                new Account { Name = "Everyday", Type = Account.AccountType.Transaction },
                new Account { Name = "Savings", Type = Account.AccountType.Savings },
            ],
        });
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

        var apiKeys = scope.ServiceProvider.GetRequiredService<IRepository<ApiKey>>();
        foreach (var key in _seededApiKeys)
        {
            await apiKeys.DeleteAsync(key);
        }
    }

    [Fact]
    public async Task Post_SavesParsedTransactions_WithEmptyCategory()
    {
        var client = AuthenticatedClient();
        using var content = BuildMultipartContent("Everyday", ValidQif);

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

        using (var firstUpload = BuildMultipartContent("Everyday", ValidQif))
        {
            var firstResponse = await client.PostAsync("/transactions/file", firstUpload);
            Assert.Equal(HttpStatusCode.NoContent, firstResponse.StatusCode);
        }

        using (var secondUpload = BuildMultipartContent("Everyday", ValidQif))
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
    public async Task Post_ReturnsBadRequest_WhenFileCannotBeParsed()
    {
        var client = AuthenticatedClient();
        using var content = BuildMultipartContent("Everyday", "!Type:Bank\nDnot-a-date\nMCoffee\nT-4.50\n^\n");

        var response = await client.PostAsync("/transactions/file", content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Post_ReturnsBadRequest_WhenTheAccountDoesNotExist()
    {
        var client = AuthenticatedClient();
        using var content = BuildMultipartContent("NoSuchAccount", ValidQif);

        var response = await client.PostAsync("/transactions/file", content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Post_ReturnsBadRequest_ForAnUnrecognisedFileExtension()
    {
        var client = AuthenticatedClient();
        using var content = BuildMultipartContent("Everyday", ValidQif, "transactions.pdf");

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
        using (var upload = BuildMultipartContent("Everyday", ValidQif))
        {
            var uploadResponse = await client.PostAsync("/transactions/file", upload);
            Assert.Equal(HttpStatusCode.NoContent, uploadResponse.StatusCode);
        }
        _seededMonthIds.Add(TransactionMonth.BuildId(_email, 2026, 6));

        // ValidQif's earliest row is 01 JUN 2026 - startDate is omitted, so this only succeeds if
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
        using var content = BuildMultipartContent("Everyday", ValidQif);

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

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<TransactionsResponse>(JsonOptions);
        Assert.Equal("Dining", body!.Transactions.Single().Category);
        var month = await repository.GetAsync(monthId);
        Assert.Equal("Dining", month!.Transactions.Single().Category);
    }

    [Fact]
    public async Task Put_UpdatesIgnore_OnTheMatchingStoredTransaction_AndItRoundTripsThroughGet()
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

        var setIgnore = new Transaction { Account = "Everyday", Date = new DateOnly(2026, 6, 10), Description = "Coffee Shop", Category = "", Amount = -4.50m, Ignore = true };
        var setIgnoreResponse = await client.PutAsJsonAsync("/transactions", new List<Transaction> { setIgnore });
        Assert.Equal(HttpStatusCode.OK, setIgnoreResponse.StatusCode);

        var getResponse = await client.GetAsync("/transactions?startDate=2026-06-01&endDate=2026-06-30");
        var body = await getResponse.Content.ReadFromJsonAsync<TransactionsResponse>(JsonOptions);
        Assert.True(body!.Transactions.Single().Ignore);

        var setActive = new Transaction { Account = "Everyday", Date = new DateOnly(2026, 6, 10), Description = "Coffee Shop", Category = "", Amount = -4.50m, Ignore = false };
        var setActiveResponse = await client.PutAsJsonAsync("/transactions", new List<Transaction> { setActive });
        Assert.Equal(HttpStatusCode.OK, setActiveResponse.StatusCode);

        var month = await repository.GetAsync(monthId);
        Assert.False(month!.Transactions.Single().Ignore);
    }

    [Fact]
    public async Task Put_StampsTypeAndIgnore_FromTheCategoryDefinition_WhenCategoryChanges()
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

        var addCategoryResponse = await client.PostAsJsonAsync(
            "/settings/category",
            new Category { Name = "Dining", Colour = "#eda100", Type = Category.CategoryType.Ignore });
        Assert.Equal(HttpStatusCode.NoContent, addCategoryResponse.StatusCode);

        var updated = new Transaction { Account = "Everyday", Date = new DateOnly(2026, 6, 10), Description = "Coffee Shop", Category = "Dining", Amount = -4.50m };
        var response = await client.PutAsJsonAsync("/transactions", new List<Transaction> { updated });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        // The response body is what the FrontEnd store relies on to pick up the server-stamped
        // Type/Ignore without a follow-up GET - assert on it directly, not just the stored record.
        var body = await response.Content.ReadFromJsonAsync<TransactionsResponse>(JsonOptions);
        var responseTransaction = body!.Transactions.Single();
        Assert.Equal(Category.CategoryType.Ignore, responseTransaction.Type);
        Assert.True(responseTransaction.Ignore);

        var month = await repository.GetAsync(monthId);
        var transaction = month!.Transactions.Single();
        Assert.Equal(Category.CategoryType.Ignore, transaction.Type);
        Assert.True(transaction.Ignore);
    }

    [Fact]
    public async Task Put_DoesNotReapplyTheCategoryStamp_WhenOnlyIgnoreChangesAndTheCategoryStaysTheSame()
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

        await client.PostAsJsonAsync(
            "/settings/category",
            new Category { Name = "Dining", Colour = "#eda100", Type = Category.CategoryType.Expense });

        var categorised = new Transaction { Account = "Everyday", Date = new DateOnly(2026, 6, 10), Description = "Coffee Shop", Category = "Dining", Amount = -4.50m };
        await client.PutAsJsonAsync("/transactions", new List<Transaction> { categorised });

        // Manual "Ignore" toggle - same category, only Ignore flipped. Should stick rather
        // than being immediately overwritten back to the category's own Ignore=false. The real
        // client always spreads the full transaction object (including the server-derived Type) back
        // on every PUT, so this mirrors that rather than a partial payload.
        var manuallyIgnore = new Transaction { Account = "Everyday", Date = new DateOnly(2026, 6, 10), Description = "Coffee Shop", Category = "Dining", Amount = -4.50m, Type = Category.CategoryType.Expense, Ignore = true };
        var response = await client.PutAsJsonAsync("/transactions", new List<Transaction> { manuallyIgnore });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var month = await repository.GetAsync(monthId);
        var transaction = month!.Transactions.Single();
        Assert.True(transaction.Ignore);
        Assert.Equal(Category.CategoryType.Expense, transaction.Type);
    }

    [Fact]
    public async Task Post_FlagsBothTransactions_AsInternalTransfer_WhenAnInvertedAmountArrivesInAnotherAccountWithinFiveDays_AcrossSeparateUploads()
    {
        var client = AuthenticatedClient();
        const string everydayQif =
            "!Type:Bank\n" +
            "D01/06/26\n" +
            "MTransfer to Savings\n" +
            "T-100.00\n" +
            "^\n";
        const string savingsQif =
            "!Type:Bank\n" +
            "D03/06/26\n" +
            "MTransfer from Everyday\n" +
            "T100.00\n" +
            "^\n";

        using (var everydayUpload = BuildMultipartContent("Everyday", everydayQif))
        {
            var everydayResponse = await client.PostAsync("/transactions/file", everydayUpload);
            Assert.Equal(HttpStatusCode.NoContent, everydayResponse.StatusCode);
        }
        using (var savingsUpload = BuildMultipartContent("Savings", savingsQif))
        {
            var savingsResponse = await client.PostAsync("/transactions/file", savingsUpload);
            Assert.Equal(HttpStatusCode.NoContent, savingsResponse.StatusCode);
        }
        _seededMonthIds.Add(TransactionMonth.BuildId(_email, 2026, 6));

        var response = await client.GetAsync("/transactions?startDate=2026-06-01&endDate=2026-06-30");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<TransactionsResponse>(JsonOptions);
        Assert.Equal(2, body!.Transactions.Count);
        Assert.All(body.Transactions, t => Assert.Equal("Internal Transfer", t.Category));
    }

    [Fact]
    public async Task Put_ReturnsBadRequest_WhenListIsEmpty()
    {
        var client = AuthenticatedClient();

        var response = await client.PutAsJsonAsync("/transactions", new List<Transaction>());

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Post_File_SucceedsWithAValidApiKey_AndNoBearerToken()
    {
        var apiKey = await SeedApiKey();
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add(ApiKeyAuthenticationHandler.HeaderName, apiKey);
        using var content = BuildMultipartContent("Everyday", ValidQif);

        var response = await client.PostAsync("/transactions/file", content);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        _seededMonthIds.Add(TransactionMonth.BuildId(_email, 2026, 6));
    }

    [Fact]
    public async Task Post_File_IsRejected_WithAnUnknownApiKey()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add(ApiKeyAuthenticationHandler.HeaderName, "not-a-real-key");
        using var content = BuildMultipartContent("Everyday", ValidQif);

        var response = await client.PostAsync("/transactions/file", content);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    private async Task<string> SeedApiKey()
    {
        var key = ApiKeyGenerator.Generate();
        using var scope = _factory.Services.CreateScope();
        var apiKeys = scope.ServiceProvider.GetRequiredService<IRepository<ApiKey>>();
        await apiKeys.AddAsync(new ApiKey { Key = key, Email = _email });
        _seededApiKeys.Add(key);
        return key;
    }

    private static MultipartFormDataContent BuildMultipartContent(string account, string fileText, string fileName = "transactions.qif")
    {
        var content = new MultipartFormDataContent
        {
            { new StringContent(account), "account" },
        };
        var fileContent = new ByteArrayContent(Encoding.UTF8.GetBytes(fileText));
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("text/plain");
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
