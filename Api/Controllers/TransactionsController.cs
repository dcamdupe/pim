using System.Globalization;
using System.Security.Claims;
using CsvHelper;
using CsvHelper.Configuration;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Pim.Api.Data;
using Pim.Api.Repository;

namespace Pim.Api.Controllers;

[ApiController]
[Authorize]
public sealed class TransactionsController : ControllerBase
{
    private const string DateFormat = "dd MMM yyyy";

    private readonly IRepository<TransactionMonth> _transactionMonths;
    private readonly ILogger<TransactionsController> _logger;

    public TransactionsController(IRepository<TransactionMonth> transactionMonths, ILogger<TransactionsController> logger)
    {
        _transactionMonths = transactionMonths;
        _logger = logger;
    }

    [HttpPost("transactions/file")]
    public async Task<IActionResult> UploadFile([FromForm] UploadTransactionsRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Account) || request.File.Length == 0)
        {
            return BadRequest();
        }

        List<Transaction> transactions;
        try
        {
            transactions = ParseCsv(request.Account, request.File);
        }
        catch (Exception ex)
        {
            // Broad catch deliberately: this is parsing an untrusted, user-uploaded file, where
            // many different exception types (CsvHelper's own, FormatException, etc.) can
            // legitimately arise from malformed data - all of them should become a 400, not a 500.
            _logger.LogWarning(ex, "Transaction upload: could not parse file {FileName}", request.File.FileName);
            return BadRequest("Could not parse the uploaded file.");
        }

        var email = HttpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        _logger.LogInformation("Transaction upload request: email={Email} account={Account} count={Count}", email, request.Account, transactions.Count);

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
        return NoContent();
    }

    private static List<Transaction> ParseCsv(string account, IFormFile file)
    {
        using var reader = new StreamReader(file.OpenReadStream());
        using var csv = new CsvReader(reader, new CsvConfiguration(CultureInfo.InvariantCulture) { HasHeaderRecord = false });

        csv.Read(); // discard header row

        var transactions = new List<Transaction>();
        while (csv.Read())
        {
            var dateField = csv.GetField(0);
            if (string.IsNullOrWhiteSpace(dateField))
            {
                continue; // skip blank trailing lines
            }

            transactions.Add(new Transaction
            {
                Account = account,
                Date = DateOnly.ParseExact(dateField.Trim(), DateFormat, CultureInfo.InvariantCulture),
                Description = csv.GetField(2) ?? string.Empty,
                Category = string.Empty,
                Amount = decimal.Parse(
                    csv.GetField(3)!.Trim(),
                    NumberStyles.Number | NumberStyles.AllowCurrencySymbol | NumberStyles.AllowParentheses,
                    CultureInfo.InvariantCulture),
            });
        }

        return transactions;
    }
}

public sealed class UploadTransactionsRequest
{
    public required string Account { get; set; }

    public required IFormFile File { get; set; }
}
