using Pim.Api.Data;

namespace Pim.Api.Services;

public interface ITransactionUpdateService
{
    Task UpdateTransactionsAsync(string email, List<Transaction> transactions);

    Task ApplyCreditDescriptionMappingAsync(string email, string descriptionStart, string category);
}
