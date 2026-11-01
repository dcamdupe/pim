using Pim.Api.Data;

namespace Pim.Api.Services;

// Validates a PUT /budgets payload against the user's categories (UBE-119).
public static class BudgetValidator
{
    // Returns an error message, or null when the budgets are valid.
    public static string? Validate(IReadOnlyCollection<Budget> budgets, IReadOnlyCollection<Category> categories)
    {
        if (budgets.Any(b => string.IsNullOrWhiteSpace(b.Category)))
        {
            return "Budget category is required.";
        }

        if (budgets.GroupBy(b => b.Category, StringComparer.OrdinalIgnoreCase).Any(g => g.Count() > 1))
        {
            return "Each category can only have one budget.";
        }

        foreach (var budget in budgets)
        {
            var category = categories.FirstOrDefault(c => string.Equals(c.Name, budget.Category, StringComparison.OrdinalIgnoreCase));
            if (category is null)
            {
                return $"Category \"{budget.Category}\" does not exist.";
            }

            if (category.Type != Category.CategoryType.Expense)
            {
                return $"Category \"{budget.Category}\" is not an Expense category.";
            }

            if (budget.Amount <= 0 || decimal.Round(budget.Amount, 2) != budget.Amount)
            {
                return $"Budget for \"{budget.Category}\" must be greater than 0 with at most 2 decimal places.";
            }
        }

        return null;
    }
}
