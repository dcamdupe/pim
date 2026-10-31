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

        var ids = EnumerateMonths(effectiveStartDate.Value, endDate)
            .Select(month => TransactionMonth.BuildId(email, month.Year, month.Month));
        var buckets = await _transactionMonths.GetManyAsync(ids);

        return buckets
            .SelectMany(bucket => bucket.Transactions)
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
