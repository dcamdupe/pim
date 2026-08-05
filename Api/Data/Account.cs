namespace Pim.Api.Data;

public sealed class Account
{
    public required string Name { get; set; }

    public required AccountType Type { get; set; }

    public enum AccountType
    {
        Credit,
        Transaction,
        Savings,
    }
}
