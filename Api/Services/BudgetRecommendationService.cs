using Pim.Api.Data;

namespace Pim.Api.Services;

// Recommends a monthly budget per Expense category from past spending (UBE-123).
public static class BudgetRecommendationService
{
    public const int MonthsToAverage = 6;

    // The full months averaged over: the MonthsToAverage before `currentMonth`.
    public static (DateOnly Start, DateOnly End) Window(DateOnly currentMonth)
    {
        var firstOfCurrent = new DateOnly(currentMonth.Year, currentMonth.Month, 1);
        return (firstOfCurrent.AddMonths(-MonthsToAverage), firstOfCurrent.AddDays(-1));
    }

    // Average net monthly spend per Expense category, rounded up to the whole dollar. Months with no
    // spend count as $0; with less history than the window, divides by the months available instead.
    public static List<Budget> Recommend(
        IEnumerable<Transaction> transactions,
        IEnumerable<Category> categories,
        DateOnly currentMonth,
        DateOnly? minTransactionDate)
    {
        if (minTransactionDate is null)
        {
            return [];
        }

        var (start, end) = Window(currentMonth);
        var firstMonth = new DateOnly(minTransactionDate.Value.Year, minTransactionDate.Value.Month, 1);
        if (firstMonth < start)
        {
            firstMonth = start;
        }

        var months = ((end.Year - firstMonth.Year) * 12) + end.Month - firstMonth.Month + 1;
        if (months <= 0)
        {
            return [];
        }

        var expenseCategories = categories
            .Where(c => c.Type == Category.CategoryType.Expense)
            .Select(c => c.Name)
            .ToHashSet(StringComparer.Ordinal);

        return transactions
            .Where(t => t.Ignore != true && t.Date >= start && t.Date <= end && expenseCategories.Contains(t.Category))
            .GroupBy(t => t.Category, StringComparer.Ordinal)
            .Select(g => new Budget { Category = g.Key, Amount = Math.Ceiling(-g.Sum(t => t.Amount) / months) })
            .Where(b => b.Amount > 0)
            .OrderBy(b => b.Category, StringComparer.Ordinal)
            .ToList();
    }
}
