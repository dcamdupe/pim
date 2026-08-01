using Moq;
using Pim.Api.Data;
using Pim.Api.Repository;
using Pim.Api.Services;
using Pim.Api.UnitTests.Helpers;

namespace Pim.Api.UnitTests.Services;

public class InternalTransferMatcherTests
{
    private const string Email = "dave@example.com";

    [Fact]
    public async Task MatchAsync_MatchesTwoNewTransactions_AcrossDifferentAccountsWithinFiveDays()
    {
        var a = Transaction("Checking", new DateOnly(2026, 6, 1), -100m, "");
        var b = Transaction("Savings", new DateOnly(2026, 6, 3), 100m, "");
        var bucket = Bucket(2026, 6, a, b);
        var sut = CreateMatcher([bucket]);

        await sut.MatchAsync(Email, [a, b], [bucket]);

        Assert.Equal(InternalTransferMatcher.CategoryName, a.Category);
        Assert.Equal(InternalTransferMatcher.CategoryName, b.Category);
    }

    [Fact]
    public async Task MatchAsync_DoesNotMatch_WhenBothTransactionsAreInTheSameAccount()
    {
        var a = Transaction("Checking", new DateOnly(2026, 6, 1), -100m, "");
        var b = Transaction("Checking", new DateOnly(2026, 6, 3), 100m, "");
        var bucket = Bucket(2026, 6, a, b);
        var sut = CreateMatcher([bucket]);

        await sut.MatchAsync(Email, [a, b], [bucket]);

        Assert.Equal("", a.Category);
        Assert.Equal("", b.Category);
    }

    [Fact]
    public async Task MatchAsync_DoesNotMatch_WhenMoreThanFiveDaysApart()
    {
        var a = Transaction("Checking", new DateOnly(2026, 6, 1), -100m, "");
        var b = Transaction("Savings", new DateOnly(2026, 6, 7), 100m, "");
        var bucket = Bucket(2026, 6, a, b);
        var sut = CreateMatcher([bucket]);

        await sut.MatchAsync(Email, [a, b], [bucket]);

        Assert.Equal("", a.Category);
        Assert.Equal("", b.Category);
    }

    [Fact]
    public async Task MatchAsync_DoesNotMatch_WhenAmountsAreNotInverted()
    {
        var a = Transaction("Checking", new DateOnly(2026, 6, 1), -100m, "");
        var b = Transaction("Savings", new DateOnly(2026, 6, 2), 50m, "");
        var bucket = Bucket(2026, 6, a, b);
        var sut = CreateMatcher([bucket]);

        await sut.MatchAsync(Email, [a, b], [bucket]);

        Assert.Equal("", a.Category);
        Assert.Equal("", b.Category);
    }

    [Fact]
    public async Task MatchAsync_OverridesTheExistingCategory_OnBothMatchedTransactions()
    {
        var a = Transaction("Checking", new DateOnly(2026, 6, 1), -100m, "Shopping");
        var b = Transaction("Savings", new DateOnly(2026, 6, 2), 100m, "Dining");
        var bucket = Bucket(2026, 6, a, b);
        var sut = CreateMatcher([bucket]);

        await sut.MatchAsync(Email, [a, b], [bucket]);

        Assert.Equal(InternalTransferMatcher.CategoryName, a.Category);
        Assert.Equal(InternalTransferMatcher.CategoryName, b.Category);
    }

    [Fact]
    public async Task MatchAsync_MatchesAnAddedTransaction_AgainstAnAlreadyStoredTransactionFromAPastImport()
    {
        var oldTransaction = Transaction("Savings", new DateOnly(2026, 5, 29), 100m, "Dining");
        var mayBucket = Bucket(2026, 5, oldTransaction);
        var months = new List<TransactionMonth> { mayBucket };
        var monthsRepo = RepositoryMockFactory.Create(months);
        var sut = new InternalTransferMatcher(monthsRepo.Object, RepositoryMockFactory.Create(new List<TransactionDescriptions>()).Object);

        var added = Transaction("Checking", new DateOnly(2026, 6, 2), -100m, "");
        var juneBucket = Bucket(2026, 6, added);

        await sut.MatchAsync(Email, [added], [juneBucket]);

        Assert.Equal(InternalTransferMatcher.CategoryName, added.Category);
        Assert.Equal(InternalTransferMatcher.CategoryName, oldTransaction.Category);
        monthsRepo.Verify(r => r.UpdateAsync(mayBucket.Id, It.IsAny<TransactionMonth>()), Times.Once);
    }

    [Fact]
    public async Task MatchAsync_AdjustsUnclassifiedCount_ForAnExternalMatch()
    {
        var oldTransaction = Transaction("Savings", new DateOnly(2026, 5, 29), 100m, "");
        var mayBucket = Bucket(2026, 5, oldTransaction);
        var monthsRepo = RepositoryMockFactory.Create(new List<TransactionMonth> { mayBucket });
        var descriptions = new List<TransactionDescriptions>
        {
            new() { Email = Email, Descriptions = [new TransactionDescriptionStat { Description = oldTransaction.Description, TransactionCount = 1, UnclassifiedCount = 1 }] },
        };
        var descriptionsRepo = RepositoryMockFactory.Create(descriptions);
        var sut = new InternalTransferMatcher(monthsRepo.Object, descriptionsRepo.Object);

        var added = Transaction("Checking", new DateOnly(2026, 6, 2), -100m, "");
        var juneBucket = Bucket(2026, 6, added);

        await sut.MatchAsync(Email, [added], [juneBucket]);

        var stat = Assert.Single(Assert.Single(descriptions).Descriptions);
        Assert.Equal(0, stat.UnclassifiedCount);
    }

    [Fact]
    public async Task MatchAsync_NeverMatchesOneCandidate_ToTwoAddedTransactions()
    {
        var a1 = Transaction("Checking", new DateOnly(2026, 6, 1), -100m, "");
        var a2 = Transaction("Card", new DateOnly(2026, 6, 1), -100m, "");
        var candidate = Transaction("Savings", new DateOnly(2026, 6, 1), 100m, "");
        var bucket = Bucket(2026, 6, a1, a2, candidate);
        var sut = CreateMatcher([bucket]);

        await sut.MatchAsync(Email, [a1, a2, candidate], [bucket]);

        Assert.Equal(InternalTransferMatcher.CategoryName, candidate.Category);
        var matchedAddedCount = new[] { a1.Category, a2.Category }.Count(c => c == InternalTransferMatcher.CategoryName);
        Assert.Equal(1, matchedAddedCount);
    }

    private static Transaction Transaction(string account, DateOnly date, decimal amount, string category) => new()
    {
        Account = account,
        Date = date,
        Description = $"{account} txn {date}",
        Category = category,
        Amount = amount,
    };

    private static TransactionMonth Bucket(int year, int month, params Transaction[] transactions) => new()
    {
        Email = Email,
        Year = year,
        Month = month,
        Transactions = [.. transactions],
    };

    private static InternalTransferMatcher CreateMatcher(List<TransactionMonth> months) =>
        new(RepositoryMockFactory.Create(months).Object, RepositoryMockFactory.Create(new List<TransactionDescriptions>()).Object);
}
