using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Pim.Api.Data;
using Pim.Api.Repository;
using Pim.Api.Services;

namespace Pim.Api.Controllers;

[ApiController]
[Authorize]
public sealed class SettingsController : ControllerBase
{
    private readonly IRepository<User> _users;
    private readonly ITransactionUpdateService _transactionUpdateService;
    private readonly ILogger<SettingsController> _logger;

    public SettingsController(IRepository<User> users, ITransactionUpdateService transactionUpdateService, ILogger<SettingsController> logger)
    {
        _users = users;
        _transactionUpdateService = transactionUpdateService;
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

        return Ok(new SettingsResponse(user.Accounts, user.Categories, user.MinTransactionDate));
    }

    [HttpPut("settings")]
    public async Task<ActionResult> Put(SettingsRequest request)
    {
        var user = await GetAuthenticatedUser();
        if (user is null)
        {
            return NotFound();
        }

        if (HasDuplicateNames(request.Accounts))
        {
            return BadRequest("Account names must be unique.");
        }

        if (RemovesAnExistingAccount(user.Accounts, request.Accounts))
        {
            return BadRequest("Account names can't be changed once created, and accounts can't be removed via PUT /settings - use DELETE /settings/account to remove one instead.");
        }

        user.Accounts = request.Accounts;
        await _users.UpdateAsync(user.Email, user);

        return NoContent();
    }

    // Name is the account's key (UBE-58) - it's unique (enforced by Put) and immutable, so it's a
    // sufficient match on its own, no need for a defence-in-depth match on other fields.
    [HttpDelete("settings/account")]
    public async Task<ActionResult> DeleteAccount(DeleteAccountRequest request)
    {
        var user = await GetAuthenticatedUser();
        if (user is null)
        {
            return NotFound();
        }

        var removed = user.Accounts.RemoveAll(a => a.Name == request.Name);
        if (removed == 0)
        {
            return NotFound();
        }

        await _users.UpdateAsync(user.Email, user);
        await _transactionUpdateService.DeleteTransactionsForAccountAsync(user.Email, request.Name);

        return NoContent();
    }

    [HttpPost("settings/category")]
    public async Task<ActionResult> AddCategory(Category category)
    {
        var user = await GetAuthenticatedUser();
        if (user is null)
        {
            return NotFound();
        }

        if (string.IsNullOrWhiteSpace(category.Name))
        {
            return BadRequest("Category name is required.");
        }

        if (user.Categories.Any(c => string.Equals(c.Name, category.Name, StringComparison.OrdinalIgnoreCase)))
        {
            return BadRequest("Category names must be unique.");
        }

        user.Categories.Add(category);
        await _users.UpdateAsync(user.Email, user);

        return NoContent();
    }

    // Internal Transfer is excluded because InternalTransferMatcher hardcodes that exact name for
    // automated matching - deleting it would silently break auto-categorisation on future imports.
    [HttpDelete("settings/category")]
    public async Task<ActionResult> DeleteCategory(Category category)
    {
        var user = await GetAuthenticatedUser();
        if (user is null)
        {
            return NotFound();
        }

        if (string.Equals(category.Name, InternalTransferMatcher.CategoryName, StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest($"\"{InternalTransferMatcher.CategoryName}\" cannot be deleted.");
        }

        var removed = user.Categories.RemoveAll(c => string.Equals(c.Name, category.Name, StringComparison.OrdinalIgnoreCase));
        if (removed == 0)
        {
            return NotFound();
        }

        await _users.UpdateAsync(user.Email, user);
        await _transactionUpdateService.RemoveCategoryFromTransactionsAsync(user.Email, category.Name);

        return NoContent();
    }

    private static bool HasDuplicateNames(List<Account> accounts) =>
        accounts.GroupBy(a => a.Name, StringComparer.OrdinalIgnoreCase).Any(g => g.Count() > 1);

    // Name is the account's key (UBE-58), so it can't be edited - renaming an existing account looks
    // identical to removing it and adding a new one, and this rejects both. Removal must go through
    // DELETE /settings/account (which also cascades to that account's transactions) - PUT can still
    // add accounts and edit their Type, but every name currently on the user must still be present
    // somewhere in the new list.
    private static bool RemovesAnExistingAccount(List<Account> existingAccounts, List<Account> requestedAccounts)
    {
        var requestedNames = requestedAccounts.Select(a => a.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);
        return existingAccounts.Any(a => !requestedNames.Contains(a.Name));
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

public sealed record SettingsResponse(List<Account> Accounts, List<Category> Categories, DateOnly? MinTransactionDate);

public sealed record SettingsRequest(List<Account> Accounts);

public sealed record DeleteAccountRequest(string Name);
