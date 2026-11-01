using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Pim.Api.Data;
using Pim.Api.Repository;
using Pim.Api.Services;

namespace Pim.Api.Controllers;

// Recurring monthly per-category budgets (UBE-119) and recommendations for them (UBE-123).
[ApiController]
[Authorize]
public sealed class BudgetsController : ControllerBase
{
    private readonly IRepository<User> _users;
    private readonly ITransactionQueryService _transactionQueryService;
    private readonly ILogger<BudgetsController> _logger;

    public BudgetsController(
        IRepository<User> users,
        ITransactionQueryService transactionQueryService,
        ILogger<BudgetsController> logger)
    {
        _users = users;
        _transactionQueryService = transactionQueryService;
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

    // Average monthly spend per Expense category over the 6 full months before `month` (UBE-123).
    // `month` is the client's current month (yyyy-MM), so the window follows the user's time zone.
    [HttpGet("budgets/recommendations")]
    public async Task<ActionResult<List<Budget>>> GetRecommendations([FromQuery] string? month)
    {
        if (!DateOnly.TryParseExact($"{month}-01", "yyyy-MM-dd", out var currentMonth))
        {
            return BadRequest("month must be in yyyy-MM format.");
        }

        var user = await GetAuthenticatedUser();
        if (user is null)
        {
            return NotFound();
        }

        var (start, end) = BudgetRecommendationService.Window(currentMonth);
        var transactions = await _transactionQueryService.GetTransactionsAsync(user.Email, start, end);

        return Ok(BudgetRecommendationService.Recommend(transactions, user.Categories, currentMonth, user.MinTransactionDate));
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
