using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Pim.Api.Data;

namespace Pim.Api.Controllers;

[ApiController]
[Authorize]
public sealed class SettingsController : ControllerBase
{
    private readonly IRepository<User> _users;
    private readonly ILogger<SettingsController> _logger;

    public SettingsController(IRepository<User> users, ILogger<SettingsController> logger)
    {
        _users = users;
        _logger = logger;
    }

    [HttpGet("settings")]
    public async Task<ActionResult<SettingsResponse>> Get()
    {
        var user = await GetAuthenticatedUser();
        if (user is null)
        {
            return NotFound();
        }

        return Ok(new SettingsResponse(user.Accounts));
    }

    [HttpPut("settings")]
    public async Task<ActionResult> Put(SettingsRequest request)
    {
        var user = await GetAuthenticatedUser();
        if (user is null)
        {
            return NotFound();
        }

        user.Accounts = request.Accounts;
        await _users.UpdateAsync(user.Email, user);

        return NoContent();
    }

    private async Task<User?> GetAuthenticatedUser()
    {
        var email = HttpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var user = await _users.GetAsync(email);
        if (user is null)
        {
            _logger.LogWarning("Settings request for an authenticated email with no matching user record");
        }

        return user;
    }
}

public sealed record SettingsResponse(List<Account> Accounts);

public sealed record SettingsRequest(List<Account> Accounts);
