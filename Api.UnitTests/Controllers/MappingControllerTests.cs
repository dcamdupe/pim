using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Pim.Api.Controllers;
using Pim.Api.Services;

namespace Pim.Api.UnitTests.Controllers;

public class MappingControllerTests
{
    private const string Email = "dave@example.com";

    [Theory]
    [InlineData(" ", "Groceries")]
    [InlineData("COLES", " ")]
    public async Task SaveCreditDescriptionMapping_ReturnsBadRequest_WhenFieldsAreBlank(string descriptionStart, string category)
    {
        var sut = CreateController();

        var result = await sut.SaveCreditDescriptionMapping(new CreditDescriptionMappingRequest(descriptionStart, category));

        Assert.IsType<BadRequestResult>(result);
    }

    [Fact]
    public async Task SaveCreditDescriptionMapping_ReturnsNoContent_AndCallsUpdateService_WhenSuccessful()
    {
        var updateService = new Mock<ITransactionUpdateService>();
        var sut = CreateController(updateService: updateService);

        var result = await sut.SaveCreditDescriptionMapping(new CreditDescriptionMappingRequest("COLES", "Groceries"));

        Assert.IsType<NoContentResult>(result);
        updateService.Verify(s => s.ApplyCreditDescriptionMappingAsync(Email, "COLES", "Groceries"), Times.Once);
    }

    private static MappingController CreateController(Mock<ITransactionUpdateService>? updateService = null)
    {
        var controller = new MappingController((updateService ?? new Mock<ITransactionUpdateService>()).Object);
        var identity = new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, Email)], "TestAuth");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) },
        };
        return controller;
    }
}
