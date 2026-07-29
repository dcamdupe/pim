using Pim.Api.Data;
using Pim.Api.Services;
using Pim.Api.UnitTests.Helpers;

namespace Pim.Api.UnitTests.Services;

public class TransactionQueryServiceTests
{
    private const string Email = "dave@example.com";
    private const string Account = "Everyday";

    [Fact]
    public async Task GetTransactionsAsync_ReturnsEmpty_WhenNoMonthsHaveData()
    {
        var sut = CreateService([]);

        var result = await sut.GetTransactionsAsync(Email, new DateOnly(2026, 6, 1), new DateOnly(2026, 6, 30));

        Assert.Empty(result);
    }

    [Fact]
    public async Task GetTransactionsAsync_FiltersOutTransactionsOutsideTheExactRange()
    {
        var month = new TransactionMonth
        {
            Email = Email,
            Year = 2026,
            Month = 6,
            Transactions =
            [
                Transaction("In range start", new DateOnly(2026, 6, 10)),
                Transaction("In range end", new DateOnly(2026, 6, 20)),
                Transaction("Before range", new DateOnly(2026, 6, 1)),
                Transaction("After range", new DateOnly(2026, 6, 30)),
            ],
        };
        var sut = CreateService([month]);

        var result = await sut.GetTransactionsAsync(Email, new DateOnly(2026, 6, 10), new DateOnly(2026, 6, 20));

        Assert.Equal(2, result.Count);
        Assert.Contains(result, t => t.Description == "In range start");
        Assert.Contains(result, t => t.Description == "In range end");
    }

    [Fact]
    public async Task GetTransactionsAsync_CombinesTransactionsAcrossMultipleMonths()
    {
        var june = new TransactionMonth
        {
            Email = Email,
            Year = 2026,
            Month = 6,
            Transactions = [Transaction("June", new DateOnly(2026, 6, 15))],
        };
        var august = new TransactionMonth
        {
            Email = Email,
            Year = 2026,
            Month = 8,
            Transactions = [Transaction("August", new DateOnly(2026, 8, 15))],
        };
        var sut = CreateService([june, august]);

        var result = await sut.GetTransactionsAsync(Email, new DateOnly(2026, 6, 1), new DateOnly(2026, 8, 31));

        Assert.Equal(2, result.Count);
        Assert.Contains(result, t => t.Description == "June");
        Assert.Contains(result, t => t.Description == "August");
    }

    [Fact]
    public async Task GetTransactionsAsync_HandlesMissingMonthInTheMiddleOfTheRange()
    {
        var june = new TransactionMonth
        {
            Email = Email,
            Year = 2026,
            Month = 6,
            Transactions = [Transaction("June", new DateOnly(2026, 6, 15))],
        };
        // July intentionally has no bucket at all.
        var august = new TransactionMonth
        {
            Email = Email,
            Year = 2026,
            Month = 8,
            Transactions = [Transaction("August", new DateOnly(2026, 8, 15))],
        };
        var sut = CreateService([june, august]);

        var result = await sut.GetTransactionsAsync(Email, new DateOnly(2026, 6, 1), new DateOnly(2026, 8, 31));

        Assert.Equal(2, result.Count);
    }

    [Fact]
    public async Task GetTransactionsAsync_HandlesYearBoundary()
    {
        var december = new TransactionMonth
        {
            Email = Email,
            Year = 2026,
            Month = 12,
            Transactions = [Transaction("December", new DateOnly(2026, 12, 15))],
        };
        var january = new TransactionMonth
        {
            Email = Email,
            Year = 2027,
            Month = 1,
            Transactions = [Transaction("January", new DateOnly(2027, 1, 15))],
        };
        var sut = CreateService([december, january]);

        var result = await sut.GetTransactionsAsync(Email, new DateOnly(2026, 12, 1), new DateOnly(2027, 1, 31));

        Assert.Equal(2, result.Count);
    }

    [Fact]
    public async Task GetTransactionsAsync_ReturnsDescendingByDate()
    {
        var month = new TransactionMonth
        {
            Email = Email,
            Year = 2026,
            Month = 6,
            Transactions =
            [
                Transaction("Earlier", new DateOnly(2026, 6, 1)),
                Transaction("Later", new DateOnly(2026, 6, 20)),
            ],
        };
        var sut = CreateService([month]);

        var result = await sut.GetTransactionsAsync(Email, new DateOnly(2026, 6, 1), new DateOnly(2026, 6, 30));

        Assert.Equal(["Later", "Earlier"], result.Select(t => t.Description));
    }

    private static Transaction Transaction(string description, DateOnly date) => new()
    {
        Account = Account,
        Date = date,
        Description = description,
        Category = string.Empty,
        Amount = -1m,
    };

    private static TransactionQueryService CreateService(List<TransactionMonth> months)
    {
        var repository = RepositoryMockFactory.Create(months);
        return new TransactionQueryService(repository.Object);
    }
}
