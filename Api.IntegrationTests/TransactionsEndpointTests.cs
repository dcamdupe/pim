using System.Net;
using System.Net.Http.Headers;
using System.Text;
using Microsoft.Extensions.DependencyInjection;
using Pim.Api.Auth;
using Pim.Api.Data;
using Pim.Api.Repository;

namespace Pim.Api.IntegrationTests;

public sealed class TransactionsEndpointTests : IClassFixture<ApiWebApplicationFactory>, IAsyncLifetime
{
    private const string ValidCsv =
        "Date,Ignore,Description,Amount,Ignore\n" +
        "01 JUN 2026,x,Coffee Shop,-4.50,x\n" +
        "15 JUN 2026,x,Salary,2500.00,x\n";

    private readonly ApiWebApplicationFactory _factory;
    private readonly string _email = $"integration-test-{Guid.NewGuid():N}@example.com";
    private readonly List<string> _seededMonthIds = [];

    public TransactionsEndpointTests(ApiWebApplicationFactory factory)
    {
        _factory = factory;
    }

    public Task InitializeAsync() => Task.CompletedTask;

    public async Task DisposeAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var repository = scope.ServiceProvider.GetRequiredService<IRepository<TransactionMonth>>();
        foreach (var id in _seededMonthIds)
        {
            await repository.DeleteAsync(id);
        }
    }

    [Fact]
    public async Task Post_ReturnsUnauthorized_WhenNoTokenIsProvided()
    {
        var client = _factory.CreateClient();
        using var content = BuildMultipartContent("Everyday", ValidCsv);

        var response = await client.PostAsync("/transactions/file", content);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
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
    public async Task Post_ReturnsBadRequest_WhenFileCannotBeParsed()
    {
        var client = AuthenticatedClient();
        using var content = BuildMultipartContent("Everyday", "Date,Ignore,Description,Amount,Ignore\nnot-a-date,x,Coffee,-4.50,x\n");

        var response = await client.PostAsync("/transactions/file", content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private static MultipartFormDataContent BuildMultipartContent(string account, string csv)
    {
        var content = new MultipartFormDataContent
        {
            { new StringContent(account), "account" },
        };
        var fileContent = new ByteArrayContent(Encoding.UTF8.GetBytes(csv));
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("text/csv");
        content.Add(fileContent, "file", "transactions.csv");
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
