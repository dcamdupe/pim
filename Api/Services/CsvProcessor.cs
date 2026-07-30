using System.Globalization;
using CsvHelper;
using CsvHelper.Configuration;
using Microsoft.AspNetCore.Http;
using Pim.Api.Data;
using Pim.Api.Repository;
using Pim.Api.Services.CSVParsers;

namespace Pim.Api.Services;

public sealed class CsvProcessor : ICsvProcessor
{
    private readonly ICSVParserFactory _csvParserFactory;
    private readonly IRepository<TransactionMonth> _transactionMonths;
    private readonly IRepository<User> _users;
    private readonly IRepository<TransactionDescriptions> _transactionDescriptions;
    private readonly IRepository<CreditDescriptionMapping> _creditDescriptionMappings;
    private readonly ILogger<CsvProcessor> _logger;

    public CsvProcessor(
        ICSVParserFactory csvParserFactory,
        IRepository<TransactionMonth> transactionMonths,
        IRepository<User> users,
        IRepository<TransactionDescriptions> transactionDescriptions,
        IRepository<CreditDescriptionMapping> creditDescriptionMappings,
        ILogger<CsvProcessor> logger)
    {
        _csvParserFactory = csvParserFactory;
        _transactionMonths = transactionMonths;
        _users = users;
        _transactionDescriptions = transactionDescriptions;
        _creditDescriptionMappings = creditDescriptionMappings;
        _logger = logger;
    }

    public async Task ProcessAsync(string email, string account, IFormFile file)
    {
        List<Transaction> transactions;
        try
        {
            using var reader = new StreamReader(file.OpenReadStream());
            using var csv = new CsvReader(reader, new CsvConfiguration(CultureInfo.InvariantCulture) { HasHeaderRecord = false });
            var parser = _csvParserFactory.Create(csv);
            transactions = parser.Parse(account);
        }
        catch (Exception ex)
        {
            // Broad catch deliberately: this is parsing an untrusted, user-uploaded file, where
            // many different exception types (CsvHelper's own, FormatException, etc.) can
            // legitimately arise from malformed data - all of them become one CsvParseException.
            _logger.LogWarning(ex, "Transaction upload: could not parse file: email={Email} account={Account}", email, account);
            throw new CsvParseException("Could not parse the uploaded file.", ex);
        }

        _logger.LogInformation("Transaction upload request: email={Email} account={Account} count={Count}", email, account, transactions.Count);

        await ApplyCreditDescriptionMappingAsync(email, transactions);

        var skippedDuplicates = 0;

        foreach (var group in transactions.GroupBy(t => (t.Date.Year, t.Date.Month)))
        {
            var id = TransactionMonth.BuildId(email, group.Key.Year, group.Key.Month);
            var month = await _transactionMonths.GetAsync(id);
            var isNewMonth = month is null;
            month ??= new TransactionMonth { Email = email, Year = group.Key.Year, Month = group.Key.Month };

            var newTransactions = group.Where(t => !month.Transactions.Any(existing => IsDuplicate(existing, t))).ToList();
            skippedDuplicates += group.Count() - newTransactions.Count;
            month.Transactions.AddRange(newTransactions);

            if (isNewMonth)
            {
                await _transactionMonths.AddAsync(month);
            }
            else
            {
                await _transactionMonths.UpdateAsync(id, month);
            }
        }

        if (transactions.Count > 0)
        {
            await UpdateMinTransactionDateAsync(email, transactions.Min(t => t.Date));
        }

        await AddNewTransactionDescriptionsAsync(email, transactions);

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

    // Applies any rules the user has already saved (via POST /mapping/credit) to the
    // newly-parsed rows, before they're persisted - so a re-categorised merchant stays categorised
    // on every future statement import, not just the transactions that existed at the time.
    private async Task ApplyCreditDescriptionMappingAsync(string email, List<Transaction> transactions)
    {
        var mapping = await _creditDescriptionMappings.GetAsync(email);
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

    private async Task AddNewTransactionDescriptionsAsync(string email, List<Transaction> transactions)
    {
        var descriptions = await _transactionDescriptions.GetAsync(email);
        var isNew = descriptions is null;
        descriptions ??= new TransactionDescriptions { Email = email };

        var existing = new HashSet<string>(descriptions.Descriptions);
        var newDescriptions = transactions.Select(t => t.Description).Distinct().Where(d => !existing.Contains(d)).ToList();

        if (newDescriptions.Count == 0)
        {
            return;
        }

        descriptions.Descriptions.AddRange(newDescriptions);

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
