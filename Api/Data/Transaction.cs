namespace Pim.Api.Data;

public sealed class Transaction
{
    public required string Account { get; set; }

    public required DateOnly Date { get; set; }

    public required string Description { get; set; }

    public required string Category { get; set; }

    public required decimal Amount { get; set; }

    // Date+Description+Amount+Account is the closest thing this app has to a stable identity for
    // a transaction (there's no surrogate id) - used both to skip re-uploaded duplicates and to
    // find which stored transaction a PUT /transactions edit refers to. Category is deliberately
    // excluded, since it's expected to be edited after import.
    public static bool MatchesIdentity(Transaction a, Transaction b) =>
        a.Date == b.Date &&
        a.Description == b.Description &&
        a.Amount == b.Amount &&
        a.Account == b.Account;
}
