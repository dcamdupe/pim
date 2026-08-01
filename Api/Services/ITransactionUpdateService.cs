using Pim.Api.Data;

namespace Pim.Api.Services;

public interface ITransactionUpdateService
{
    Task UpdateTransactionsAsync(string email, List<Transaction> transactions);

    Task ApplyDescriptionMappingAsync(string email, string descriptionStart, string category);
}
