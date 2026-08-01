using Pim.Api.Data;
using Pim.Api.Services;

namespace Pim.Api.UnitTests.Services;

public class TransactionDescriptionStatsHelperTests
{
    [Fact]
    public void AdjustUnclassifiedCount_Decrements_WhenATransactionBecomesClassified()
    {
        var descriptions = new TransactionDescriptions
        {
            Email = "dave@example.com",
            Descriptions = [new TransactionDescriptionStat { Description = "Coffee Shop", TransactionCount = 1, UnclassifiedCount = 1 }],
        };

        TransactionDescriptionStatsHelper.AdjustUnclassifiedCount(descriptions, "Coffee Shop", previousCategory: "", newCategory: "Dining");

        Assert.Equal(0, Assert.Single(descriptions.Descriptions).UnclassifiedCount);
    }

    [Fact]
    public void AdjustUnclassifiedCount_Increments_WhenATransactionBecomesUnclassified()
    {
        var descriptions = new TransactionDescriptions
        {
            Email = "dave@example.com",
            Descriptions = [new TransactionDescriptionStat { Description = "Coffee Shop", TransactionCount = 1, UnclassifiedCount = 0 }],
        };

        TransactionDescriptionStatsHelper.AdjustUnclassifiedCount(descriptions, "Coffee Shop", previousCategory: "Dining", newCategory: "");

        Assert.Equal(1, Assert.Single(descriptions.Descriptions).UnclassifiedCount);
    }

    [Fact]
    public void AdjustUnclassifiedCount_LeavesCountUnchanged_WhenRecategorisingAnAlreadyClassifiedTransaction()
    {
        var descriptions = new TransactionDescriptions
        {
            Email = "dave@example.com",
            Descriptions = [new TransactionDescriptionStat { Description = "Coffee Shop", TransactionCount = 1, UnclassifiedCount = 0 }],
        };

        TransactionDescriptionStatsHelper.AdjustUnclassifiedCount(descriptions, "Coffee Shop", previousCategory: "Shopping", newCategory: "Dining");

        Assert.Equal(0, Assert.Single(descriptions.Descriptions).UnclassifiedCount);
    }

    [Fact]
    public void AdjustUnclassifiedCount_AddsANewStat_WhenTheDescriptionHasNoExistingEntry()
    {
        var descriptions = new TransactionDescriptions { Email = "dave@example.com" };

        TransactionDescriptionStatsHelper.AdjustUnclassifiedCount(descriptions, "Coffee Shop", previousCategory: "", newCategory: "Dining");

        var stat = Assert.Single(descriptions.Descriptions);
        Assert.Equal("Coffee Shop", stat.Description);
        Assert.Equal(-1, stat.UnclassifiedCount);
    }
}
