using System.Collections.Concurrent;
using Pim.Api.Data;
using Pim.Api.Repository;

namespace Pim.Api.Services;

public sealed class TransactionQueryService : ITransactionQueryService
{
    private const int MaxParallelMonthFetches = 5;

    private readonly IRepository<TransactionMonth> _transactionMonths;
    private readonly IRepository<User> _users;

    public TransactionQueryService(IRepository<TransactionMonth> transactionMonths, IRepository<User> users)
    {
        _transactionMonths = transactionMonths;
        _users = users;
    }

    public async Task<List<Transaction>> GetTransactionsAsync(string email, DateOnly? startDate, DateOnly endDate)
    {
        var effectiveStartDate = startDate ?? (await _users.GetAsync(email))?.MinTransactionDate;
        if (effectiveStartDate is null)
        {
            return [];
        }

        var transactions = new ConcurrentBag<Transaction>();

        await Parallel.ForEachAsync(
            EnumerateMonths(effectiveStartDate.Value, endDate),
            new ParallelOptions { MaxDegreeOfParallelism = MaxParallelMonthFetches },
            async (month, _) =>
            {
                var id = TransactionMonth.BuildId(email, month.Year, month.Month);
                var bucket = await _transactionMonths.GetAsync(id);
                if (bucket is not null)
                {
                    foreach (var transaction in bucket.Transactions)
                    {
                        transactions.Add(transaction);
                    }
                }
            });

        return transactions
            .Where(t => t.Date >= effectiveStartDate.Value && t.Date <= endDate)
            .OrderByDescending(t => t.Date)
            .ToList();
    }

    private static IEnumerable<(int Year, int Month)> EnumerateMonths(DateOnly start, DateOnly end)
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
}
