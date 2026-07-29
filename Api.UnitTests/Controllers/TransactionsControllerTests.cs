using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Pim.Api.Controllers;
using Pim.Api.Services;

namespace Pim.Api.UnitTests.Controllers;

public class TransactionsControllerTests
{
    private const string Email = "dave@example.com";
    private const string Account = "Everyday";

    [Fact]
    public async Task UploadFile_ReturnsBadRequest_WhenAccountIsMissing()
    {
        var sut = CreateController(new Mock<ICsvProcessor>());

        var result = await sut.UploadFile(new UploadTransactionsRequest { Account = " ", File = CreateFile() });

        Assert.IsType<BadRequestResult>(result);
    }

    [Fact]
    public async Task UploadFile_ReturnsBadRequest_WhenFileIsEmpty()
    {
        var sut = CreateController(new Mock<ICsvProcessor>());

        var result = await sut.UploadFile(new UploadTransactionsRequest { Account = Account, File = CreateFile(0) });

        Assert.IsType<BadRequestResult>(result);
    }

    [Fact]
    public async Task UploadFile_ReturnsBadRequest_WhenProcessorThrowsCsvParseException()
    {
        var processor = new Mock<ICsvProcessor>();
        processor.Setup(p => p.ProcessAsync(Email, Account, It.IsAny<IFormFile>()))
            .ThrowsAsync(new CsvParseException("bad file", new FormatException()));
        var sut = CreateController(processor);

        var result = await sut.UploadFile(new UploadTransactionsRequest { Account = Account, File = CreateFile() });

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task UploadFile_ReturnsNoContent_AndCallsProcessor_WhenSuccessful()
    {
        var processor = new Mock<ICsvProcessor>();
        var file = CreateFile();
        var sut = CreateController(processor);

        var result = await sut.UploadFile(new UploadTransactionsRequest { Account = Account, File = file });

        Assert.IsType<NoContentResult>(result);
        processor.Verify(p => p.ProcessAsync(Email, Account, file), Times.Once);
    }

    private static IFormFile CreateFile(long length = 10) =>
        new FormFile(new MemoryStream(new byte[length]), 0, length, "file", "transactions.csv");

    private static TransactionsController CreateController(Mock<ICsvProcessor> processor)
    {
        var controller = new TransactionsController(processor.Object);
        var identity = new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, Email)], "TestAuth");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) },
        };
        return controller;
    }
}
