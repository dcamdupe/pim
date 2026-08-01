using Pim.Api.Data;

namespace Pim.Api.Services;

public interface IInternalTransferMatcher
{
    // Flags any of addedTransactions that pair up with an inverted-amount transaction in a
    // different account within 5 days as "Internal Transfer", overriding the existing category
    // on both sides - including an already-stored transaction from a past import. loadedBuckets
    // are the TransactionMonth buckets FileProcessor already fetched/built for this import (and
    // will save itself); this call may fetch and persist additional ("external") buckets outside
    // that set if a match is found there.
    Task MatchAsync(string email, List<Transaction> addedTransactions, IReadOnlyCollection<TransactionMonth> loadedBuckets);
}
