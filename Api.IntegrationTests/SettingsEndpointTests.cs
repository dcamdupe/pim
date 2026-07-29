using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.DependencyInjection;
using Pim.Api.Auth;
using Pim.Api.Controllers;
using Pim.Api.Data;
using Pim.Api.Repository;

namespace Pim.Api.IntegrationTests;

public sealed class SettingsEndpointTests : IClassFixture<ApiWebApplicationFactory>, IAsyncLifetime
{
    // ReadFromJsonAsync<T>() with no explicit options defaults to JsonSerializerDefaults.Web
    // (case-insensitive, camelCase) - matching that here since we also need
    // JsonStringEnumConverter to read the string Account.AccountType the Api writes (Program.cs).
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
    };

    private readonly ApiWebApplicationFactory _factory;
    private readonly string _email = $"integration-test-{Guid.NewGuid():N}@example.com";

    public SettingsEndpointTests(ApiWebApplicationFactory factory)
    {
        _factory = factory;
    }

    public async Task InitializeAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<IRepository<User>>();
        var user = new User
        {
            Email = _email,
            PasswordHash = "unused-in-these-tests",
            Accounts = [new Account { Name = "Everyday", Number = "123456", Type = Account.AccountType.Transaction }],
        };
        await users.AddAsync(user);
    }

    public async Task DisposeAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<IRepository<User>>();
        await users.DeleteAsync(_email);
    }

    [Fact]
    public async Task Get_ReturnsTheAuthenticatedUsersAccounts()
    {
        var client = AuthenticatedClient();

        var response = await client.GetAsync("/settings");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<SettingsResponse>(JsonOptions);
        Assert.Single(body!.Accounts);
        Assert.Equal("Everyday", body.Accounts[0].Name);
        Assert.Equal(Account.AccountType.Transaction, body.Accounts[0].Type);
    }

    [Fact]
    public async Task Put_ReplacesTheAccountsAndPersistsThem()
    {
        var client = AuthenticatedClient();
        var newAccounts = new SettingsRequest(
        [
            new Account { Name = "Everyday", Number = "123456", Type = Account.AccountType.Transaction },
            new Account { Name = "Rainy day", Number = "789012", Type = Account.AccountType.Savings },
        ]);

        var putResponse = await client.PutAsJsonAsync("/settings", newAccounts);
        Assert.Equal(HttpStatusCode.NoContent, putResponse.StatusCode);

        var getResponse = await client.GetAsync("/settings");
        var body = await getResponse.Content.ReadFromJsonAsync<SettingsResponse>(JsonOptions);
        Assert.Equal(2, body!.Accounts.Count);
        Assert.Contains(body.Accounts, a => a.Name == "Rainy day" && a.Type == Account.AccountType.Savings);
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
