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
    private readonly ILogger<CsvProcessor> _logger;

    public CsvProcessor(ICSVParserFactory csvParserFactory, IRepository<TransactionMonth> transactionMonths, ILogger<CsvProcessor> logger)
    {
        _csvParserFactory = csvParserFactory;
        _transactionMonths = transactionMonths;
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

        foreach (var group in transactions.GroupBy(t => (t.Date.Year, t.Date.Month)))
        {
            var id = TransactionMonth.BuildId(email, group.Key.Year, group.Key.Month);
            var month = await _transactionMonths.GetAsync(id);
            if (month is null)
            {
                month = new TransactionMonth { Email = email, Year = group.Key.Year, Month = group.Key.Month };
                month.Transactions.AddRange(group);
                await _transactionMonths.AddAsync(month);
            }
            else
            {
                month.Transactions.AddRange(group);
                await _transactionMonths.UpdateAsync(id, month);
            }
        }

        _logger.LogInformation("Transaction upload response: email={Email} count={Count}", email, transactions.Count);
    }
}
