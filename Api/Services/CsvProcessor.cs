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
    private readonly ILogger<CsvProcessor> _logger;

    public CsvProcessor(
        ICSVParserFactory csvParserFactory,
        IRepository<TransactionMonth> transactionMonths,
        IRepository<User> users,
        ILogger<CsvProcessor> logger)
    {
        _csvParserFactory = csvParserFactory;
        _transactionMonths = transactionMonths;
        _users = users;
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

    // A transaction "overlaps" an existing one if it matches on date, description, amount, and
    // account - Category is deliberately excluded, since it's expected to be edited after import.
    private static bool IsDuplicate(Transaction existing, Transaction candidate) =>
        existing.Date == candidate.Date &&
        existing.Description == candidate.Description &&
        existing.Amount == candidate.Amount &&
        existing.Account == candidate.Account;
}
