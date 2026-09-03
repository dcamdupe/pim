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

    // The user's current API key (also stored as an ApiKey row, keyed by the value). Null until
    // one is generated via POST /settings/api.
    public string? ApiKey { get; set; }
}
