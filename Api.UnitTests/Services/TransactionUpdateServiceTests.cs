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
    public async Task ApplyCreditDescriptionMappingAsync_AddsANewMappingEntry_WhenNoneExisted()
    {
        var mappings = new List<CreditDescriptionMapping>();
        var sut = CreateService([], mappings, []);

        await sut.ApplyCreditDescriptionMappingAsync(Email, "COLES", "Groceries");

        var mapping = Assert.Single(mappings);
        var entry = Assert.Single(mapping.Mappings);
        Assert.Equal("COLES", entry.DescriptionStart);
        Assert.Equal("Groceries", entry.Category);
    }

    [Fact]
    public async Task ApplyCreditDescriptionMappingAsync_ReplacesTheCategory_ForAnExistingDescriptionStart()
    {
        var mapping = new CreditDescriptionMapping
        {
            Email = Email,
            Mappings = [new CreditDescriptionMappingEntry { DescriptionStart = "COLES", Category = "Shopping" }],
        };
        var mappings = new List<CreditDescriptionMapping> { mapping };
        var sut = CreateService([], mappings, []);

        await sut.ApplyCreditDescriptionMappingAsync(Email, "COLES", "Groceries");

        var entry = Assert.Single(Assert.Single(mappings).Mappings);
        Assert.Equal("Groceries", entry.Category);
    }

    [Fact]
    public async Task ApplyCreditDescriptionMappingAsync_UpdatesAllMatchingTransactions_AcrossMonths()
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

        await sut.ApplyCreditDescriptionMappingAsync(Email, "COLES", "Groceries");

        Assert.Equal("Groceries", june.Transactions.Single(t => t.Description == "COLES 0717 TURRAMURRA AUS").Category);
        Assert.Equal("", june.Transactions.Single(t => t.Description == "Salary").Category);
        Assert.Equal("Groceries", july.Transactions.Single().Category);
    }

    [Fact]
    public async Task ApplyCreditDescriptionMappingAsync_DecrementsUnclassifiedCount_ForEachTransactionItReclassifies()
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

        await sut.ApplyCreditDescriptionMappingAsync(Email, "COLES", "Groceries");

        var stats = Assert.Single(descriptions).Descriptions;
        Assert.Equal(0, stats.Single(s => s.Description == "COLES 0717 TURRAMURRA AUS").UnclassifiedCount);
        Assert.Equal(0, stats.Single(s => s.Description == "COLES 0760 ASQUITH AUS").UnclassifiedCount);
        Assert.Equal(1, stats.Single(s => s.Description == "Salary").UnclassifiedCount);
    }

    [Fact]
    public async Task ApplyCreditDescriptionMappingAsync_DoesNotDoubleAdjustUnclassifiedCount_ForAnAlreadyClassifiedTransaction()
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

        await sut.ApplyCreditDescriptionMappingAsync(Email, "COLES", "Groceries");

        var stat = Assert.Single(Assert.Single(descriptions).Descriptions);
        Assert.Equal(0, stat.UnclassifiedCount);
    }

    private static Transaction Transaction(string description, DateOnly date, string category) => new()
    {
        Account = Account,
        Date = date,
        Description = description,
        Category = category,
        Amount = -1m,
    };

    private static TransactionUpdateService CreateService(
        List<TransactionMonth> months,
        List<CreditDescriptionMapping>? mappings = null,
        List<Transaction>? allTransactionsForQuery = null,
        List<TransactionDescriptions>? transactionDescriptions = null)
    {
        var transactionRepository = RepositoryMockFactory.Create(months);
        var mappingRepository = RepositoryMockFactory.Create(mappings ?? []);
        var transactionDescriptionsRepository = RepositoryMockFactory.Create(transactionDescriptions ?? []);
        var queryService = new Mock<ITransactionQueryService>();
        queryService
            .Setup(s => s.GetTransactionsAsync(Email, null, It.IsAny<DateOnly>()))
            .ReturnsAsync(allTransactionsForQuery ?? []);

        return new TransactionUpdateService(transactionRepository.Object, mappingRepository.Object, transactionDescriptionsRepository.Object, queryService.Object);
    }
}
