namespace Pim.Api.Data;

public sealed class Transaction
{
    public required string Account { get; set; }

    public required DateOnly Date { get; set; }

    public required string Description { get; set; }

    public required string Category { get; set; }

    public required decimal Amount { get; set; }
}
