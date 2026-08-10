using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Pim.Api.Auth;
using Pim.Api.Controllers;
using Pim.Api.Data;
using Pim.Api.IntegrationTests.Helpers;
using Pim.Api.Repository;

namespace Pim.Api.IntegrationTests;

public sealed class RequestResponseLoggingTests : IClassFixture<ApiWebApplicationFactory>, IAsyncLifetime
{
    private const string Password = "Correct-Password-123!";

    private readonly ApiWebApplicationFactory _factory;
    private readonly string _email = $"integration-test-{Guid.NewGuid():N}@example.com";

    public RequestResponseLoggingTests(ApiWebApplicationFactory factory)
    {
        _factory = factory;
    }

    public async Task InitializeAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<IRepository<User>>();
        var passwordHash = BCrypt.Net.BCrypt.HashPassword(Password);
        await users.AddAsync(new User
        {
            Email = _email,
            PasswordHash = passwordHash,
            Accounts = [new Account { Name = "Everyday", Type = Account.AccountType.Transaction }],
        });
    }

    public async Task DisposeAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<IRepository<User>>();
        await users.DeleteAsync(_email);
    }

    [Fact]
    public async Task Post_Login_LogsTheRequestAndResponseWithoutThePlaintextPassword()
    {
        var messages = new List<string>();
        var client = CreateClient(messages);

        var response = await client.PostAsJsonAsync("/login", new { email = _email, password = Password });
        var token = (await response.Content.ReadFromJsonAsync<LoginResponse>())!.Token;

        var requestLog = Assert.Single(messages, m => m.StartsWith("HTTP request:", StringComparison.Ordinal));
        Assert.Contains("POST", requestLog, StringComparison.Ordinal);
        Assert.Contains("/login", requestLog, StringComparison.Ordinal);
        Assert.Contains(_email, requestLog, StringComparison.Ordinal);
        Assert.DoesNotContain(Password, requestLog, StringComparison.Ordinal);
        Assert.Contains("\"password\":\"***\"", requestLog, StringComparison.Ordinal);

        var responseLog = Assert.Single(messages, m => m.StartsWith("HTTP response:", StringComparison.Ordinal));
        Assert.Contains("200", responseLog, StringComparison.Ordinal);
        Assert.Contains(token, responseLog, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Post_TransactionsFile_LogsTheRequestWithoutTheFileContent()
    {
        var messages = new List<string>();
        var client = AuthenticatedClient(messages);
        const string fileContents = "!Type:Bank\nD01/06/26\nMSecretMerchantName\nT-4.50\n^\n";

        using var content = new MultipartFormDataContent { { new StringContent("Everyday"), "account" } };
        var fileContent = new ByteArrayContent(Encoding.UTF8.GetBytes(fileContents));
        fileContent.Headers.ContentType = new MediaTypeHeaderValue("text/plain");
        content.Add(fileContent, "file", "transactions.qif");

        await client.PostAsync("/transactions/file", content);

        var requestLog = Assert.Single(messages, m => m.StartsWith("HTTP request:", StringComparison.Ordinal));
        Assert.Contains("/transactions/file", requestLog, StringComparison.Ordinal);
        Assert.Contains("account=Everyday", requestLog, StringComparison.Ordinal);
        Assert.Contains("transactions.qif", requestLog, StringComparison.Ordinal);
        Assert.DoesNotContain("SecretMerchantName", requestLog, StringComparison.Ordinal);
        Assert.DoesNotContain(fileContents, requestLog, StringComparison.Ordinal);
    }

    [Fact]
    public async Task Get_LogsTheVerbUrlQuerystringAndResponseStatusCode()
    {
        var messages = new List<string>();
        var client = AuthenticatedClient(messages);

        await client.GetAsync("/transactions?startDate=2026-01-01&endDate=2026-12-31");

        var requestLog = Assert.Single(messages, m => m.StartsWith("HTTP request:", StringComparison.Ordinal));
        Assert.Contains("GET", requestLog, StringComparison.Ordinal);
        Assert.Contains("/transactions", requestLog, StringComparison.Ordinal);
        Assert.Contains("startDate=2026-01-01", requestLog, StringComparison.Ordinal);

        var responseLog = Assert.Single(messages, m => m.StartsWith("HTTP response:", StringComparison.Ordinal));
        Assert.Contains("200", responseLog, StringComparison.Ordinal);
    }

    private HttpClient CreateClient(List<string> logSink)
    {
        var factory = _factory.WithWebHostBuilder(builder =>
            builder.ConfigureLogging(logging => logging.AddProvider(new CapturingLoggerProvider(logSink))));
        return factory.CreateClient();
    }

    private HttpClient AuthenticatedClient(List<string> logSink)
    {
        var client = CreateClient(logSink);
        var tokenGenerator = _factory.Services.GetRequiredService<IJwtTokenGenerator>();
        var token = tokenGenerator.GenerateToken(_email);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }
}
