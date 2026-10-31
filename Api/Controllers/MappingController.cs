using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Pim.Api.Data;
using Pim.Api.Repository;
using Pim.Api.Services;

namespace Pim.Api.Controllers;

[ApiController]
[Authorize]
public sealed class MappingController : ControllerBase
{
    private readonly ITransactionUpdateService _transactionUpdateService;
    private readonly IRepository<User> _users;

    public MappingController(ITransactionUpdateService transactionUpdateService, IRepository<User> users)
    {
        _transactionUpdateService = transactionUpdateService;
        _users = users;
    }

    [HttpPost("mapping/description")]
    public async Task<IActionResult> SaveDescriptionMapping(DescriptionMappingRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.DescriptionStart) || string.IsNullOrWhiteSpace(request.Category))
        {
            return BadRequest();
        }

        var email = HttpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var user = await _users.GetAsync(email);
        if (user is null)
        {
            return NotFound();
        }

        await _transactionUpdateService.ApplyDescriptionMappingAsync(user, request.DescriptionStart, request.Category);

        return NoContent();
    }
}

public sealed record DescriptionMappingRequest(string DescriptionStart, string Category);
