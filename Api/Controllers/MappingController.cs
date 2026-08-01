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

    [HttpPost("mapping/description")]
    public async Task<IActionResult> SaveDescriptionMapping(DescriptionMappingRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.DescriptionStart) || string.IsNullOrWhiteSpace(request.Category))
        {
            return BadRequest();
        }

        var email = HttpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        await _transactionUpdateService.ApplyDescriptionMappingAsync(email, request.DescriptionStart, request.Category);

        return NoContent();
    }
}

public sealed record DescriptionMappingRequest(string DescriptionStart, string Category);
