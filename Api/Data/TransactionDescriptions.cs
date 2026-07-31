using Pim.Api.Repository;

namespace Pim.Api.Data;

public sealed class TransactionDescriptions
{
    [Id]
    public required string Email { get; set; }

    public List<TransactionDescriptionStat> Descriptions { get; set; } = [];
}

public sealed class TransactionDescriptionStat
{
    public required string Description { get; set; }

    public int TransactionCount { get; set; }

    public int UnclassifiedCount { get; set; }
}
