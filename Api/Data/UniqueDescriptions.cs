using Pim.Api.Repository;

namespace Pim.Api.Data;

public sealed class UniqueDescriptions
{
    [Id]
    public required string Email { get; set; }

    public List<string> Descriptions { get; set; } = [];
}
