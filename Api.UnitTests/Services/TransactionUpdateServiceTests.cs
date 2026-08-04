using Moq;
using Pim.Api.Data;
using Pim.Api.Services;
using Pim.Api.UnitTests.Helpers;

namespace Pim.Api.UnitTests.Services;

public class TransactionUpdateServiceTests
{
    private const string Email = "dave@example.com";
    private const string Account = "Everyday";

    [Fact]
    public async Task UpdateTransactionsAsync_ReplacesTheMatchingTransaction_InItsMonthBucket()
    {
        var month = new TransactionMonth
        {
            Email = Email,
            Year = 2026,
            Month = 6,
            Transactions = [Transaction("Coffee Shop", new DateOnly(2026, 6, 1), "")],
        };
        var months = new List<TransactionMonth> { month };
        var updated = Transaction("Coffee Shop", new DateOnly(2026, 6, 1), "Dining");
        var sut = CreateService(months);

        await sut.UpdateTransactionsAsync(Email, [updated]);

        Assert.Equal("Dining", Assert.Single(months).Transactions.Single().Category);
    }

    [Fact]
    public async Task UpdateTransactionsAsync_SetsInactive_OnTheMatchingTransaction()
    {
        var existing = Transaction("Coffee Shop", new DateOnly(2026, 6, 1), "");
        var month = new TransactionMonth { Email = Email, Year = 2026, Month = 6, Transactions = [existing] };
        var months = new List<TransactionMonth> { month };
        var updated = Transaction("Coffee Shop", new DateOnly(2026, 6, 1), "");
        updated.Inactive = true;
        var sut = CreateService(months);

        await sut.UpdateTransactionsAsync(Email, [updated]);

        Assert.True(Assert.Single(months).Transactions.Single().Inactive);
    }

    [Fact]
    public async Task UpdateTransactionsAsync_ClearsInactive_OnTheMatchingTransaction()
    {
        var existing = Transaction("Coffee Shop", new DateOnly(2026, 6, 1), "");
        existing.Inactive = true;
        var month = new TransactionMonth { Email = Email, Year = 2026, Month = 6, Transactions = [existing] };
        var months = new List<TransactionMonth> { month };
        var updated = Transaction("Coffee Shop", new DateOnly(2026, 6, 1), "");
        updated.Inactive = false;
        var sut = CreateService(months);

        await sut.UpdateTransactionsAsync(Email, [updated]);

        Assert.False(Assert.Single(months).Transactions.Single().Inactive);
    }

    [Fact]
    public async Task UpdateTransactionsAsync_StampsTypeAndInactive_FromTheNewCategorysDefinition_WhenCategoryChanges()
    {
        var month = new TransactionMonth
        {
            Email = Email,
            Year = 2026,
            Month = 6,
            Transactions = [Transaction("Coffee Shop", new DateOnly(2026, 6, 1), "")],
        };
        var months = new List<TransactionMonth> { month };
        var updated = Transaction("Coffee Shop", new DateOnly(2026, 6, 1), "Dining");
        var categories = new List<Category> { new() { Name = "Dining", Colour = "#eda100", Type = Category.CategoryType.Expense, Inactive = true } };
        var sut = CreateService(months, categories: categories);

        await sut.UpdateTransactionsAsync(Email, [updated]);

        var stored = Assert.Single(months).Transactions.Single();
        Assert.Equal(Category.CategoryType.Expense, stored.Type);
        Assert.True(stored.Inactive);
    }

    [Fact]
    public async Task UpdateTransactionsAsync_DoesNotReapplyTheCategoryStamp_WhenOnlyInactiveChangesAndCategoryStaysTheSame()
    {
        var existing = Transaction("Coffee Shop", new DateOnly(2026, 6, 1), "Dining");
        existing.Type = Category.CategoryType.Expense;
        existing.Inactive = false;
        var month = new TransactionMonth { Email = Email, Year = 2026, Month = 6, Transactions = [existing] };
        var months = new List<TransactionMonth> { month };
        // Same category as the existing "Dining" definition would produce (Inactive: false), but the
        // category itself is unchanged here - a manual "Set inactive" toggle should stick rather than
        // being immediately re-stamped back to the category definition's own Inactive value.
        var categories = new List<Category> { new() { Name = "Dining", Colour = "#eda100", Type = Category.CategoryType.Expense, Inactive = false } };
        var updated = Transaction("Coffee Shop", new DateOnly(2026, 6, 1), "Dining");
        updated.Type = Category.CategoryType.Expense;
        updated.Inactive = true;
        var sut = CreateService(months, categories: categories);

        await sut.UpdateTransactionsAsync(Email, [updated]);

        Assert.True(Assert.Single(months).Transactions.Single().Inactive);
    }

    [Fact]
    public async Task UpdateTransactionsAsync_DecrementsUnclassifiedCount_WhenATransactionBecomesClassified()
    {
        var month = new TransactionMonth
        {
            Email = Email,
            Year = 2026,
            Month = 6,
            Transactions = [Transaction("Coffee Shop", new DateOnly(2026, 6, 1), "")],
        };
        var months = new List<TransactionMonth> { month };
        var descriptions = new List<TransactionDescriptions>
        {
            new() { Email = Email, Descriptions = [new TransactionDescriptionStat { Description = "Coffee Shop", TransactionCount = 1, UnclassifiedCount = 1 }] },
        };
        var updated = Transaction("Coffee Shop", new DateOnly(2026, 6, 1), "Dining");
        var sut = CreateService(months, transactionDescriptions: descriptions);

        await sut.UpdateTransactionsAsync(Email, [updated]);

        var stat = Assert.Single(Assert.Single(descriptions).Descriptions);
        Assert.Equal(1, stat.TransactionCount);
        Assert.Equal(0, stat.UnclassifiedCount);
    }

    [Fact]
    public async Task UpdateTransactionsAsync_LeavesUnclassifiedCountUnchanged_WhenRecategorisingAnAlreadyClassifiedTransaction()
    {
        var month = new TransactionMonth
        {
            Email = Email,
            Year = 2026,
            Month = 6,
            Transactions = [Transaction("Coffee Shop", new DateOnly(2026, 6, 1), "Shopping")],
        };
        var months = new List<TransactionMonth> { month };
        var descriptions = new List<TransactionDescriptions>
        {
            new() { Email = Email, Descriptions = [new TransactionDescriptionStat { Description = "Coffee Shop", TransactionCount = 1, UnclassifiedCount = 0 }] },
        };
        var updated = Transaction("Coffee Shop", new DateOnly(2026, 6, 1), "Dining");
        var sut = CreateService(months, transactionDescriptions: descriptions);

        await sut.UpdateTransactionsAsync(Email, [updated]);

        var stat = Assert.Single(Assert.Single(descriptions).Descriptions);
        Assert.Equal(0, stat.UnclassifiedCount);
    }

    [Fact]
    public async Task UpdateTransactionsAsync_LeavesTheMonthUntouched_WhenNoTransactionMatches()
    {
        var month = new TransactionMonth
        {
            Email = Email,
            Year = 2026,
            Month = 6,
            Transactions = [Transaction("Coffee Shop", new DateOnly(2026, 6, 1), "")],
        };
        var months = new List<TransactionMonth> { month };
        var nonMatching = Transaction("Different Description", new DateOnly(2026, 6, 1), "Dining");
        var sut = CreateService(months);

        await sut.UpdateTransactionsAsync(Email, [nonMatching]);

        Assert.Equal("", Assert.Single(months).Transactions.Single().Category);
    }

    [Fact]
    public async Task UpdateTransactionsAsync_DoesNothing_WhenTheMonthBucketDoesNotExist()
    {
        var months = new List<TransactionMonth>();
        var sut = CreateService(months);

        await sut.UpdateTransactionsAsync(Email, [Transaction("Coffee Shop", new DateOnly(2026, 6, 1), "Dining")]);

        Assert.Empty(months);
    }

    [Fact]
    public async Task ApplyDescriptionMappingAsync_AddsANewMappingEntry_WhenNoneExisted()
    {
        var mappings = new List<DescriptionMapping>();
        var sut = CreateService([], mappings, []);

        await sut.ApplyDescriptionMappingAsync(Email, "COLES", "Groceries");

        var mapping = Assert.Single(mappings);
        var entry = Assert.Single(mapping.Mappings);
        Assert.Equal("COLES", entry.DescriptionStart);
        Assert.Equal("Groceries", entry.Category);
    }

    [Fact]
    public async Task ApplyDescriptionMappingAsync_ReplacesTheCategory_ForAnExistingDescriptionStart()
    {
        var mapping = new DescriptionMapping
        {
            Email = Email,
            Mappings = [new DescriptionMappingEntry { DescriptionStart = "COLES", Category = "Shopping" }],
        };
        var mappings = new List<DescriptionMapping> { mapping };
        var sut = CreateService([], mappings, []);

        await sut.ApplyDescriptionMappingAsync(Email, "COLES", "Groceries");

        var entry = Assert.Single(Assert.Single(mappings).Mappings);
        Assert.Equal("Groceries", entry.Category);
    }

    [Fact]
    public async Task ApplyDescriptionMappingAsync_UpdatesAllMatchingTransactions_AcrossMonths()
    {
        var june = new TransactionMonth
        {
            Email = Email,
            Year = 2026,
            Month = 6,
            Transactions =
            [
                Transaction("COLES 0717 TURRAMURRA AUS", new DateOnly(2026, 6, 1), ""),
                Transaction("Salary", new DateOnly(2026, 6, 2), ""),
            ],
        };
        var july = new TransactionMonth
        {
            Email = Email,
            Year = 2026,
            Month = 7,
            Transactions = [Transaction("COLES 0760 ASQUITH AUS", new DateOnly(2026, 7, 1), "")],
        };
        var months = new List<TransactionMonth> { june, july };
        var allTransactions = june.Transactions.Concat(july.Transactions).ToList();
        var sut = CreateService(months, [], allTransactions);

        await sut.ApplyDescriptionMappingAsync(Email, "COLES", "Groceries");

        Assert.Equal("Groceries", june.Transactions.Single(t => t.Description == "COLES 0717 TURRAMURRA AUS").Category);
        Assert.Equal("", june.Transactions.Single(t => t.Description == "Salary").Category);
        Assert.Equal("Groceries", july.Transactions.Single().Category);
    }

    [Fact]
    public async Task ApplyDescriptionMappingAsync_StampsTypeAndInactive_FromTheCategorysDefinition()
    {
        var june = new TransactionMonth
        {
            Email = Email,
            Year = 2026,
            Month = 6,
            Transactions = [Transaction("COLES 0717 TURRAMURRA AUS", new DateOnly(2026, 6, 1), "")],
        };
        var months = new List<TransactionMonth> { june };
        var categories = new List<Category> { new() { Name = "Groceries", Colour = "#eb6834", Type = Category.CategoryType.Expense, Inactive = false } };
        var sut = CreateService(months, [], june.Transactions, categories: categories);

        await sut.ApplyDescriptionMappingAsync(Email, "COLES", "Groceries");

        var transaction = june.Transactions.Single();
        Assert.Equal(Category.CategoryType.Expense, transaction.Type);
        Assert.False(transaction.Inactive);
    }

    [Fact]
    public async Task ApplyDescriptionMappingAsync_DecrementsUnclassifiedCount_ForEachTransactionItReclassifies()
    {
        var june = new TransactionMonth
        {
            Email = Email,
            Year = 2026,
            Month = 6,
            Transactions =
            [
                Transaction("COLES 0717 TURRAMURRA AUS", new DateOnly(2026, 6, 1), ""),
                Transaction("COLES 0760 ASQUITH AUS", new DateOnly(2026, 6, 2), ""),
                Transaction("Salary", new DateOnly(2026, 6, 3), ""),
            ],
        };
        var months = new List<TransactionMonth> { june };
        var descriptions = new List<TransactionDescriptions>
        {
            new()
            {
                Email = Email,
                Descriptions =
                [
                    new TransactionDescriptionStat { Description = "COLES 0717 TURRAMURRA AUS", TransactionCount = 1, UnclassifiedCount = 1 },
                    new TransactionDescriptionStat { Description = "COLES 0760 ASQUITH AUS", TransactionCount = 1, UnclassifiedCount = 1 },
                    new TransactionDescriptionStat { Description = "Salary", TransactionCount = 1, UnclassifiedCount = 1 },
                ],
            },
        };
        var sut = CreateService(months, [], june.Transactions, descriptions);

        await sut.ApplyDescriptionMappingAsync(Email, "COLES", "Groceries");

        var stats = Assert.Single(descriptions).Descriptions;
        Assert.Equal(0, stats.Single(s => s.Description == "COLES 0717 TURRAMURRA AUS").UnclassifiedCount);
        Assert.Equal(0, stats.Single(s => s.Description == "COLES 0760 ASQUITH AUS").UnclassifiedCount);
        Assert.Equal(1, stats.Single(s => s.Description == "Salary").UnclassifiedCount);
    }

    [Fact]
    public async Task ApplyDescriptionMappingAsync_DoesNotDoubleAdjustUnclassifiedCount_ForAnAlreadyClassifiedTransaction()
    {
        var june = new TransactionMonth
        {
            Email = Email,
            Year = 2026,
            Month = 6,
            Transactions = [Transaction("COLES 0717 TURRAMURRA AUS", new DateOnly(2026, 6, 1), "Groceries")],
        };
        var months = new List<TransactionMonth> { june };
        var descriptions = new List<TransactionDescriptions>
        {
            new() { Email = Email, Descriptions = [new TransactionDescriptionStat { Description = "COLES 0717 TURRAMURRA AUS", TransactionCount = 1, UnclassifiedCount = 0 }] },
        };
        var sut = CreateService(months, [], june.Transactions, descriptions);

        await sut.ApplyDescriptionMappingAsync(Email, "COLES", "Groceries");

        var stat = Assert.Single(Assert.Single(descriptions).Descriptions);
        Assert.Equal(0, stat.UnclassifiedCount);
    }

    [Fact]
    public async Task DeleteTransactionsForAccountAsync_RemovesOnlyTheMatchingAccountsTransactions_AcrossMonths()
    {
        var june = new TransactionMonth
        {
            Email = Email,
            Year = 2026,
            Month = 6,
            Transactions =
            [
                Transaction("Coffee Shop", new DateOnly(2026, 6, 1), "", "Everyday"),
                Transaction("Interest", new DateOnly(2026, 6, 2), "Income", "Rainy day"),
            ],
        };
        var july = new TransactionMonth
        {
            Email = Email,
            Year = 2026,
            Month = 7,
            Transactions = [Transaction("Interest", new DateOnly(2026, 7, 1), "Income", "Rainy day")],
        };
        var months = new List<TransactionMonth> { june, july };
        var allTransactions = june.Transactions.Concat(july.Transactions).ToList();
        var sut = CreateService(months, [], allTransactions);

        await sut.DeleteTransactionsForAccountAsync(Email, "Rainy day");

        var remainingJune = Assert.Single(june.Transactions);
        Assert.Equal("Everyday", remainingJune.Account);
        Assert.Empty(july.Transactions);
    }

    [Fact]
    public async Task DeleteTransactionsForAccountAsync_LeavesTheMonthUntouched_WhenNoTransactionMatches()
    {
        var existing = Transaction("Coffee Shop", new DateOnly(2026, 6, 1), "", "Everyday");
        var month = new TransactionMonth { Email = Email, Year = 2026, Month = 6, Transactions = [existing] };
        var months = new List<TransactionMonth> { month };
        var sut = CreateService(months, [], [existing]);

        await sut.DeleteTransactionsForAccountAsync(Email, "Rainy day");

        Assert.Same(existing, Assert.Single(months).Transactions.Single());
    }

    [Fact]
    public async Task DeleteTransactionsForAccountAsync_DoesNothing_WhenTheAccountHasNoTransactions()
    {
        var months = new List<TransactionMonth>();
        var sut = CreateService(months, [], []);

        await sut.DeleteTransactionsForAccountAsync(Email, "Rainy day");

        Assert.Empty(months);
    }

    [Fact]
    public async Task RemoveCategoryFromTransactionsAsync_ClearsOnlyTheMatchingCategory_AcrossMonths()
    {
        var coles = Transaction("Coles", new DateOnly(2026, 6, 1), "Groceries");
        coles.Type = Category.CategoryType.Expense;
        coles.Inactive = false;
        var june = new TransactionMonth
        {
            Email = Email,
            Year = 2026,
            Month = 6,
            Transactions =
            [
                coles,
                Transaction("Salary", new DateOnly(2026, 6, 2), "Income"),
            ],
        };
        var july = new TransactionMonth
        {
            Email = Email,
            Year = 2026,
            Month = 7,
            Transactions = [Transaction("Woolworths", new DateOnly(2026, 7, 1), "Groceries")],
        };
        var months = new List<TransactionMonth> { june, july };
        var allTransactions = june.Transactions.Concat(july.Transactions).ToList();
        var sut = CreateService(months, [], allTransactions);

        await sut.RemoveCategoryFromTransactionsAsync(Email, "Groceries");

        var colesAfter = june.Transactions.Single(t => t.Description == "Coles");
        Assert.Equal("", colesAfter.Category);
        Assert.Null(colesAfter.Type);
        Assert.Null(colesAfter.Inactive);
        Assert.Equal("Income", june.Transactions.Single(t => t.Description == "Salary").Category);
        Assert.Equal("", july.Transactions.Single().Category);
    }

    [Fact]
    public async Task RemoveCategoryFromTransactionsAsync_LeavesTheMonthUntouched_WhenNoTransactionMatches()
    {
        var existing = Transaction("Coffee Shop", new DateOnly(2026, 6, 1), "Dining");
        var month = new TransactionMonth { Email = Email, Year = 2026, Month = 6, Transactions = [existing] };
        var months = new List<TransactionMonth> { month };
        var sut = CreateService(months, [], [existing]);

        await sut.RemoveCategoryFromTransactionsAsync(Email, "Groceries");

        Assert.Same(existing, Assert.Single(months).Transactions.Single());
        Assert.Equal("Dining", existing.Category);
    }

    [Fact]
    public async Task RemoveCategoryFromTransactionsAsync_DoesNothing_WhenTheCategoryHasNoTransactions()
    {
        var months = new List<TransactionMonth>();
        var sut = CreateService(months, [], []);

        await sut.RemoveCategoryFromTransactionsAsync(Email, "Groceries");

        Assert.Empty(months);
    }

    private static Transaction Transaction(string description, DateOnly date, string category, string? account = null) => new()
    {
        Account = account ?? Account,
        Date = date,
        Description = description,
        Category = category,
        Amount = -1m,
    };

    private static TransactionUpdateService CreateService(
        List<TransactionMonth> months,
        List<DescriptionMapping>? mappings = null,
        List<Transaction>? allTransactionsForQuery = null,
        List<TransactionDescriptions>? transactionDescriptions = null,
        List<Category>? categories = null)
    {
        var transactionRepository = RepositoryMockFactory.Create(months);
        var mappingRepository = RepositoryMockFactory.Create(mappings ?? []);
        var transactionDescriptionsRepository = RepositoryMockFactory.Create(transactionDescriptions ?? []);
        var users = new List<User> { new() { Email = Email, PasswordHash = "unused", Categories = categories ?? [] } };
        var userRepository = RepositoryMockFactory.Create(users);
        var queryService = new Mock<ITransactionQueryService>();
        queryService
            .Setup(s => s.GetTransactionsAsync(Email, null, It.IsAny<DateOnly>()))
            .ReturnsAsync(allTransactionsForQuery ?? []);

        return new TransactionUpdateService(transactionRepository.Object, mappingRepository.Object, transactionDescriptionsRepository.Object, userRepository.Object, queryService.Object);
    }
}
