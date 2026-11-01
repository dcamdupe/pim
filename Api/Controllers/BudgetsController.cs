using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Pim.Api.Data;
using Pim.Api.Repository;
using Pim.Api.Services;

namespace Pim.Api.Controllers;

// Recurring monthly per-category budgets (UBE-119). Tracking against them comes in later tickets.
[ApiController]
[Authorize]
public sealed class BudgetsController : ControllerBase
{
    private readonly IRepository<User> _users;
    private readonly ILogger<BudgetsController> _logger;

    public BudgetsController(IRepository<User> users, ILogger<BudgetsController> logger)
    {
        _users = users;
        _logger = logger;
    }

    [HttpGet("budgets")]
    public async Task<ActionResult<List<Budget>>> Get()
    {
        var user = await GetAuthenticatedUser();
        if (user is null)
        {
            return NotFound();
        }

        return Ok(user.Budgets);
    }

    // Replaces the whole list; a category with no entry has no budget.
    [HttpPut("budgets")]
    public async Task<ActionResult> Put(List<Budget> budgets)
    {
        var user = await GetAuthenticatedUser();
        if (user is null)
        {
            return NotFound();
        }

        var error = BudgetValidator.Validate(budgets, user.Categories);
        if (error is not null)
        {
            return BadRequest(error);
        }

        // Store the category's canonical name, so lookups by name stay exact.
        user.Budgets = budgets
            .Select(b => new Budget
            {
                Category = user.Categories.First(c => string.Equals(c.Name, b.Category, StringComparison.OrdinalIgnoreCase)).Name,
                Amount = b.Amount,
            })
            .ToList();
        await _users.UpdateAsync(user.Email, user);

        return NoContent();
    }

    private async Task<User?> GetAuthenticatedUser()
    {
        var email = HttpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)!;
        var user = await _users.GetAsync(email);
        if (user is null)
        {
            _logger.LogWarning("Budgets request for an authenticated email with no matching user record");
        }

        return user;
    }
}
