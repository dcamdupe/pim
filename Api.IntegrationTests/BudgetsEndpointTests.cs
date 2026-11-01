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
    private readonly List<string> _seededMonthIds = [];

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
            MinTransactionDate = new DateOnly(2020, 1, 1),
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
        var months = scope.ServiceProvider.GetRequiredService<IRepository<TransactionMonth>>();
        foreach (var id in _seededMonthIds)
        {
            await months.DeleteAsync(id);
        }

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

    [Fact]
    public async Task GetRecommendations_AveragesTheSixFullMonthsBeforeTheGivenMonth()
    {
        await SeedMonth(2026, 5, ("Groceries", -600m), ("Dining", -61m));
        await SeedMonth(2026, 10, ("Groceries", -600m), ("Salary", 5000m));
        // The current month and anything before the window are excluded.
        await SeedMonth(2026, 11, ("Groceries", -9999m));
        await SeedMonth(2026, 4, ("Groceries", -9999m));

        var response = await AuthenticatedClient().GetAsync("/budgets/recommendations?month=2026-11");
        var recommendations = await response.Content.ReadFromJsonAsync<List<Budget>>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(2, recommendations!.Count);
        Assert.Contains(recommendations, b => b.Category == "Groceries" && b.Amount == 200m);
        Assert.Contains(recommendations, b => b.Category == "Dining" && b.Amount == 11m);
    }

    [Fact]
    public async Task GetRecommendations_ReturnsEmpty_WithNoSpend()
    {
        var recommendations = await AuthenticatedClient().GetFromJsonAsync<List<Budget>>("/budgets/recommendations?month=2026-11");

        Assert.Empty(recommendations!);
    }

    [Theory]
    [InlineData("/budgets/recommendations")]
    [InlineData("/budgets/recommendations?month=2026-13")]
    [InlineData("/budgets/recommendations?month=Nov")]
    public async Task GetRecommendations_ReturnsBadRequest_ForAMissingOrInvalidMonth(string url)
    {
        var response = await AuthenticatedClient().GetAsync(url);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private async Task SeedMonth(int year, int month, params (string Category, decimal Amount)[] transactions)
    {
        using var scope = _factory.Services.CreateScope();
        var bucket = new TransactionMonth
        {
            Email = _email,
            Year = year,
            Month = month,
            Transactions = transactions
                .Select((t, i) => new Transaction
                {
                    Account = "Everyday",
                    Date = new DateOnly(year, month, 10),
                    Description = $"Seeded {i}",
                    Category = t.Category,
                    Amount = t.Amount,
                })
                .ToList(),
        };
        await scope.ServiceProvider.GetRequiredService<IRepository<TransactionMonth>>().AddAsync(bucket);
        _seededMonthIds.Add(bucket.Id);
    }

    private HttpClient AuthenticatedClient()
    {
        var client = _factory.CreateClient();
        var token = _factory.Services.GetRequiredService<IJwtTokenGenerator>().GenerateToken(_email);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }
}
