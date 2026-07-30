using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Pim.Api.Data;
using Pim.Api.Repository;
using Pim.Api.Services;

namespace Pim.Api.Controllers;

[ApiController]
[Authorize]
public sealed class TransactionsController : ControllerBase
{
    private readonly ICsvProcessor _csvProcessor;
    private readonly ITransactionQueryService _transactionQueryService;
    private readonly ITransactionUpdateService _transactionUpdateService;
    private readonly IRepository<UniqueDescriptions> _uniqueDescriptions;

    public TransactionsController(
        ICsvProcessor csvProcessor,
        ITransactionQueryService transactionQueryService,
        ITransactionUpdateService transactionUpdateService,
        IRepository<UniqueDescriptions> uniqueDescriptions)
    {
        _csvProcessor = csvProcessor;
        _transactionQueryService = transactionQueryService;
        _transactionUpdateService = transactionUpdateService;
        _uniqueDescriptions = uniqueDescriptions;
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
        if (endDate is null || (startDate is not null && startDate > endDate))
        {
            return BadRequest();
        }

        var email = HttpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var transactions = await _transactionQueryService.GetTransactionsAsync(email, startDate, endDate.Value);

        return Ok(new TransactionsResponse(transactions));
    }

    [HttpPut("transactions")]
    public async Task<IActionResult> UpdateTransactions(List<Transaction> transactions)
    {
        if (transactions.Count == 0)
        {
            return BadRequest();
        }

        var email = HttpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        await _transactionUpdateService.UpdateTransactionsAsync(email, transactions);

        return NoContent();
    }

    [HttpGet("transaction_descriptions")]
    public async Task<ActionResult<TransactionDescriptionsResponse>> GetTransactionDescriptions()
    {
        var email = HttpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var record = await _uniqueDescriptions.GetAsync(email);

        return Ok(new TransactionDescriptionsResponse(record?.Descriptions ?? []));
    }

    [HttpPost("credit_description_mapping")]
    public async Task<IActionResult> SaveCreditDescriptionMapping(CreditDescriptionMappingRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.DescriptionStart) || string.IsNullOrWhiteSpace(request.Category))
        {
            return BadRequest();
        }

        var email = HttpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        await _transactionUpdateService.ApplyCreditDescriptionMappingAsync(email, request.DescriptionStart, request.Category);

        return NoContent();
    }
}

public sealed class UploadTransactionsRequest
{
    public required string Account { get; set; }

    public required IFormFile File { get; set; }
}

public sealed record TransactionsResponse(List<Transaction> Transactions);

public sealed record TransactionDescriptionsResponse(List<string> Descriptions);

public sealed record CreditDescriptionMappingRequest(string DescriptionStart, string Category);
