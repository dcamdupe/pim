using Pim.Api.Data;
using Pim.Api.Repository;

namespace Pim.Api.Services;

public sealed class InternalTransferMatcher : IInternalTransferMatcher
{
    public const string CategoryName = "Internal Transfer";

    private const int MatchWindowDays = 5;

    private readonly IRepository<TransactionMonth> _transactionMonths;
    private readonly IRepository<TransactionDescriptions> _transactionDescriptions;

    public InternalTransferMatcher(IRepository<TransactionMonth> transactionMonths, IRepository<TransactionDescriptions> transactionDescriptions)
    {
        _transactionMonths = transactionMonths;
        _transactionDescriptions = transactionDescriptions;
    }

    public async Task MatchAsync(string email, List<Transaction> addedTransactions, IReadOnlyCollection<TransactionMonth> loadedBuckets)
    {
        if (addedTransactions.Count == 0)
        {
            return;
        }

        var addedSet = new HashSet<Transaction>(addedTransactions);
        var externalBuckets = await FetchExternalBucketsAsync(email, addedTransactions, loadedBuckets);

        var externalTransactionSource = new Dictionary<Transaction, TransactionMonth>();
        foreach (var bucket in externalBuckets.Values)
        {
            foreach (var transaction in bucket.Transactions)
            {
                externalTransactionSource[transaction] = bucket;
            }
        }

        var candidates = loadedBuckets.SelectMany(b => b.Transactions)
            .Concat(externalBuckets.Values.SelectMany(b => b.Transactions))
            .ToList();

        var matched = new HashSet<Transaction>();
        var dirtyExternalBuckets = new HashSet<TransactionMonth>();
        (TransactionDescriptions Descriptions, bool IsNew)? descriptionsContext = null;

        foreach (var added in addedTransactions)
        {
            if (matched.Contains(added))
            {
                continue;
            }

            var match = candidates.FirstOrDefault(candidate =>
                !ReferenceEquals(candidate, added) &&
                !matched.Contains(candidate) &&
                candidate.Account != added.Account &&
                candidate.Amount == -added.Amount &&
                Math.Abs(candidate.Date.DayNumber - added.Date.DayNumber) <= MatchWindowDays);

            if (match is null)
            {
                continue;
            }

            var previousMatchCategory = match.Category;
            added.Category = CategoryName;
            match.Category = CategoryName;
            matched.Add(added);
            matched.Add(match);

            if (!addedSet.Contains(match))
            {
                descriptionsContext ??= await LoadDescriptionsAsync(email);
                TransactionDescriptionStatsHelper.AdjustUnclassifiedCount(descriptionsContext.Value.Descriptions, match.Description, previousMatchCategory, CategoryName);
            }

            if (externalTransactionSource.TryGetValue(match, out var sourceBucket))
            {
                dirtyExternalBuckets.Add(sourceBucket);
            }
        }

        foreach (var bucket in dirtyExternalBuckets)
        {
            await _transactionMonths.UpdateAsync(bucket.Id, bucket);
        }

        if (descriptionsContext is not null)
        {
            await SaveDescriptionsAsync(email, descriptionsContext.Value.Descriptions, descriptionsContext.Value.IsNew);
        }
    }

    // Only the month buckets that could possibly contain a match (added-transaction dates ± the
    // match window) are fetched here - not the user's whole history - and only the ones
    // FileProcessor hasn't already loaded for this import.
    private async Task<Dictionary<string, TransactionMonth>> FetchExternalBucketsAsync(
        string email, List<Transaction> addedTransactions, IReadOnlyCollection<TransactionMonth> loadedBuckets)
    {
        var loadedIds = loadedBuckets.Select(b => b.Id).ToHashSet();
        var minDate = addedTransactions.Min(t => t.Date).AddDays(-MatchWindowDays);
        var maxDate = addedTransactions.Max(t => t.Date).AddDays(MatchWindowDays);

        var externalBuckets = new Dictionary<string, TransactionMonth>();
        foreach (var (year, month) in MonthsInRange(minDate, maxDate))
        {
            var id = TransactionMonth.BuildId(email, year, month);
            if (loadedIds.Contains(id))
            {
                continue;
            }

            var bucket = await _transactionMonths.GetAsync(id);
            if (bucket is not null)
            {
                externalBuckets[id] = bucket;
            }
        }

        return externalBuckets;
    }

    private static IEnumerable<(int Year, int Month)> MonthsInRange(DateOnly start, DateOnly end)
    {
        var year = start.Year;
        var month = start.Month;
        while (year < end.Year || (year == end.Year && month <= end.Month))
        {
            yield return (year, month);
            month++;
            if (month > 12)
            {
                month = 1;
                year++;
            }
        }
    }

    private async Task<(TransactionDescriptions Descriptions, bool IsNew)> LoadDescriptionsAsync(string email)
    {
        var descriptions = await _transactionDescriptions.GetAsync(email);
        var isNew = descriptions is null;
        descriptions ??= new TransactionDescriptions { Email = email };
        return (descriptions, isNew);
    }

    private async Task SaveDescriptionsAsync(string email, TransactionDescriptions descriptions, bool isNew)
    {
        if (isNew)
        {
            await _transactionDescriptions.AddAsync(descriptions);
        }
        else
        {
            await _transactionDescriptions.UpdateAsync(email, descriptions);
        }
    }
}
