using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using MongoDB.Driver;
using Pim.Api.Controllers;
using Pim.Api.Data;

namespace Pim.Api.IntegrationTests;

public sealed class LoginEndpointTests : IClassFixture<ApiWebApplicationFactory>, IAsyncLifetime
{
    private const string Password = "Correct-Password-123!";

    private readonly ApiWebApplicationFactory _factory;
    private readonly string _email = $"integration-test-{Guid.NewGuid():N}@example.com";
    private IMongoCollection<User> _users = null!;

    public LoginEndpointTests(ApiWebApplicationFactory factory)
    {
        _factory = factory;
    }

    public Task InitializeAsync()
    {
        _users = _factory.Services.GetRequiredService<IMongoDatabase>().GetCollection<User>("User");
        var passwordHash = BCrypt.Net.BCrypt.HashPassword(Password);
        return _users.InsertOneAsync(new User { Email = _email, PasswordHash = passwordHash });
    }

    public Task DisposeAsync() =>
        _users.DeleteOneAsync(Builders<User>.Filter.Eq("_id", _email));

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
