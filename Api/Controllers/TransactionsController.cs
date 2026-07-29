using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Pim.Api.Data;
using Pim.Api.Services;

namespace Pim.Api.Controllers;

[ApiController]
[Authorize]
public sealed class TransactionsController : ControllerBase
{
    private readonly ICsvProcessor _csvProcessor;
    private readonly ITransactionQueryService _transactionQueryService;

    public TransactionsController(ICsvProcessor csvProcessor, ITransactionQueryService transactionQueryService)
    {
        _csvProcessor = csvProcessor;
        _transactionQueryService = transactionQueryService;
    }

    [HttpPost("transactions/file")]
    public async Task<IActionResult> UploadFile([FromForm] UploadTransactionsRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Account) || request.File.Length == 0)
        {
            return BadRequest();
        }

        var email = HttpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)!;

        try
        {
            await _csvProcessor.ProcessAsync(email, request.Account, request.File);
        }
        catch (CsvParseException)
        {
            return BadRequest("Could not parse the uploaded file.");
        }

        return NoContent();
    }

    [HttpGet("transactions")]
    public async Task<ActionResult<TransactionsResponse>> GetTransactions([FromQuery] DateOnly? startDate, [FromQuery] DateOnly? endDate)
    {
        if (startDate is null || endDate is null || startDate > endDate)
        {
            return BadRequest();
        }

        var email = HttpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var transactions = await _transactionQueryService.GetTransactionsAsync(email, startDate.Value, endDate.Value);

        return Ok(new TransactionsResponse(transactions));
    }
}

public sealed class UploadTransactionsRequest
{
    public required string Account { get; set; }

    public required IFormFile File { get; set; }
}

public sealed record TransactionsResponse(List<Transaction> Transactions);
