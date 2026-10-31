using Pim.Api.Data;

namespace Pim.Api.Services;

public interface ITransactionUpdateService
{
    Task UpdateTransactionsAsync(string email, List<Transaction> transactions);

    // These take the caller's already-loaded user, so they don't re-read it.
    Task ApplyDescriptionMappingAsync(User user, string descriptionStart, string category);

    Task DeleteTransactionsForAccountAsync(User user, string accountName);

    Task RemoveCategoryFromTransactionsAsync(User user, string categoryName);
}
