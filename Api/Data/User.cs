using Pim.Api.Repository;

namespace Pim.Api.Data;

public sealed class User
{
    [Id]
    public required string Email { get; set; }

    public required string PasswordHash { get; set; }

    public List<Account> Accounts { get; set; } = [];

    public List<Category> Categories { get; set; } = [];

    public DateOnly? MinTransactionDate { get; set; }
}
