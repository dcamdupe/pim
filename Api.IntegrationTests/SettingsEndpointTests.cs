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
    private readonly List<string> _seededMonthIds = [];

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
            Accounts = [new Account { Name = "Everyday", Type = Account.AccountType.Transaction }],
            MinTransactionDate = new DateOnly(2026, 6, 10),
        };
        await users.AddAsync(user);
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
        Assert.Equal(new DateOnly(2026, 6, 10), body.MinTransactionDate);
    }

    [Fact]
    public async Task Put_ReplacesTheAccountsAndPersistsThem()
    {
        var client = AuthenticatedClient();
        var newAccounts = new SettingsRequest(
        [
            new Account { Name = "Everyday", Type = Account.AccountType.Transaction },
            new Account { Name = "Rainy day", Type = Account.AccountType.Savings },
        ]);

        var putResponse = await client.PutAsJsonAsync("/settings", newAccounts);
        Assert.Equal(HttpStatusCode.NoContent, putResponse.StatusCode);

        var getResponse = await client.GetAsync("/settings");
        var body = await getResponse.Content.ReadFromJsonAsync<SettingsResponse>(JsonOptions);
        Assert.Equal(2, body!.Accounts.Count);
        Assert.Contains(body.Accounts, a => a.Name == "Rainy day" && a.Type == Account.AccountType.Savings);
    }

    [Fact]
    public async Task Put_RejectsDuplicateAccountNames_CaseInsensitively()
    {
        var client = AuthenticatedClient();
        var request = new SettingsRequest(
        [
            new Account { Name = "Everyday", Type = Account.AccountType.Transaction },
            new Account { Name = "everyday", Type = Account.AccountType.Savings },
        ]);

        var response = await client.PutAsJsonAsync("/settings", request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Put_RejectsRemovingAnExistingAccount()
    {
        var client = AuthenticatedClient();
        // The seeded user already has "Everyday" - this omits it entirely rather than renaming it.
        var request = new SettingsRequest([new Account { Name = "Rainy day", Type = Account.AccountType.Savings }]);

        var response = await client.PutAsJsonAsync("/settings", request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var getResponse = await client.GetAsync("/settings");
        var body = await getResponse.Content.ReadFromJsonAsync<SettingsResponse>(JsonOptions);
        Assert.Single(body!.Accounts);
        Assert.Equal("Everyday", body.Accounts[0].Name);
    }

    // Name is the account's key (UBE-58) - a rename looks structurally identical to removing the old
    // name and adding a new one, which RemovesAnExistingAccount already rejects. Distinct test from
    // Put_RejectsRemovingAnExistingAccount above so the ticket's specific "name can't be edited"
    // requirement has its own direct coverage, even though today it's the same code path.
    [Fact]
    public async Task Put_RejectsRenamingAnExistingAccount()
    {
        var client = AuthenticatedClient();
        // Same Type as the seeded "Everyday" account - only the name differs, i.e. a pure rename.
        var request = new SettingsRequest([new Account { Name = "Everyday Renamed", Type = Account.AccountType.Transaction }]);

        var response = await client.PutAsJsonAsync("/settings", request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var getResponse = await client.GetAsync("/settings");
        var body = await getResponse.Content.ReadFromJsonAsync<SettingsResponse>(JsonOptions);
        Assert.Single(body!.Accounts);
        Assert.Equal("Everyday", body.Accounts[0].Name);
    }

    [Fact]
    public async Task Put_AllowsAddingAndEditingAccounts_WhenNoExistingOnesAreRemoved()
    {
        var client = AuthenticatedClient();
        var request = new SettingsRequest(
        [
            new Account { Name = "Everyday", Type = Account.AccountType.Savings }, // same name, edited type
            new Account { Name = "Rainy day", Type = Account.AccountType.Savings }, // newly added
        ]);

        var response = await client.PutAsJsonAsync("/settings", request);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task DeleteAccount_RemovesTheAccountAndOnlyItsTransactions()
    {
        var client = AuthenticatedClient();
        using var scope = _factory.Services.CreateScope();

        var users = scope.ServiceProvider.GetRequiredService<IRepository<User>>();
        var user = (await users.GetAsync(_email))!;
        user.Accounts.Add(new Account { Name = "Rainy day", Type = Account.AccountType.Savings });
        await users.UpdateAsync(_email, user);

        var monthId = TransactionMonth.BuildId(_email, 2026, 6);
        _seededMonthIds.Add(monthId);
        var transactionMonths = scope.ServiceProvider.GetRequiredService<IRepository<TransactionMonth>>();
        await transactionMonths.AddAsync(new TransactionMonth
        {
            Email = _email,
            Year = 2026,
            Month = 6,
            Transactions =
            [
                new Transaction { Account = "Everyday", Date = new DateOnly(2026, 6, 10), Description = "Coffee Shop", Category = "", Amount = -4.50m },
                new Transaction { Account = "Rainy day", Date = new DateOnly(2026, 6, 12), Description = "Interest", Category = "Income", Amount = 1.20m },
            ],
        });

        var deleteRequest = new HttpRequestMessage(HttpMethod.Delete, "/settings/account")
        {
            Content = JsonContent.Create(new DeleteAccountRequest("Rainy day")),
        };
        var response = await client.SendAsync(deleteRequest);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        var getResponse = await client.GetAsync("/settings");
        var body = await getResponse.Content.ReadFromJsonAsync<SettingsResponse>(JsonOptions);
        Assert.DoesNotContain(body!.Accounts, a => a.Name == "Rainy day");

        var month = await transactionMonths.GetAsync(monthId);
        var remaining = Assert.Single(month!.Transactions);
        Assert.Equal("Everyday", remaining.Account);
    }

    [Fact]
    public async Task DeleteAccount_ReturnsNotFound_WhenNoMatchingAccountExists()
    {
        var client = AuthenticatedClient();
        var deleteRequest = new HttpRequestMessage(HttpMethod.Delete, "/settings/account")
        {
            Content = JsonContent.Create(new DeleteAccountRequest("Does Not Exist")),
        };

        var response = await client.SendAsync(deleteRequest);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task AddCategory_AppendsTheCategory()
    {
        var client = AuthenticatedClient();
        var category = new Category { Name = "Groceries", Colour = "#00ff00", Type = Category.CategoryType.Expense };

        var response = await client.PostAsJsonAsync("/settings/category", category);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var getResponse = await client.GetAsync("/settings");
        var body = await getResponse.Content.ReadFromJsonAsync<SettingsResponse>(JsonOptions);
        Assert.Contains(body!.Categories, c => c.Name == "Groceries" && c.Colour == "#00ff00");
    }

    [Fact]
    public async Task AddCategory_RoundTripsTheIgnoreTypeOption()
    {
        var client = AuthenticatedClient();
        var category = new Category { Name = "Internal Transfer 2", Colour = "#6b7280", Type = Category.CategoryType.Ignore };

        var response = await client.PostAsJsonAsync("/settings/category", category);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var getResponse = await client.GetAsync("/settings");
        var body = await getResponse.Content.ReadFromJsonAsync<SettingsResponse>(JsonOptions);
        var stored = body!.Categories.Single(c => c.Name == "Internal Transfer 2");
        Assert.Equal(Category.CategoryType.Ignore, stored.Type);
    }

    [Fact]
    public async Task AddCategory_RejectsDuplicateNames_CaseInsensitively()
    {
        var client = AuthenticatedClient();
        await client.PostAsJsonAsync("/settings/category", new Category { Name = "Groceries", Colour = "#00ff00", Type = Category.CategoryType.Expense });

        var response = await client.PostAsJsonAsync("/settings/category", new Category { Name = "groceries", Colour = "#ff0000", Type = Category.CategoryType.Expense });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task DeleteCategory_RemovesTheCategoryAndClearsItFromTransactionsAcrossMonths()
    {
        var client = AuthenticatedClient();
        await client.PostAsJsonAsync("/settings/category", new Category { Name = "Groceries", Colour = "#00ff00", Type = Category.CategoryType.Expense });

        using var scope = _factory.Services.CreateScope();
        var transactionMonths = scope.ServiceProvider.GetRequiredService<IRepository<TransactionMonth>>();

        var juneId = TransactionMonth.BuildId(_email, 2026, 6);
        _seededMonthIds.Add(juneId);
        await transactionMonths.AddAsync(new TransactionMonth
        {
            Email = _email,
            Year = 2026,
            Month = 6,
            Transactions =
            [
                new Transaction { Account = "Everyday", Date = new DateOnly(2026, 6, 10), Description = "Coles", Category = "Groceries", Amount = -50.00m },
                new Transaction { Account = "Everyday", Date = new DateOnly(2026, 6, 12), Description = "Salary", Category = "Income", Amount = 1000.00m },
            ],
        });

        var julyId = TransactionMonth.BuildId(_email, 2026, 7);
        _seededMonthIds.Add(julyId);
        await transactionMonths.AddAsync(new TransactionMonth
        {
            Email = _email,
            Year = 2026,
            Month = 7,
            Transactions =
            [
                new Transaction { Account = "Everyday", Date = new DateOnly(2026, 7, 5), Description = "Woolworths", Category = "Groceries", Amount = -30.00m },
            ],
        });

        var deleteRequest = new HttpRequestMessage(HttpMethod.Delete, "/settings/category")
        {
            Content = JsonContent.Create(new Category { Name = "Groceries", Colour = "#00ff00", Type = Category.CategoryType.Expense }),
        };
        var response = await client.SendAsync(deleteRequest);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        var getResponse = await client.GetAsync("/settings");
        var body = await getResponse.Content.ReadFromJsonAsync<SettingsResponse>(JsonOptions);
        Assert.DoesNotContain(body!.Categories, c => c.Name == "Groceries");

        var june = await transactionMonths.GetAsync(juneId);
        Assert.Equal("", june!.Transactions.Single(t => t.Description == "Coles").Category);
        Assert.Equal("Income", june.Transactions.Single(t => t.Description == "Salary").Category);

        var july = await transactionMonths.GetAsync(julyId);
        Assert.Equal("", july!.Transactions.Single(t => t.Description == "Woolworths").Category);
    }

    [Fact]
    public async Task DeleteCategory_ReturnsNotFound_WhenNoMatchingCategoryExists()
    {
        var client = AuthenticatedClient();
        var deleteRequest = new HttpRequestMessage(HttpMethod.Delete, "/settings/category")
        {
            Content = JsonContent.Create(new Category { Name = "Does Not Exist", Colour = "#000000", Type = Category.CategoryType.Expense }),
        };

        var response = await client.SendAsync(deleteRequest);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DeleteCategory_RejectsInternalTransfer()
    {
        var client = AuthenticatedClient();
        await client.PostAsJsonAsync("/settings/category", new Category { Name = "Internal Transfer", Colour = "#000000", Type = Category.CategoryType.Expense });

        var deleteRequest = new HttpRequestMessage(HttpMethod.Delete, "/settings/category")
        {
            Content = JsonContent.Create(new Category { Name = "Internal Transfer", Colour = "#000000", Type = Category.CategoryType.Expense }),
        };
        var response = await client.SendAsync(deleteRequest);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
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
