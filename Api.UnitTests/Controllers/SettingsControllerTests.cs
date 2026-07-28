using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Pim.Api.Controllers;
using Pim.Api.Data;
using Pim.Api.UnitTests.Helpers;

namespace Pim.Api.UnitTests.Controllers;

public class SettingsControllerTests
{
    private const string Email = "dave@example.com";

    [Fact]
    public async Task Get_ReturnsAccounts_ForAuthenticatedUser()
    {
        var accounts = new List<Account> { new() { Name = "Everyday", Number = "123456", Type = AccountType.Transaction } };
        var users = new List<User> { new() { Email = Email, PasswordHash = "hash", Accounts = accounts } };
        var sut = CreateController(users);

        var result = await sut.Get();

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<SettingsResponse>(ok.Value);
        Assert.Single(response.Accounts);
        Assert.Equal("Everyday", response.Accounts[0].Name);
    }

    [Fact]
    public async Task Get_ReturnsNotFound_WhenUserRecordIsMissing()
    {
        var sut = CreateController([]);

        var result = await sut.Get();

        Assert.IsType<NotFoundResult>(result.Result);
    }

    [Fact]
    public async Task Put_ReplacesAccounts_AndPersistsThem()
    {
        var users = new List<User> { new() { Email = Email, PasswordHash = "hash" } };
        var sut = CreateController(users);
        var newAccounts = new List<Account> { new() { Name = "Savings", Number = "654321", Type = AccountType.Savings } };

        var result = await sut.Put(new SettingsRequest(newAccounts));

        Assert.IsType<NoContentResult>(result);
        Assert.Equal(newAccounts, users[0].Accounts);
    }

    [Fact]
    public async Task Put_ReturnsNotFound_WhenUserRecordIsMissing()
    {
        var sut = CreateController([]);

        var result = await sut.Put(new SettingsRequest([]));

        Assert.IsType<NotFoundResult>(result);
    }

    private static SettingsController CreateController(List<User> users)
    {
        var repository = RepositoryMockFactory.Create(users);
        var controller = new SettingsController(repository.Object, NullLogger<SettingsController>.Instance);
        var identity = new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, Email)], "TestAuth");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) },
        };
        return controller;
    }
}
