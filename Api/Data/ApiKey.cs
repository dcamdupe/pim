using Pim.Api.Repository;

namespace Pim.Api.Data;

// Stored in its own table keyed by the key string, so authenticating a request is a single
// GetItem on the presented key. User.ApiKey holds the same value for display and to find the
// superseded row when regenerating.
public sealed class ApiKey
{
    [Id]
    public required string Key { get; set; }

    public required string Email { get; set; }
}
