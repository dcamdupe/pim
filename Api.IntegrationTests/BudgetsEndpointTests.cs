using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using Pim.Api.Auth;
using Pim.Api.Data;
using Pim.Api.Repository;

namespace Pim.Api.IntegrationTests;

public sealed class BudgetsEndpointTests : IClassFixture<ApiWebApplicationFactory>, IAsyncLifetime
{
    private readonly ApiWebApplicationFactory _factory;
    private readonly string _email = $"integration-test-{Guid.NewGuid():N}@example.com";

    public BudgetsEndpointTests(ApiWebApplicationFactory factory)
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
            Categories =
            [
                new Category { Name = "Groceries", Colour = "#00ff00", Type = Category.CategoryType.Expense },
                new Category { Name = "Dining", Colour = "#ff0000", Type = Category.CategoryType.Expense },
                new Category { Name = "Salary", Colour = "#0000ff", Type = Category.CategoryType.Income },
            ],
        });
    }

    public async Task DisposeAsync()
    {
        using var scope = _factory.Services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<IRepository<User>>().DeleteAsync(_email);
    }

    [Fact]
    public async Task Get_ReturnsEmpty_WhenNoBudgetsSet()
    {
        var response = await AuthenticatedClient().GetAsync("/budgets");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Empty((await response.Content.ReadFromJsonAsync<List<Budget>>())!);
    }

    [Fact]
    public async Task Put_ThenGet_RoundTripsTheBudgets()
    {
        var client = AuthenticatedClient();

        var put = await client.PutAsJsonAsync("/budgets", new[]
        {
            new { category = "Groceries", amount = 800.50m },
            new { category = "Dining", amount = 200m },
        });
        var budgets = await client.GetFromJsonAsync<List<Budget>>("/budgets");

        Assert.Equal(HttpStatusCode.NoContent, put.StatusCode);
        Assert.Equal(2, budgets!.Count);
        Assert.Contains(budgets, b => b.Category == "Groceries" && b.Amount == 800.50m);
        Assert.Contains(budgets, b => b.Category == "Dining" && b.Amount == 200m);
    }

    [Fact]
    public async Task Put_ReplacesTheWholeList()
    {
        var client = AuthenticatedClient();
        await client.PutAsJsonAsync("/budgets", new[] { new { category = "Groceries", amount = 800m } });

        await client.PutAsJsonAsync("/budgets", new[] { new { category = "Dining", amount = 150m } });
        var budgets = await client.GetFromJsonAsync<List<Budget>>("/budgets");

        var budget = Assert.Single(budgets!);
        Assert.Equal("Dining", budget.Category);
    }

    [Fact]
    public async Task Put_StoresTheCategorysCanonicalName()
    {
        var client = AuthenticatedClient();

        await client.PutAsJsonAsync("/budgets", new[] { new { category = "groceries", amount = 10m } });
        var budgets = await client.GetFromJsonAsync<List<Budget>>("/budgets");

        Assert.Equal("Groceries", Assert.Single(budgets!).Category);
    }

    [Theory]
    [InlineData("Unknown", 10)]
    [InlineData("Salary", 10)]
    [InlineData("Groceries", 0)]
    [InlineData("Groceries", -5)]
    [InlineData("Groceries", 10.555)]
    public async Task Put_ReturnsBadRequest_ForInvalidBudgets(string category, decimal amount)
    {
        var response = await AuthenticatedClient().PutAsJsonAsync("/budgets", new[] { new { category, amount } });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Put_ReturnsBadRequest_ForDuplicateCategories()
    {
        var response = await AuthenticatedClient().PutAsJsonAsync("/budgets", new[]
        {
            new { category = "Groceries", amount = 10m },
            new { category = "GROCERIES", amount = 20m },
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task DeleteCategory_AlsoRemovesItsBudget()
    {
        var client = AuthenticatedClient();
        await client.PutAsJsonAsync("/budgets", new[]
        {
            new { category = "Groceries", amount = 800m },
            new { category = "Dining", amount = 200m },
        });

        using var delete = new HttpRequestMessage(HttpMethod.Delete, "/settings/category")
        {
            Content = JsonContent.Create(new { name = "Dining", colour = "#ff0000", type = "Expense" }),
        };
        var deleteResponse = await client.SendAsync(delete);
        var budgets = await client.GetFromJsonAsync<List<Budget>>("/budgets");

        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);
        Assert.Equal("Groceries", Assert.Single(budgets!).Category);
    }

    private HttpClient AuthenticatedClient()
    {
        var client = _factory.CreateClient();
        var token = _factory.Services.GetRequiredService<IJwtTokenGenerator>().GenerateToken(_email);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }
}
