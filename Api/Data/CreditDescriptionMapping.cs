using Pim.Api.Repository;

namespace Pim.Api.Data;

public sealed class CreditDescriptionMapping
{
    [Id]
    public required string Email { get; set; }

    public List<CreditDescriptionMappingEntry> Mappings { get; set; } = [];
}

public sealed class CreditDescriptionMappingEntry
{
    public required string DescriptionStart { get; set; }

    public required string Category { get; set; }
}
