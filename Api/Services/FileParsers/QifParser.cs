using System.Globalization;
using Pim.Api.Data;

namespace Pim.Api.Services.FileParsers;

// QIF has no fixed field order or column count - each record is a run of "<tag><value>" lines
// (D=date, T=amount, P=payee, M=memo, plus others we don't use like N=number/L=class) terminated
// by a lone "^" line. Real exports vary in which of P/M actually carries the merchant text (see
// the worklog for this ticket) and in whether records are separated by a blank line, so this
// parses tag-by-tag rather than assuming a shape.
public sealed class QifParser : IFileParser
{
    private static readonly string[] DateFormats = ["dd/MM/yyyy", "dd/MM/yy"];

    private readonly Stream _fileStream;

    public QifParser(Stream fileStream)
    {
        _fileStream = fileStream;
    }

    public List<Transaction> Parse(string account)
    {
        var transactions = new List<Transaction>();
        using var reader = new StreamReader(_fileStream);
        string? date = null;
        string? payee = null;
        string? memo = null;
        decimal? amount = null;

        string? line;
        while ((line = reader.ReadLine()) != null)
        {
            if (line.Length == 0 || line[0] == '!')
            {
                continue; // blank separator lines (e.g. amex exports) and the leading !Type: header
            }

            var value = line[1..];
            switch (line[0])
            {
                case 'D':
                    date = value;
                    break;
                case 'P':
                    payee = value;
                    break;
                case 'M':
                    memo = value;
                    break;
                case 'T':
                    amount = decimal.Parse(value, NumberStyles.Number, CultureInfo.InvariantCulture);
                    break;
                case '^':
                    transactions.Add(new Transaction
                    {
                        Account = account,
                        Date = DateOnly.ParseExact(date!, DateFormats, CultureInfo.InvariantCulture),
                        Description = !string.IsNullOrWhiteSpace(payee) ? payee! : memo ?? string.Empty,
                        Category = string.Empty,
                        Amount = amount!.Value,
                    });
                    date = null;
                    payee = null;
                    memo = null;
                    amount = null;
                    break;
            }
        }

        return transactions;
    }
}
