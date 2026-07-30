using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Pim.Api.Controllers;
using Pim.Api.Data;
using Pim.Api.Services;

namespace Pim.Api.UnitTests.Controllers;

public class TransactionsControllerTests
{
    private const string Email = "dave@example.com";
    private const string Account = "Everyday";

    [Fact]
    public async Task UploadFile_ReturnsBadRequest_WhenAccountIsMissing()
    {
        var sut = CreateController(csvProcessor: new Mock<ICsvProcessor>());

        var result = await sut.UploadFile(new UploadTransactionsRequest { Account = " ", File = CreateFile() });

        Assert.IsType<BadRequestResult>(result);
    }

    [Fact]
    public async Task UploadFile_ReturnsBadRequest_WhenFileIsEmpty()
    {
        var sut = CreateController(csvProcessor: new Mock<ICsvProcessor>());

        var result = await sut.UploadFile(new UploadTransactionsRequest { Account = Account, File = CreateFile(0) });

        Assert.IsType<BadRequestResult>(result);
    }

    [Fact]
    public async Task UploadFile_ReturnsBadRequest_WhenProcessorThrowsCsvParseException()
    {
        var processor = new Mock<ICsvProcessor>();
        processor.Setup(p => p.ProcessAsync(Email, Account, It.IsAny<IFormFile>()))
            .ThrowsAsync(new CsvParseException("bad file", new FormatException()));
        var sut = CreateController(csvProcessor: processor);

        var result = await sut.UploadFile(new UploadTransactionsRequest { Account = Account, File = CreateFile() });

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task UploadFile_ReturnsNoContent_AndCallsProcessor_WhenSuccessful()
    {
        var processor = new Mock<ICsvProcessor>();
        var file = CreateFile();
        var sut = CreateController(csvProcessor: processor);

        var result = await sut.UploadFile(new UploadTransactionsRequest { Account = Account, File = file });

        Assert.IsType<NoContentResult>(result);
        processor.Verify(p => p.ProcessAsync(Email, Account, file), Times.Once);
    }

    [Fact]
    public async Task GetTransactions_ReturnsOkAndPassesNullStartDate_WhenStartDateIsOmitted()
    {
        var endDate = new DateOnly(2026, 6, 30);
        var transactions = new List<Transaction>();
        var queryService = new Mock<ITransactionQueryService>();
        queryService.Setup(s => s.GetTransactionsAsync(Email, null, endDate)).ReturnsAsync(transactions);
        var sut = CreateController(queryService: queryService);

        var result = await sut.GetTransactions(null, endDate);

        Assert.IsType<OkObjectResult>(result.Result);
        queryService.Verify(s => s.GetTransactionsAsync(Email, null, endDate), Times.Once);
    }

    [Fact]
    public async Task GetTransactions_ReturnsBadRequest_WhenEndDateIsMissing()
    {
        var sut = CreateController(queryService: new Mock<ITransactionQueryService>());

        var result = await sut.GetTransactions(new DateOnly(2026, 6, 1), null);

        Assert.IsType<BadRequestResult>(result.Result);
    }

    [Fact]
    public async Task GetTransactions_ReturnsBadRequest_WhenStartDateIsAfterEndDate()
    {
        var sut = CreateController(queryService: new Mock<ITransactionQueryService>());

        var result = await sut.GetTransactions(new DateOnly(2026, 6, 30), new DateOnly(2026, 6, 1));

        Assert.IsType<BadRequestResult>(result.Result);
    }

    [Fact]
    public async Task GetTransactions_ReturnsOkWithTransactions_WhenSuccessful()
    {
        var startDate = new DateOnly(2026, 6, 1);
        var endDate = new DateOnly(2026, 6, 30);
        var transactions = new List<Transaction>
        {
            new() { Account = Account, Date = startDate, Description = "Coffee", Category = "", Amount = -4.50m },
        };
        var queryService = new Mock<ITransactionQueryService>();
        queryService.Setup(s => s.GetTransactionsAsync(Email, startDate, endDate)).ReturnsAsync(transactions);
        var sut = CreateController(queryService: queryService);

        var result = await sut.GetTransactions(startDate, endDate);

        var ok = Assert.IsType<OkObjectResult>(result.Result);
        var response = Assert.IsType<TransactionsResponse>(ok.Value);
        Assert.Equal(transactions, response.Transactions);
    }

    private static IFormFile CreateFile(long length = 10) =>
        new FormFile(new MemoryStream(new byte[length]), 0, length, "file", "transactions.csv");

    private static TransactionsController CreateController(Mock<ICsvProcessor>? csvProcessor = null, Mock<ITransactionQueryService>? queryService = null)
    {
        var controller = new TransactionsController(
            (csvProcessor ?? new Mock<ICsvProcessor>()).Object,
            (queryService ?? new Mock<ITransactionQueryService>()).Object);
        var identity = new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, Email)], "TestAuth");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) },
        };
        return controller;
    }
}
