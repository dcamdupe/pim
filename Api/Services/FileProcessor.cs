using Microsoft.AspNetCore.Http;
using Pim.Api.Data;
using Pim.Api.Repository;
using Pim.Api.Services.FileParsers;

namespace Pim.Api.Services;

public sealed class FileProcessor : IFileProcessor
{
    private readonly IFileParserFactory _fileParserFactory;
    private readonly IRepository<TransactionMonth> _transactionMonths;
    private readonly IRepository<User> _users;
    private readonly IRepository<TransactionDescriptions> _transactionDescriptions;
    private readonly IRepository<DescriptionMapping> _descriptionMappings;
    private readonly IInternalTransferMatcher _internalTransferMatcher;
    private readonly ILogger<FileProcessor> _logger;

    public FileProcessor(
        IFileParserFactory fileParserFactory,
        IRepository<TransactionMonth> transactionMonths,
        IRepository<User> users,
        IRepository<TransactionDescriptions> transactionDescriptions,
        IRepository<DescriptionMapping> descriptionMappings,
        IInternalTransferMatcher internalTransferMatcher,
        ILogger<FileProcessor> logger)
    {
        _fileParserFactory = fileParserFactory;
        _transactionMonths = transactionMonths;
        _users = users;
        _transactionDescriptions = transactionDescriptions;
        _descriptionMappings = descriptionMappings;
        _internalTransferMatcher = internalTransferMatcher;
        _logger = logger;
    }

    public async Task ProcessAsync(string email, string account, IFormFile file)
    {
        List<Transaction> transactions;
        try
        {
            using var stream = file.OpenReadStream();
            var parser = _fileParserFactory.Create(stream, file.FileName);
            transactions = parser.Parse(account);
        }
        catch (Exception ex)
        {
            // Broad catch deliberately: this is parsing an untrusted, user-uploaded file, where
            // many different exception types (FormatException, an unsupported file extension,
            // etc.) can legitimately arise from malformed data - all of them become one
            // FileParseException.
            _logger.LogWarning(ex, "Transaction upload: could not parse file: email={Email} account={Account}", email, account);
            throw new FileParseException("Could not parse the uploaded file.", ex);
        }

        _logger.LogInformation("Transaction upload request: email={Email} account={Account} count={Count}", email, account, transactions.Count);

        await ApplyDescriptionMappingAsync(email, transactions);

        var skippedDuplicates = 0;
        var addedTransactions = new List<Transaction>();
        var buckets = new List<(string Id, TransactionMonth Month, bool IsNew)>();

        foreach (var group in transactions.GroupBy(t => (t.Date.Year, t.Date.Month)))
        {
            var id = TransactionMonth.BuildId(email, group.Key.Year, group.Key.Month);
            var month = await _transactionMonths.GetAsync(id);
            var isNewMonth = month is null;
            month ??= new TransactionMonth { Email = email, Year = group.Key.Year, Month = group.Key.Month };

            var newTransactions = group.Where(t => !month.Transactions.Any(existing => IsDuplicate(existing, t))).ToList();
            skippedDuplicates += group.Count() - newTransactions.Count;
            month.Transactions.AddRange(newTransactions);
            addedTransactions.AddRange(newTransactions);
            buckets.Add((id, month, isNewMonth));
        }

        if (transactions.Count > 0)
        {
            await UpdateMinTransactionDateAsync(email, transactions.Min(t => t.Date));
        }

        await _internalTransferMatcher.MatchAsync(email, addedTransactions, buckets.Select(b => b.Month).ToList());

        foreach (var (id, month, isNewMonth) in buckets)
        {
            if (isNewMonth)
            {
                await _transactionMonths.AddAsync(month);
            }
            else
            {
                await _transactionMonths.UpdateAsync(id, month);
            }
        }

        await UpdateTransactionDescriptionStatsAsync(email, addedTransactions);

        _logger.LogInformation(
            "Transaction upload response: email={Email} count={Count} skippedDuplicates={SkippedDuplicates}",
            email, transactions.Count, skippedDuplicates);
    }

    private async Task UpdateMinTransactionDateAsync(string email, DateOnly candidateMinDate)
    {
        var user = await _users.GetAsync(email);
        if (user is null)
        {
            return;
        }

        if (user.MinTransactionDate is null || candidateMinDate < user.MinTransactionDate)
        {
            user.MinTransactionDate = candidateMinDate;
            await _users.UpdateAsync(email, user);
        }
    }

    // Applies any rules the user has already saved (via POST /mapping/description) to the
    // newly-parsed rows, before they're persisted - so a re-categorised merchant stays categorised
    // on every future statement import, not just the transactions that existed at the time.
    private async Task ApplyDescriptionMappingAsync(string email, List<Transaction> transactions)
    {
        var mapping = await _descriptionMappings.GetAsync(email);
        if (mapping is null || mapping.Mappings.Count == 0)
        {
            return;
        }

        foreach (var transaction in transactions)
        {
            // Prefer the most precise (longest DescriptionStart) match, matching the frontend's
            // approximate-match rule - a description can legitimately match more than one saved
            // rule (e.g. both a generic "COLES" and a more specific "COLES 0717" rule).
            var match = mapping.Mappings
                .Where(m => transaction.Description.StartsWith(m.DescriptionStart, StringComparison.Ordinal))
                .OrderByDescending(m => m.DescriptionStart.Length)
                .FirstOrDefault();

            if (match is not null)
            {
                transaction.Category = match.Category;
            }
        }
    }

    // Only called with genuinely new (non-duplicate) transactions - counts would otherwise
    // inflate if the same file (or an overlapping one) were uploaded more than once.
    private async Task UpdateTransactionDescriptionStatsAsync(string email, List<Transaction> addedTransactions)
    {
        if (addedTransactions.Count == 0)
        {
            return;
        }

        var descriptions = await _transactionDescriptions.GetAsync(email);
        var isNew = descriptions is null;
        descriptions ??= new TransactionDescriptions { Email = email };

        var statsByDescription = descriptions.Descriptions.ToDictionary(s => s.Description);

        foreach (var transaction in addedTransactions)
        {
            if (!statsByDescription.TryGetValue(transaction.Description, out var stat))
            {
                stat = new TransactionDescriptionStat { Description = transaction.Description };
                statsByDescription[transaction.Description] = stat;
                descriptions.Descriptions.Add(stat);
            }

            stat.TransactionCount++;
            if (string.IsNullOrEmpty(transaction.Category))
            {
                stat.UnclassifiedCount++;
            }
        }

        if (isNew)
        {
            await _transactionDescriptions.AddAsync(descriptions);
        }
        else
        {
            await _transactionDescriptions.UpdateAsync(email, descriptions);
        }
    }

    private static bool IsDuplicate(Transaction existing, Transaction candidate) =>
        Transaction.MatchesIdentity(existing, candidate);
}
