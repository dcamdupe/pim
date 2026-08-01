using Pim.Api.Data;

namespace Pim.Api.Services;

// Every stat mutation for a description's classified/unclassified count goes through this one
// place, since the same description can be reached from the single-edit (PUT /transactions),
// bulk-apply (POST /mapping/description), and internal-transfer-matching (on import) paths.
public static class TransactionDescriptionStatsHelper
{
    public static void AdjustUnclassifiedCount(TransactionDescriptions descriptions, string description, string previousCategory, string newCategory)
    {
        var wasUnclassified = string.IsNullOrEmpty(previousCategory);
        var isUnclassified = string.IsNullOrEmpty(newCategory);
        if (wasUnclassified == isUnclassified)
        {
            return;
        }

        var stat = descriptions.Descriptions.FirstOrDefault(s => s.Description == description);
        if (stat is null)
        {
            stat = new TransactionDescriptionStat { Description = description };
            descriptions.Descriptions.Add(stat);
        }

        stat.UnclassifiedCount += wasUnclassified ? -1 : 1;
    }
}
