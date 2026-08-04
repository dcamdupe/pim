using Pim.Api.Data;
using Pim.Api.Repository;

namespace Pim.Api.Services;

public sealed class InternalTransferMatcher : IInternalTransferMatcher
{
    public const string CategoryName = "Internal Transfer";

    private const int MatchWindowBusinessDays = 2;
    private const string BpayKeyword = "BPAY";
    private const string TransferKeyword = "transfer";

    private readonly IRepository<TransactionMonth> _transactionMonths;
    private readonly IRepository<TransactionDescriptions> _transactionDescriptions;
    private readonly IRepository<User> _users;

    public InternalTransferMatcher(
        IRepository<TransactionMonth> transactionMonths,
        IRepository<TransactionDescriptions> transactionDescriptions,
        IRepository<User> users)
    {
        _transactionMonths = transactionMonths;
        _transactionDescriptions = transactionDescriptions;
        _users = users;
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
        List<Category>? categories = null;

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
                BusinessDaysBetween(candidate.Date, added.Date) <= MatchWindowBusinessDays &&
                HasQualifyingDescription(candidate, added));

            if (match is null)
            {
                continue;
            }

            var previousMatchCategory = match.Category;
            added.Category = CategoryName;
            match.Category = CategoryName;
            categories ??= (await _users.GetAsync(email))?.Categories ?? [];
            Category.StampTransaction(added, categories);
            Category.StampTransaction(match, categories);
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
        // 2 business days can span up to 4 calendar days (e.g. Friday -> the following Tuesday),
        // so the bucket prefetch window needs that much slack even though the actual match check
        // below is business-day based, not calendar-day based.
        const int prefetchCalendarDayBuffer = 4;
        var loadedIds = loadedBuckets.Select(b => b.Id).ToHashSet();
        var minDate = addedTransactions.Min(t => t.Date).AddDays(-prefetchCalendarDayBuffer);
        var maxDate = addedTransactions.Max(t => t.Date).AddDays(prefetchCalendarDayBuffer);

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

    // Counts weekdays strictly after the earlier date, up to and including the later date (so two
    // dates on the same day are 0 apart, consecutive weekdays are 1 apart, and a weekend in
    // between doesn't count towards the total).
    private static int BusinessDaysBetween(DateOnly a, DateOnly b)
    {
        var (earlier, later) = a <= b ? (a, b) : (b, a);
        var businessDays = 0;

        for (var date = earlier; date < later; date = date.AddDays(1))
        {
            var next = date.AddDays(1);
            if (next.DayOfWeek is not (DayOfWeek.Saturday or DayOfWeek.Sunday))
            {
                businessDays++;
            }
        }

        return businessDays;
    }

    // At least one of: the `+` amount side's description mentions BPAY, or the `-` amount side's
    // description mentions "transfer" - case-insensitive either way, since real bank-statement
    // text case isn't something a matching rule should be sensitive to.
    private static bool HasQualifyingDescription(Transaction x, Transaction y)
    {
        var (positive, negative) = x.Amount > 0 ? (x, y) : (y, x);
        return positive.Description.Contains(BpayKeyword, StringComparison.OrdinalIgnoreCase) ||
            negative.Description.Contains(TransferKeyword, StringComparison.OrdinalIgnoreCase);
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
