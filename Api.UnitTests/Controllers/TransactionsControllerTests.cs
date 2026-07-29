using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging.Abstractions;
using Pim.Api.Controllers;
using Pim.Api.Data;
using Pim.Api.UnitTests.Helpers;

namespace Pim.Api.UnitTests.Controllers;

public class TransactionsControllerTests
{
    private const string Email = "dave@example.com";
    private const string Account = "Everyday";

    [Fact]
    public async Task UploadFile_ReturnsBadRequest_WhenAccountIsMissing()
    {
        var sut = CreateController([]);

        var result = await sut.UploadFile(new UploadTransactionsRequest { Account = " ", File = CreateCsvFile(ValidCsv) });

        Assert.IsType<BadRequestResult>(result);
    }

    [Fact]
    public async Task UploadFile_ReturnsBadRequest_WhenFileIsEmpty()
    {
        var sut = CreateController([]);

        var result = await sut.UploadFile(new UploadTransactionsRequest { Account = Account, File = CreateCsvFile("") });

        Assert.IsType<BadRequestResult>(result);
    }

    [Fact]
    public async Task UploadFile_ReturnsBadRequest_WhenFileCannotBeParsed()
    {
        var sut = CreateController([]);
        var malformedCsv = "Date,Ignore,Description,Amount,Ignore\nnot-a-date,x,Coffee,-4.50,x\n";

        var result = await sut.UploadFile(new UploadTransactionsRequest { Account = Account, File = CreateCsvFile(malformedCsv) });

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task UploadFile_SavesTransactions_WithEmptyCategory()
    {
        var months = new List<TransactionMonth>();
        var sut = CreateController(months);

        var result = await sut.UploadFile(new UploadTransactionsRequest { Account = Account, File = CreateCsvFile(ValidCsv) });

        Assert.IsType<NoContentResult>(result);
        var month = Assert.Single(months);
        Assert.Equal(TransactionMonth.BuildId(Email, 2026, 6), month.Id);
        Assert.Equal(2, month.Transactions.Count);
        Assert.All(month.Transactions, t => Assert.Equal(Account, t.Account));
        Assert.All(month.Transactions, t => Assert.Equal(string.Empty, t.Category));
        Assert.Contains(month.Transactions, t => t.Description == "Coffee Shop" && t.Amount == -4.50m);
        Assert.Contains(month.Transactions, t => t.Description == "Salary" && t.Amount == 2500.00m);
    }

    [Fact]
    public async Task UploadFile_AppendsToExistingMonth_WhenBucketAlreadyExists()
    {
        var existing = new TransactionMonth
        {
            Email = Email,
            Year = 2026,
            Month = 6,
            Transactions = [new Transaction { Account = Account, Date = new DateOnly(2026, 6, 1), Description = "Existing", Category = "", Amount = -1m }],
        };
        var months = new List<TransactionMonth> { existing };
        var sut = CreateController(months);

        var result = await sut.UploadFile(new UploadTransactionsRequest { Account = Account, File = CreateCsvFile(ValidCsv) });

        Assert.IsType<NoContentResult>(result);
        var month = Assert.Single(months);
        Assert.Equal(3, month.Transactions.Count);
    }

    [Fact]
    public async Task UploadFile_GroupsRowsAcrossMonths_IntoSeparateBuckets()
    {
        var months = new List<TransactionMonth>();
        var sut = CreateController(months);
        var csv = "Date,Ignore,Description,Amount,Ignore\n01 JUN 2026,x,June Row,-1.00,x\n01 JUL 2026,x,July Row,-2.00,x\n";

        var result = await sut.UploadFile(new UploadTransactionsRequest { Account = Account, File = CreateCsvFile(csv) });

        Assert.IsType<NoContentResult>(result);
        Assert.Equal(2, months.Count);
        Assert.Contains(months, m => m.Year == 2026 && m.Month == 6 && m.Transactions.Single().Description == "June Row");
        Assert.Contains(months, m => m.Year == 2026 && m.Month == 7 && m.Transactions.Single().Description == "July Row");
    }

    private const string ValidCsv =
        "Date,Ignore,Description,Amount,Ignore\n" +
        "01 JUN 2026,x,Coffee Shop,-4.50,x\n" +
        "15 JUN 2026,x,Salary,2500.00,x\n";

    private static IFormFile CreateCsvFile(string content)
    {
        var bytes = Encoding.UTF8.GetBytes(content);
        return new FormFile(new MemoryStream(bytes), 0, bytes.Length, "file", "transactions.csv");
    }

    private static TransactionsController CreateController(List<TransactionMonth> months)
    {
        var repository = RepositoryMockFactory.Create(months);
        var controller = new TransactionsController(repository.Object, NullLogger<TransactionsController>.Instance);
        var identity = new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, Email)], "TestAuth");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) },
        };
        return controller;
    }
}
