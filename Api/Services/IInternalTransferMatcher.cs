using Pim.Api.Data;

namespace Pim.Api.Services;

public interface IInternalTransferMatcher
{
    // Flags matching pairs of addedTransactions as "Internal Transfer", overriding their category.
    // May fetch/persist additional buckets outside loadedBuckets if a match is found there.
    Task MatchAsync(string email, List<Transaction> addedTransactions, IReadOnlyCollection<TransactionMonth> loadedBuckets);
}
