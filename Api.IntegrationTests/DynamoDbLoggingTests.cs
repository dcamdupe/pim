using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Pim.Api.Auth;
using Pim.Api.Controllers;
using Pim.Api.Data;
using Pim.Api.IntegrationTests.Helpers;
using Pim.Api.Repository;

namespace Pim.Api.IntegrationTests;

public sealed partial class DynamoDbLoggingTests : IClassFixture<ApiWebApplicationFactory>, IAsyncLifetime
{
    [GeneratedRegex(@"elapsedMs=\d+")]
    private static partial Regex ElapsedMsPattern();

    private readonly ApiWebApplicationFactory _factory;
    private readonly string _email = $"integration-test-{Guid.NewGuid():N}@example.com";

    public DynamoDbLoggingTests(ApiWebApplicationFactory factory)
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
        var users = scope.ServiceProvider.GetRequiredService<IRepository<User>>();
        await users.DeleteAsync(_email);
    }

    [Fact]
    public async Task GetAsync_LogsElapsedTime_OnTheResponseLine()
    {
        var messages = new List<string>();
        var client = AuthenticatedClient(messages);

        await client.GetAsync("/settings");

        var responseLog = Assert.Single(messages, m => m.StartsWith("DynamoDB GetAsync response:", StringComparison.Ordinal));
        Assert.Matches(ElapsedMsPattern(), responseLog);
    }

    [Fact]
    public async Task PutAsync_LogsElapsedTime_OnTheResponseLine()
    {
        var messages = new List<string>();
        var client = AuthenticatedClient(messages);

        await client.PutAsJsonAsync("/settings", new SettingsRequest([]));

        var responseLog = Assert.Single(messages, m => m.StartsWith("DynamoDB UpdateAsync response:", StringComparison.Ordinal));
        Assert.Matches(ElapsedMsPattern(), responseLog);
    }

    [Fact]
    public async Task DeleteAsync_LogsElapsedTime_OnTheResponseLine()
    {
        // No Api endpoint triggers a full item delete - account/category "deletion" mutates the
        // User record instead (see worklog Current state) - the repository is called directly via
        // DI here, same as other integration tests' own DisposeAsync cleanup already does.
        var messages = new List<string>();
        var factory = _factory.WithWebHostBuilder(builder =>
            builder.ConfigureLogging(logging => logging.AddProvider(new CapturingLoggerProvider(messages))));
        using var scope = factory.Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<IRepository<User>>();
        var throwawayEmail = $"integration-test-{Guid.NewGuid():N}@example.com";
        await users.AddAsync(new User { Email = throwawayEmail, PasswordHash = "unused-in-these-tests" });

        await users.DeleteAsync(throwawayEmail);

        var responseLog = Assert.Single(messages, m => m.StartsWith("DynamoDB DeleteAsync response:", StringComparison.Ordinal));
        Assert.Matches(ElapsedMsPattern(), responseLog);
    }

    private HttpClient AuthenticatedClient(List<string> logSink)
    {
        var factory = _factory.WithWebHostBuilder(builder =>
            builder.ConfigureLogging(logging => logging.AddProvider(new CapturingLoggerProvider(logSink))));
        var client = factory.CreateClient();
        var tokenGenerator = _factory.Services.GetRequiredService<IJwtTokenGenerator>();
        var token = tokenGenerator.GenerateToken(_email);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }
}
