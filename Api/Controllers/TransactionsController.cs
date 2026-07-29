using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Pim.Api.Services;

namespace Pim.Api.Controllers;

[ApiController]
[Authorize]
public sealed class TransactionsController : ControllerBase
{
    private readonly ICsvProcessor _csvProcessor;

    public TransactionsController(ICsvProcessor csvProcessor)
    {
        _csvProcessor = csvProcessor;
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
}

public sealed class UploadTransactionsRequest
{
    public required string Account { get; set; }

    public required IFormFile File { get; set; }
}
