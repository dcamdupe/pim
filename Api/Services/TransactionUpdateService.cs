using Pim.Api.Data;
using Pim.Api.Repository;

namespace Pim.Api.Services;

public sealed class TransactionUpdateService : ITransactionUpdateService
{
    private readonly IRepository<TransactionMonth> _transactionMonths;
    private readonly IRepository<DescriptionMapping> _descriptionMappings;
    private readonly IRepository<TransactionDescriptions> _transactionDescriptions;
    private readonly IRepository<User> _users;
    private readonly ITransactionQueryService _transactionQueryService;

    public TransactionUpdateService(
        IRepository<TransactionMonth> transactionMonths,
        IRepository<DescriptionMapping> descriptionMappings,
        IRepository<TransactionDescriptions> transactionDescriptions,
        IRepository<User> users,
        ITransactionQueryService transactionQueryService)
    {
        _transactionMonths = transactionMonths;
        _descriptionMappings = descriptionMappings;
        _transactionDescriptions = transactionDescriptions;
        _users = users;
        _transactionQueryService = transactionQueryService;
    }

    public async Task UpdateTransactionsAsync(string email, List<Transaction> transactions)
    {
        (TransactionDescriptions Descriptions, bool IsNew)? descriptionsContext = null;
        List<Category>? categories = null;

        foreach (var group in transactions.GroupBy(t => (t.Date.Year, t.Date.Month)))
        {
            var id = TransactionMonth.BuildId(email, group.Key.Year, group.Key.Month);
            var bucket = await _transactionMonths.GetAsync(id);
            if (bucket is null)
            {
                continue;
            }

            var changed = false;
            foreach (var updated in group)
            {
                var index = bucket.Transactions.FindIndex(existing => Transaction.MatchesIdentity(existing, updated));
                if (index >= 0)
                {
                    var previousCategory = bucket.Transactions[index].Category;
                    bucket.Transactions[index] = updated;
                    changed = true;

                    if (previousCategory != updated.Category)
                    {
                        categories ??= await LoadCategoriesAsync(email);
                        Category.StampTransaction(updated, categories);

                        descriptionsContext ??= await LoadDescriptionsAsync(email);
                        TransactionDescriptionStatsHelper.AdjustUnclassifiedCount(descriptionsContext.Value.Descriptions, updated.Description, previousCategory, updated.Category);
                    }
                }
            }

            if (changed)
            {
                await _transactionMonths.UpdateAsync(id, bucket);
            }
        }

        if (descriptionsContext is not null)
        {
            await SaveDescriptionsAsync(email, descriptionsContext.Value.Descriptions, descriptionsContext.Value.IsNew);
        }
    }

    public async Task ApplyDescriptionMappingAsync(string email, string descriptionStart, string category)
    {
        await UpsertMappingAsync(email, descriptionStart, category);

        var allTransactions = await _transactionQueryService.GetTransactionsAsync(email, startDate: null, endDate: UnboundedEndDate());

        var affectedMonths = allTransactions
            .Where(t => t.Description.StartsWith(descriptionStart, StringComparison.Ordinal))
            .Select(t => (t.Date.Year, t.Date.Month))
            .Distinct();

        (TransactionDescriptions Descriptions, bool IsNew)? descriptionsContext = null;
        List<Category>? categories = null;

        foreach (var (year, month) in affectedMonths)
        {
            var id = TransactionMonth.BuildId(email, year, month);
            var bucket = await _transactionMonths.GetAsync(id);
            if (bucket is null)
            {
                continue;
            }

            var changed = false;
            foreach (var transaction in bucket.Transactions)
            {
                if (!transaction.Description.StartsWith(descriptionStart, StringComparison.Ordinal) || transaction.Category == category)
                {
                    continue;
                }

                descriptionsContext ??= await LoadDescriptionsAsync(email);
                TransactionDescriptionStatsHelper.AdjustUnclassifiedCount(descriptionsContext.Value.Descriptions, transaction.Description, transaction.Category, category);

                transaction.Category = category;
                categories ??= await LoadCategoriesAsync(email);
                Category.StampTransaction(transaction, categories);
                changed = true;
            }

            if (changed)
            {
                await _transactionMonths.UpdateAsync(id, bucket);
            }
        }

        if (descriptionsContext is not null)
        {
            await SaveDescriptionsAsync(email, descriptionsContext.Value.Descriptions, descriptionsContext.Value.IsNew);
        }
    }

    // Description-stats (TransactionCount/UnclassifiedCount) are deliberately left untouched here -
    // they're soft heuristic counters for description matching, not financial data, and going
    // slightly stale on account deletion is an accepted simplification.
    public async Task DeleteTransactionsForAccountAsync(string email, string accountName)
    {
        var allTransactions = await _transactionQueryService.GetTransactionsAsync(email, startDate: null, endDate: UnboundedEndDate());

        var affectedMonths = allTransactions
            .Where(t => t.Account == accountName)
            .Select(t => (t.Date.Year, t.Date.Month))
            .Distinct();

        foreach (var (year, month) in affectedMonths)
        {
            var id = TransactionMonth.BuildId(email, year, month);
            var bucket = await _transactionMonths.GetAsync(id);
            if (bucket is null)
            {
                continue;
            }

            var remaining = bucket.Transactions.Where(t => t.Account != accountName).ToList();
            if (remaining.Count != bucket.Transactions.Count)
            {
                bucket.Transactions = remaining;
                await _transactionMonths.UpdateAsync(id, bucket);
            }
        }
    }

    // Declassifies matching transactions (clears Category to "") rather than deleting them - unlike
    // account removal, removing a category shouldn't destroy financial data. Description-stats are
    // deliberately left untouched here for the same reason as DeleteTransactionsForAccountAsync.
    public async Task RemoveCategoryFromTransactionsAsync(string email, string categoryName)
    {
        var allTransactions = await _transactionQueryService.GetTransactionsAsync(email, startDate: null, endDate: UnboundedEndDate());

        var affectedMonths = allTransactions
            .Where(t => t.Category == categoryName)
            .Select(t => (t.Date.Year, t.Date.Month))
            .Distinct();

        foreach (var (year, month) in affectedMonths)
        {
            var id = TransactionMonth.BuildId(email, year, month);
            var bucket = await _transactionMonths.GetAsync(id);
            if (bucket is null)
            {
                continue;
            }

            var changed = false;
            foreach (var transaction in bucket.Transactions.Where(t => t.Category == categoryName))
            {
                transaction.Category = string.Empty;
                transaction.Type = null;
                transaction.Inactive = null;
                changed = true;
            }

            if (changed)
            {
                await _transactionMonths.UpdateAsync(id, bucket);
            }
        }
    }

    // These callers all want "every transaction, unbounded" - GetTransactionsAsync just requires a
    // concrete endDate, so this stands in for "no upper bound" rather than a real cutoff. A plain
    // UTC "today" undercounts: local time can run up to ~14 hours ahead of UTC, so a transaction
    // dated "today" in the caller's real timezone can still be "tomorrow" from UTC's point of view
    // until UTC catches up - silently excluding it from GetTransactionsAsync's `t.Date <= endDate`
    // filter. Padding by a few days comfortably covers that gap without needing to know the user's
    // actual timezone.
    private static DateOnly UnboundedEndDate() => DateOnly.FromDateTime(DateTime.UtcNow).AddDays(3);

    private async Task<List<Category>> LoadCategoriesAsync(string email)
    {
        var user = await _users.GetAsync(email);
        return user?.Categories ?? [];
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

    private async Task UpsertMappingAsync(string email, string descriptionStart, string category)
    {
        var mapping = await _descriptionMappings.GetAsync(email);
        var isNew = mapping is null;
        mapping ??= new DescriptionMapping { Email = email };

        var entry = mapping.Mappings.FirstOrDefault(m => m.DescriptionStart == descriptionStart);
        if (entry is not null)
        {
            entry.Category = category;
        }
        else
        {
            mapping.Mappings.Add(new DescriptionMappingEntry { DescriptionStart = descriptionStart, Category = category });
        }

        if (isNew)
        {
            await _descriptionMappings.AddAsync(mapping);
        }
        else
        {
            await _descriptionMappings.UpdateAsync(email, mapping);
        }
    }
}
