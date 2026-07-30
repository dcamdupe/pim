using Pim.Api.Data;
using Pim.Api.Repository;

namespace Pim.Api.Services;

public sealed class TransactionQueryService : ITransactionQueryService
{
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

        var transactions = new List<Transaction>();

        foreach (var (year, month) in EnumerateMonths(effectiveStartDate.Value, endDate))
        {
            var id = TransactionMonth.BuildId(email, year, month);
            var bucket = await _transactionMonths.GetAsync(id);
            if (bucket is not null)
            {
                transactions.AddRange(bucket.Transactions);
            }
        }

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
