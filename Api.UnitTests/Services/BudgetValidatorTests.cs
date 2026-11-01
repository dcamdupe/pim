using Pim.Api.Data;
using Pim.Api.Services;

namespace Pim.Api.UnitTests.Services;

public class BudgetValidatorTests
{
    private static readonly List<Category> Categories =
    [
        new() { Name = "Groceries", Colour = "#0f0", Type = Category.CategoryType.Expense },
        new() { Name = "Dining", Colour = "#f00", Type = Category.CategoryType.Expense },
        new() { Name = "Salary", Colour = "#00f", Type = Category.CategoryType.Income },
        new() { Name = "Transfers", Colour = "#999", Type = Category.CategoryType.Ignore },
    ];

    [Fact]
    public void Validate_ReturnsNull_ForValidBudgets()
    {
        var budgets = new List<Budget> { new() { Category = "Groceries", Amount = 800.5m }, new() { Category = "dining", Amount = 1m } };

        Assert.Null(BudgetValidator.Validate(budgets, Categories));
    }

    [Fact]
    public void Validate_ReturnsNull_ForAnEmptyList()
    {
        Assert.Null(BudgetValidator.Validate([], Categories));
    }

    [Theory]
    [InlineData("", 10, "required")]
    [InlineData("Unknown", 10, "does not exist")]
    [InlineData("Salary", 10, "not an Expense")]
    [InlineData("Transfers", 10, "not an Expense")]
    [InlineData("Groceries", 0, "greater than 0")]
    [InlineData("Groceries", -1, "greater than 0")]
    [InlineData("Groceries", 1.001, "2 decimal places")]
    public void Validate_ReturnsAnError_ForInvalidBudget(string category, decimal amount, string expected)
    {
        var error = BudgetValidator.Validate([new Budget { Category = category, Amount = amount }], Categories);

        Assert.Contains(expected, error, StringComparison.Ordinal);
    }

    [Fact]
    public void Validate_ReturnsAnError_ForDuplicateCategoriesIgnoringCase()
    {
        var budgets = new List<Budget> { new() { Category = "Groceries", Amount = 1m }, new() { Category = "GROCERIES", Amount = 2m } };

        Assert.Contains("only have one budget", BudgetValidator.Validate(budgets, Categories), StringComparison.Ordinal);
    }
}
