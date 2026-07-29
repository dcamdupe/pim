using System.Globalization;
using CsvHelper;
using Pim.Api.Data;

namespace Pim.Api.Services.CSVParsers;

public sealed class TmBankCsvParser : ICsvParser
{
    private const string DateFormat = "dd MMM yyyy";

    private readonly CsvReader _csv;

    public TmBankCsvParser(CsvReader csv)
    {
        _csv = csv;
    }

    public List<Transaction> Parse(string account)
    {
        _csv.Read(); // discard header row

        var transactions = new List<Transaction>();
        while (_csv.Read())
        {
            var dateField = _csv.GetField(0);
            if (string.IsNullOrWhiteSpace(dateField))
            {
                continue; // skip blank trailing lines
            }

            transactions.Add(new Transaction
            {
                Account = account,
                Date = DateOnly.ParseExact(dateField.Trim(), DateFormat, CultureInfo.InvariantCulture),
                Description = _csv.GetField(2) ?? string.Empty,
                Category = string.Empty,
                Amount = decimal.Parse(
                    _csv.GetField(4)!.Trim(),
                    NumberStyles.Number | NumberStyles.AllowCurrencySymbol | NumberStyles.AllowParentheses,
                    CultureInfo.InvariantCulture),
            });
        }

        return transactions;
    }
}
