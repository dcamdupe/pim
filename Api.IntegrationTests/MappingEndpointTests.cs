using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using Microsoft.Extensions.DependencyInjection;
using Pim.Api.Auth;
using Pim.Api.Controllers;
using Pim.Api.Data;
using Pim.Api.Repository;

namespace Pim.Api.IntegrationTests;

public sealed class MappingEndpointTests : IClassFixture<ApiWebApplicationFactory>, IAsyncLifetime
{
    private readonly ApiWebApplicationFactory _factory;
    private readonly string _email = $"integration-test-{Guid.NewGuid():N}@example.com";
    private readonly List<string> _seededMonthIds = [];

    public MappingEndpointTests(ApiWebApplicationFactory factory)
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

        var creditDescriptionMappings = scope.ServiceProvider.GetRequiredService<IRepository<CreditDescriptionMapping>>();
        await creditDescriptionMappings.DeleteAsync(_email);
    }

    [Fact]
    public async Task Post_CreditDescriptionMapping_UpdatesAllMatchingExistingTransactions()
    {
        var client = AuthenticatedClient();
        using (var upload = BuildMultipartContent(
            "Everyday",
            "131150S1,,,,,\n" +
            "01 JUN 2026,,\"COLES 0717 TURRAMURRA AUS\",,-20.00,637.57\n" +
            "02 JUN 2026,,\"COLES 0760 ASQUITH AUS\",,-15.00,617.57\n" +
            "03 JUN 2026,,\"Salary\",,2500.00,3117.57\n"))
        {
            var uploadResponse = await client.PostAsync("/transactions/file", upload);
            Assert.Equal(HttpStatusCode.NoContent, uploadResponse.StatusCode);
        }
        var monthId = TransactionMonth.BuildId(_email, 2026, 6);
        _seededMonthIds.Add(monthId);

        var mappingResponse = await client.PostAsJsonAsync(
            "/mapping/credit",
            new CreditDescriptionMappingRequest("COLES", "Groceries"));

        Assert.Equal(HttpStatusCode.NoContent, mappingResponse.StatusCode);
        using var scope = _factory.Services.CreateScope();
        var repository = scope.ServiceProvider.GetRequiredService<IRepository<TransactionMonth>>();
        var month = await repository.GetAsync(monthId);
        Assert.Equal("Groceries", month!.Transactions.Single(t => t.Description == "COLES 0717 TURRAMURRA AUS").Category);
        Assert.Equal("Groceries", month.Transactions.Single(t => t.Description == "COLES 0760 ASQUITH AUS").Category);
        Assert.Equal("", month.Transactions.Single(t => t.Description == "Salary").Category);
    }

    [Fact]
    public async Task Post_CreditDescriptionMapping_IsAppliedAutomatically_ToATransactionUploadedAfterwards()
    {
        var client = AuthenticatedClient();
        var mappingResponse = await client.PostAsJsonAsync(
            "/mapping/credit",
            new CreditDescriptionMappingRequest("COLES", "Groceries"));
        Assert.Equal(HttpStatusCode.NoContent, mappingResponse.StatusCode);

        using var content = BuildMultipartContent(
            "Everyday",
            "131150S1,,,,,\n" +
            "01 JUN 2026,,\"COLES 0717 TURRAMURRA AUS\",,-20.00,637.57\n");
        var response = await client.PostAsync("/transactions/file", content);
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var monthId = TransactionMonth.BuildId(_email, 2026, 6);
        _seededMonthIds.Add(monthId);

        using var scope = _factory.Services.CreateScope();
        var repository = scope.ServiceProvider.GetRequiredService<IRepository<TransactionMonth>>();
        var month = await repository.GetAsync(monthId);
        Assert.Equal("Groceries", month!.Transactions.Single().Category);
    }

    [Theory]
    [InlineData(" ", "Groceries")]
    [InlineData("COLES", " ")]
    public async Task Post_CreditDescriptionMapping_ReturnsBadRequest_WhenFieldsAreBlank(string descriptionStart, string category)
    {
        var client = AuthenticatedClient();

        var response = await client.PostAsJsonAsync(
            "/mapping/credit",
            new CreditDescriptionMappingRequest(descriptionStart, category));

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
