using Pim.Api.Data;
using Pim.Api.Repository;

namespace Pim.Api.Services;

public sealed class TransactionUpdateService : ITransactionUpdateService
{
    private readonly IRepository<TransactionMonth> _transactionMonths;
    private readonly IRepository<CreditDescriptionMapping> _creditDescriptionMappings;
    private readonly ITransactionQueryService _transactionQueryService;

    public TransactionUpdateService(
        IRepository<TransactionMonth> transactionMonths,
        IRepository<CreditDescriptionMapping> creditDescriptionMappings,
        ITransactionQueryService transactionQueryService)
    {
        _transactionMonths = transactionMonths;
        _creditDescriptionMappings = creditDescriptionMappings;
        _transactionQueryService = transactionQueryService;
    }

    public async Task UpdateTransactionsAsync(string email, List<Transaction> transactions)
    {
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
                    bucket.Transactions[index] = updated;
                    changed = true;
                }
            }

            if (changed)
            {
                await _transactionMonths.UpdateAsync(id, bucket);
            }
        }
    }

    public async Task ApplyCreditDescriptionMappingAsync(string email, string descriptionStart, string category)
    {
        await UpsertMappingAsync(email, descriptionStart, category);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var allTransactions = await _transactionQueryService.GetTransactionsAsync(email, startDate: null, endDate: today);

        var affectedMonths = allTransactions
            .Where(t => t.Description.StartsWith(descriptionStart, StringComparison.Ordinal))
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
            foreach (var transaction in bucket.Transactions)
            {
                if (transaction.Description.StartsWith(descriptionStart, StringComparison.Ordinal))
                {
                    transaction.Category = category;
                    changed = true;
                }
            }

            if (changed)
            {
                await _transactionMonths.UpdateAsync(id, bucket);
            }
        }
    }

    private async Task UpsertMappingAsync(string email, string descriptionStart, string category)
    {
        var mapping = await _creditDescriptionMappings.GetAsync(email);
        var isNew = mapping is null;
        mapping ??= new CreditDescriptionMapping { Email = email };

        var entry = mapping.Mappings.FirstOrDefault(m => m.DescriptionStart == descriptionStart);
        if (entry is not null)
        {
            entry.Category = category;
        }
        else
        {
            mapping.Mappings.Add(new CreditDescriptionMappingEntry { DescriptionStart = descriptionStart, Category = category });
        }

        if (isNew)
        {
            await _creditDescriptionMappings.AddAsync(mapping);
        }
        else
        {
            await _creditDescriptionMappings.UpdateAsync(email, mapping);
        }
    }
}
