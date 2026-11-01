using Pim.Api.Data;
using Pim.Api.Services;

namespace Pim.Api.UnitTests.Services;

public class BudgetRecommendationServiceTests
{
    private static readonly DateOnly CurrentMonth = new(2026, 11, 1);
    private static readonly DateOnly LongHistory = new(2020, 1, 1);

    private static readonly List<Category> Categories =
    [
        new() { Name = "Groceries", Colour = "#0f0", Type = Category.CategoryType.Expense },
        new() { Name = "Dining", Colour = "#f00", Type = Category.CategoryType.Expense },
        new() { Name = "Salary", Colour = "#00f", Type = Category.CategoryType.Income },
    ];

    [Fact]
    public void Window_IsTheSixFullMonthsBeforeTheCurrentMonth()
    {
        var (start, end) = BudgetRecommendationService.Window(new DateOnly(2026, 11, 15));

        Assert.Equal(new DateOnly(2026, 5, 1), start);
        Assert.Equal(new DateOnly(2026, 10, 31), end);
    }

    [Fact]
    public void Recommend_AveragesOverSixMonths_CountingMonthsWithNoSpendAsZero()
    {
        // $600 in one month and nothing in the other five -> $100/month.
        var result = Recommend([Tx("Groceries", 2026, 7, -600m)]);

        Assert.Equal(100m, Assert.Single(result).Amount);
    }

    [Fact]
    public void Recommend_RoundsUpToTheNextWholeDollar()
    {
        var result = Recommend([Tx("Groceries", 2026, 5, -601m)]);

        Assert.Equal(101m, Assert.Single(result).Amount);
    }

    [Fact]
    public void Recommend_NetsRefundsAgainstSpend()
    {
        var result = Recommend([Tx("Groceries", 2026, 5, -700m), Tx("Groceries", 2026, 6, 100m)]);

        Assert.Equal(100m, Assert.Single(result).Amount);
    }

    [Fact]
    public void Recommend_ExcludesTheCurrentMonthAndMonthsBeforeTheWindow()
    {
        var result = Recommend(
        [
            Tx("Groceries", 2026, 11, -1000m),
            Tx("Groceries", 2026, 4, -1000m),
            Tx("Groceries", 2026, 10, -60m),
        ]);

        Assert.Equal(10m, Assert.Single(result).Amount);
    }

    [Fact]
    public void Recommend_SkipsIgnoredTransactions_AndNonExpenseCategories()
    {
        var ignored = Tx("Groceries", 2026, 5, -600m);
        ignored.Ignore = true;

        var result = Recommend([ignored, Tx("Salary", 2026, 5, -600m), Tx("Unknown", 2026, 5, -600m)]);

        Assert.Empty(result);
    }

    [Fact]
    public void Recommend_OmitsCategoriesWithNoNetSpend()
    {
        var result = Recommend([Tx("Dining", 2026, 5, 50m), Tx("Groceries", 2026, 5, -60m)]);

        Assert.Equal("Groceries", Assert.Single(result).Category);
    }

    [Fact]
    public void Recommend_DividesByTheMonthsAvailable_WhenHistoryIsShorterThanSixMonths()
    {
        // History starts mid-August -> Aug, Sep, Oct = 3 months.
        var result = Recommend([Tx("Groceries", 2026, 9, -300m)], minTransactionDate: new DateOnly(2026, 8, 20));

        Assert.Equal(100m, Assert.Single(result).Amount);
    }

    [Fact]
    public void Recommend_ReturnsEmpty_WithNoHistoryBeforeTheCurrentMonth()
    {
        Assert.Empty(Recommend([Tx("Groceries", 2026, 11, -50m)], minTransactionDate: new DateOnly(2026, 11, 2)));
        Assert.Empty(BudgetRecommendationService.Recommend([Tx("Groceries", 2026, 10, -50m)], Categories, CurrentMonth, null));
    }

    [Fact]
    public void Recommend_ReturnsOneEntryPerCategory_SortedByName()
    {
        var result = Recommend([Tx("Groceries", 2026, 5, -60m), Tx("Dining", 2026, 6, -120m), Tx("Groceries", 2026, 6, -60m)]);

        Assert.Equal(["Dining", "Groceries"], result.Select(b => b.Category));
        Assert.Equal([20m, 20m], result.Select(b => b.Amount));
    }

    private static List<Budget> Recommend(List<Transaction> transactions, DateOnly? minTransactionDate = null) =>
        BudgetRecommendationService.Recommend(transactions, Categories, CurrentMonth, minTransactionDate ?? LongHistory);

    private static Transaction Tx(string category, int year, int month, decimal amount) => new()
    {
        Account = "Everyday",
        Date = new DateOnly(year, month, 15),
        Description = $"{category} {year}-{month}",
        Category = category,
        Amount = amount,
    };
}
