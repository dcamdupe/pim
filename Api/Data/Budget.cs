namespace Pim.Api.Data;

// A recurring monthly budget for one Expense category (UBE-119). Stored on User.Budgets.
public sealed class Budget
{
    public required string Category { get; set; }

    public required decimal Amount { get; set; }
}
