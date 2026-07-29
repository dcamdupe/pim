using Pim.Api.Data;
using Pim.Api.Repository;

namespace Pim.Api.Services;

public sealed class TransactionQueryService : ITransactionQueryService
{
    private readonly IRepository<TransactionMonth> _transactionMonths;

    public TransactionQueryService(IRepository<TransactionMonth> transactionMonths)
    {
        _transactionMonths = transactionMonths;
    }

    public async Task<List<Transaction>> GetTransactionsAsync(string email, DateOnly startDate, DateOnly endDate)
    {
        var transactions = new List<Transaction>();

        foreach (var (year, month) in EnumerateMonths(startDate, endDate))
        {
            var id = TransactionMonth.BuildId(email, year, month);
            var bucket = await _transactionMonths.GetAsync(id);
            if (bucket is not null)
            {
                transactions.AddRange(bucket.Transactions);
            }
        }

        return transactions
            .Where(t => t.Date >= startDate && t.Date <= endDate)
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
