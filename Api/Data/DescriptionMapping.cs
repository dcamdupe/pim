using Pim.Api.Repository;

namespace Pim.Api.Data;

public sealed class DescriptionMapping
{
    [Id]
    public required string Email { get; set; }

    public List<DescriptionMappingEntry> Mappings { get; set; } = [];
}

public sealed class DescriptionMappingEntry
{
    public required string DescriptionStart { get; set; }

    public required string Category { get; set; }
}
