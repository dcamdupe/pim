using Pim.Api.Data;

namespace Pim.Api.Services;

public interface ITransactionQueryService
{
    Task<List<Transaction>> GetTransactionsAsync(string email, DateOnly? startDate, DateOnly endDate);
}
