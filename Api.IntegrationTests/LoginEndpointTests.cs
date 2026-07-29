using System.Net;
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
}
