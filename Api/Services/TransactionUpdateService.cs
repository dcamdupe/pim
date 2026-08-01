using Pim.Api.Data;
using Pim.Api.Repository;

namespace Pim.Api.Services;

public sealed class TransactionUpdateService : ITransactionUpdateService
{
    private readonly IRepository<TransactionMonth> _transactionMonths;
    private readonly IRepository<DescriptionMapping> _descriptionMappings;
    private readonly IRepository<TransactionDescriptions> _transactionDescriptions;
    private readonly ITransactionQueryService _transactionQueryService;

    public TransactionUpdateService(
        IRepository<TransactionMonth> transactionMonths,
        IRepository<DescriptionMapping> descriptionMappings,
        IRepository<TransactionDescriptions> transactionDescriptions,
        ITransactionQueryService transactionQueryService)
    {
        _transactionMonths = transactionMonths;
        _descriptionMappings = descriptionMappings;
        _transactionDescriptions = transactionDescriptions;
        _transactionQueryService = transactionQueryService;
    }

    public async Task UpdateTransactionsAsync(string email, List<Transaction> transactions)
    {
        (TransactionDescriptions Descriptions, bool IsNew)? descriptionsContext = null;

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

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var allTransactions = await _transactionQueryService.GetTransactionsAsync(email, startDate: null, endDate: today);

        var affectedMonths = allTransactions
            .Where(t => t.Description.StartsWith(descriptionStart, StringComparison.Ordinal))
            .Select(t => (t.Date.Year, t.Date.Month))
            .Distinct();

        (TransactionDescriptions Descriptions, bool IsNew)? descriptionsContext = null;

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
