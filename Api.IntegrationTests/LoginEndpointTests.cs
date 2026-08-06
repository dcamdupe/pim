using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using Pim.Api.Controllers;
using Pim.Api.Data;
using Pim.Api.Repository;

namespace Pim.Api.IntegrationTests;

public sealed class LoginEndpointTests : IClassFixture<ApiWebApplicationFactory>, IAsyncLifetime
{
    private const string Password = "Correct-Password-123!";

    private readonly ApiWebApplicationFactory _factory;
    private readonly string _email = $"integration-test-{Guid.NewGuid():N}@example.com";

    public LoginEndpointTests(ApiWebApplicationFactory factory)
    {
        _factory = factory;
    }

    public async Task InitializeAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<IRepository<User>>();
        var passwordHash = BCrypt.Net.BCrypt.HashPassword(Password);
        await users.AddAsync(new User { Email = _email, PasswordHash = passwordHash });
    }

    public async Task DisposeAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<IRepository<User>>();
        await users.DeleteAsync(_email);
    }

    [Fact]
    public async Task Post_ReturnsOkWithToken_WhenCredentialsAreValid()
    {
        var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/login", new { email = _email, password = Password });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.False(string.IsNullOrWhiteSpace(body?.Token));
    }

    [Fact]
    public async Task Post_ReturnsBadRequest_WhenPasswordIsIncorrect()
    {
        var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync("/login", new { email = _email, password = "wrong-password" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Post_ReturnsBadRequest_WhenLoginDoesNotExist()
    {
        var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/login",
            new { email = $"unknown-{Guid.NewGuid():N}@example.com", password = Password });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Refresh_ReturnsOkWithAValidToken_WhenTheCurrentTokenIsValid()
    {
        var client = _factory.CreateClient();
        var loginResponse = await client.PostAsJsonAsync("/login", new { email = _email, password = Password });
        var originalToken = (await loginResponse.Content.ReadFromJsonAsync<LoginResponse>())!.Token;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", originalToken);

        var response = await client.PostAsync("/login/refresh", content: null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var refreshedToken = (await response.Content.ReadFromJsonAsync<LoginResponse>())!.Token;
        Assert.False(string.IsNullOrWhiteSpace(refreshedToken));

        // The refreshed token itself authenticates a further protected call - the real point of a
        // refresh. Not asserting it differs from the original: two tokens minted for the same email
        // within the same second are byte-identical (same claims, same whole-second `exp`, no
        // `iat`/`jti`) - a same-second refresh in this fast test is a timing coincidence, not a real
        // behavior gap (5 minutes genuinely passes between refreshes in production, so `exp` always
        // differs there).
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", refreshedToken);
        var followUpResponse = await client.PostAsync("/login/refresh", content: null);
        Assert.Equal(HttpStatusCode.OK, followUpResponse.StatusCode);
    }

    [Fact]
    public async Task Refresh_ReturnsUnauthorized_WhenNoTokenIsProvided()
    {
        var client = _factory.CreateClient();

        var response = await client.PostAsync("/login/refresh", content: null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
