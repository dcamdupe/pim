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
    public async Task MatchAsync_MatchesTwoNewTransactions_AcrossDifferentAccountsWithinTwoBusinessDays()
    {
        // Mon 1 Jun -> Wed 3 Jun: exactly 2 business days apart (the boundary).
        var a = Transaction("Checking", new DateOnly(2026, 6, 1), -100m, "");
        var b = Transaction("Savings", new DateOnly(2026, 6, 3), 100m, "");
        var bucket = Bucket(2026, 6, a, b);
        var sut = CreateMatcher([bucket]);

        await sut.MatchAsync(Email, [a, b], [bucket]);

        Assert.Equal(InternalTransferMatcher.CategoryName, a.Category);
        Assert.Equal(InternalTransferMatcher.CategoryName, b.Category);
    }

    [Fact]
    public async Task MatchAsync_StampsTypeAndInactive_FromTheInternalTransferCategoryDefinition_WhenOneIsSeeded()
    {
        var a = Transaction("Checking", new DateOnly(2026, 6, 1), -100m, "");
        var b = Transaction("Savings", new DateOnly(2026, 6, 3), 100m, "");
        var bucket = Bucket(2026, 6, a, b);
        var categories = new List<Category>
        {
            new() { Name = InternalTransferMatcher.CategoryName, Colour = "#6b7280", Type = Category.CategoryType.Expense, Inactive = true },
        };
        var sut = CreateMatcher([bucket], categories);

        await sut.MatchAsync(Email, [a, b], [bucket]);

        Assert.Equal(Category.CategoryType.Expense, a.Type);
        Assert.True(a.Inactive);
        Assert.Equal(Category.CategoryType.Expense, b.Type);
        Assert.True(b.Inactive);
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
    public async Task MatchAsync_Matches_AcrossAWeekend_WhenOnlyOneBusinessDayApart()
    {
        // Fri 5 Jun -> Mon 8 Jun: 3 calendar days, but only 1 business day (the weekend doesn't count).
        var a = Transaction("Checking", new DateOnly(2026, 6, 5), -100m, "");
        var b = Transaction("Savings", new DateOnly(2026, 6, 8), 100m, "");
        var bucket = Bucket(2026, 6, a, b);
        var sut = CreateMatcher([bucket]);

        await sut.MatchAsync(Email, [a, b], [bucket]);

        Assert.Equal(InternalTransferMatcher.CategoryName, a.Category);
        Assert.Equal(InternalTransferMatcher.CategoryName, b.Category);
    }

    [Fact]
    public async Task MatchAsync_Matches_AcrossAWeekend_AtTheTwoBusinessDayBoundary()
    {
        // Fri 5 Jun -> Tue 9 Jun: 4 calendar days, exactly 2 business days (the weekend doesn't count).
        var a = Transaction("Checking", new DateOnly(2026, 6, 5), -100m, "");
        var b = Transaction("Savings", new DateOnly(2026, 6, 9), 100m, "");
        var bucket = Bucket(2026, 6, a, b);
        var sut = CreateMatcher([bucket]);

        await sut.MatchAsync(Email, [a, b], [bucket]);

        Assert.Equal(InternalTransferMatcher.CategoryName, a.Category);
        Assert.Equal(InternalTransferMatcher.CategoryName, b.Category);
    }

    [Fact]
    public async Task MatchAsync_DoesNotMatch_WhenMoreThanTwoBusinessDaysApart_EvenAcrossOnlyFiveCalendarDays()
    {
        // Fri 5 Jun -> Wed 10 Jun: only 5 calendar days (would have matched under the old
        // 5-calendar-day window - this is the overmatching bug UBE-64 fixes), but 3 business days.
        var a = Transaction("Checking", new DateOnly(2026, 6, 5), -100m, "");
        var b = Transaction("Savings", new DateOnly(2026, 6, 10), 100m, "");
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
    public async Task MatchAsync_Matches_WhenOnlyThePositiveSideHasBpayInItsDescription()
    {
        var negative = Transaction("Checking", new DateOnly(2026, 6, 1), -100m, "", description: "EFT WITHDRAWAL");
        var positive = Transaction("Savings", new DateOnly(2026, 6, 2), 100m, "", description: "BPAY PAYMENT RECEIVED");
        var bucket = Bucket(2026, 6, negative, positive);
        var sut = CreateMatcher([bucket]);

        await sut.MatchAsync(Email, [negative, positive], [bucket]);

        Assert.Equal(InternalTransferMatcher.CategoryName, negative.Category);
        Assert.Equal(InternalTransferMatcher.CategoryName, positive.Category);
    }

    [Theory]
    [InlineData("Transfer to Savings")]
    [InlineData("TRANSFER TO SAVINGS")]
    [InlineData("internal transfer")]
    public async Task MatchAsync_Matches_WhenOnlyTheNegativeSideMentionsTransfer_AnyCase(string negativeDescription)
    {
        var negative = Transaction("Checking", new DateOnly(2026, 6, 1), -100m, "", description: negativeDescription);
        var positive = Transaction("Savings", new DateOnly(2026, 6, 2), 100m, "", description: "DEPOSIT");
        var bucket = Bucket(2026, 6, negative, positive);
        var sut = CreateMatcher([bucket]);

        await sut.MatchAsync(Email, [negative, positive], [bucket]);

        Assert.Equal(InternalTransferMatcher.CategoryName, negative.Category);
        Assert.Equal(InternalTransferMatcher.CategoryName, positive.Category);
    }

    [Fact]
    public async Task MatchAsync_DoesNotMatch_WhenNeitherDescriptionRuleIsSatisfied()
    {
        // Amount, date, and account all line up, but neither description carries a qualifying
        // keyword - this is the other half of the overmatching bug UBE-64 fixes.
        var negative = Transaction("Checking", new DateOnly(2026, 6, 1), -100m, "", description: "WOOLWORTHS 1234");
        var positive = Transaction("Savings", new DateOnly(2026, 6, 2), 100m, "", description: "REFUND RECEIVED");
        var bucket = Bucket(2026, 6, negative, positive);
        var sut = CreateMatcher([bucket]);

        await sut.MatchAsync(Email, [negative, positive], [bucket]);

        Assert.Equal("", negative.Category);
        Assert.Equal("", positive.Category);
    }

    [Fact]
    public async Task MatchAsync_DoesNotMatch_WhenOnlyTheWrongSideHasAQualifyingKeyword()
    {
        // BPAY on the *negative* side, and "transfer" on the *positive* side - neither counts,
        // since the rule is side-specific (BPAY must be on the + side, transfer on the - side).
        var negative = Transaction("Checking", new DateOnly(2026, 6, 1), -100m, "", description: "BPAY PAYMENT SENT");
        var positive = Transaction("Savings", new DateOnly(2026, 6, 2), 100m, "", description: "Transfer received");
        var bucket = Bucket(2026, 6, negative, positive);
        var sut = CreateMatcher([bucket]);

        await sut.MatchAsync(Email, [negative, positive], [bucket]);

        Assert.Equal("", negative.Category);
        Assert.Equal("", positive.Category);
    }

    [Fact]
    public async Task MatchAsync_MatchesAnAddedTransaction_AgainstAnAlreadyStoredTransactionFromAPastImport()
    {
        var oldTransaction = Transaction("Savings", new DateOnly(2026, 5, 29), 100m, "Dining");
        var mayBucket = Bucket(2026, 5, oldTransaction);
        var months = new List<TransactionMonth> { mayBucket };
        var monthsRepo = RepositoryMockFactory.Create(months);
        var sut = new InternalTransferMatcher(
            monthsRepo.Object,
            RepositoryMockFactory.Create(new List<TransactionDescriptions>()).Object,
            RepositoryMockFactory.Create(new List<User>()).Object);

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
        var sut = new InternalTransferMatcher(monthsRepo.Object, descriptionsRepo.Object, RepositoryMockFactory.Create(new List<User>()).Object);

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

    // Defaults to a description that satisfies the BPAY/transfer rule regardless of which side
    // (positive or negative) it ends up playing, so tests that aren't specifically about the
    // description rule don't need to think about it.
    private static Transaction Transaction(string account, DateOnly date, decimal amount, string category, string? description = null) => new()
    {
        Account = account,
        Date = date,
        Description = description ?? $"{account} BPAY Transfer txn {date}",
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

    private static InternalTransferMatcher CreateMatcher(List<TransactionMonth> months, List<Category>? categories = null) =>
        new(
            RepositoryMockFactory.Create(months).Object,
            RepositoryMockFactory.Create(new List<TransactionDescriptions>()).Object,
            RepositoryMockFactory.Create(new List<User> { new() { Email = Email, PasswordHash = "unused", Categories = categories ?? [] } }).Object);
}
