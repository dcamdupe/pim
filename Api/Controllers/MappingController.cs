using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Pim.Api.Services;

namespace Pim.Api.Controllers;

[ApiController]
[Authorize]
public sealed class MappingController : ControllerBase
{
    private readonly ITransactionUpdateService _transactionUpdateService;

    public MappingController(ITransactionUpdateService transactionUpdateService)
    {
        _transactionUpdateService = transactionUpdateService;
    }

    [HttpPost("mapping/credit")]
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

public sealed record CreditDescriptionMappingRequest(string DescriptionStart, string Category);
