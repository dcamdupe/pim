using CsvHelper;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Pim.Api.Data;
using Pim.Api.Services;
using Pim.Api.Services.CSVParsers;
using Pim.Api.UnitTests.Helpers;

namespace Pim.Api.UnitTests.Services;

public class CsvProcessorTests
{
    private const string Email = "dave@example.com";
    private const string Account = "Everyday";

    [Fact]
    public async Task ProcessAsync_ThrowsCsvParseException_WhenParserThrows()
    {
        var parser = new Mock<ICsvParser>();
        parser.Setup(p => p.Parse(Account)).Throws(new FormatException());
        var factory = CreateFactory(parser);
        var sut = CreateProcessor(factory, []);

        await Assert.ThrowsAsync<CsvParseException>(() => sut.ProcessAsync(Email, Account, CreateFile()));
    }

    [Fact]
    public async Task ProcessAsync_SavesParsedTransactions_ToTheirMonthBucket()
    {
        List<Transaction> transactions =
        [
            new() { Account = Account, Date = new DateOnly(2026, 6, 1), Description = "Coffee Shop", Category = "", Amount = -4.50m },
            new() { Account = Account, Date = new DateOnly(2026, 6, 15), Description = "Salary", Category = "", Amount = 2500.00m },
        ];
        var parser = new Mock<ICsvParser>();
        parser.Setup(p => p.Parse(Account)).Returns(transactions);
        var factory = CreateFactory(parser);
        var months = new List<TransactionMonth>();
        var sut = CreateProcessor(factory, months);

        await sut.ProcessAsync(Email, Account, CreateFile());

        var month = Assert.Single(months);
        Assert.Equal(TransactionMonth.BuildId(Email, 2026, 6), month.Id);
        Assert.Equal(transactions, month.Transactions);
    }

    [Fact]
    public async Task ProcessAsync_AppendsToExistingMonth_WhenBucketAlreadyExists()
    {
        var existing = new TransactionMonth
        {
            Email = Email,
            Year = 2026,
            Month = 6,
            Transactions = [new Transaction { Account = Account, Date = new DateOnly(2026, 6, 1), Description = "Existing", Category = "", Amount = -1m }],
        };
        var months = new List<TransactionMonth> { existing };
        var parser = new Mock<ICsvParser>();
        parser.Setup(p => p.Parse(Account)).Returns(
        [
            new Transaction { Account = Account, Date = new DateOnly(2026, 6, 2), Description = "New", Category = "", Amount = -2m },
        ]);
        var factory = CreateFactory(parser);
        var sut = CreateProcessor(factory, months);

        await sut.ProcessAsync(Email, Account, CreateFile());

        var month = Assert.Single(months);
        Assert.Equal(2, month.Transactions.Count);
    }

    [Fact]
    public async Task ProcessAsync_GroupsTransactionsAcrossMonths_IntoSeparateBuckets()
    {
        var parser = new Mock<ICsvParser>();
        parser.Setup(p => p.Parse(Account)).Returns(
        [
            new Transaction { Account = Account, Date = new DateOnly(2026, 6, 1), Description = "June Row", Category = "", Amount = -1m },
            new Transaction { Account = Account, Date = new DateOnly(2026, 7, 1), Description = "July Row", Category = "", Amount = -2m },
        ]);
        var factory = CreateFactory(parser);
        var months = new List<TransactionMonth>();
        var sut = CreateProcessor(factory, months);

        await sut.ProcessAsync(Email, Account, CreateFile());

        Assert.Equal(2, months.Count);
        Assert.Contains(months, m => m.Year == 2026 && m.Month == 6 && m.Transactions.Single().Description == "June Row");
        Assert.Contains(months, m => m.Year == 2026 && m.Month == 7 && m.Transactions.Single().Description == "July Row");
    }

    [Fact]
    public async Task ProcessAsync_SkipsExactDuplicate_WhenReUploadingTheSameTransaction()
    {
        var existing = new TransactionMonth
        {
            Email = Email,
            Year = 2026,
            Month = 6,
            Transactions = [new Transaction { Account = Account, Date = new DateOnly(2026, 6, 1), Description = "Coffee Shop", Category = "", Amount = -4.50m }],
        };
        var months = new List<TransactionMonth> { existing };
        var duplicate = new Transaction { Account = Account, Date = new DateOnly(2026, 6, 1), Description = "Coffee Shop", Category = "", Amount = -4.50m };
        var parser = new Mock<ICsvParser>();
        parser.Setup(p => p.Parse(Account)).Returns([duplicate]);
        var factory = CreateFactory(parser);
        var sut = CreateProcessor(factory, months);

        await sut.ProcessAsync(Email, Account, CreateFile());

        var month = Assert.Single(months);
        Assert.Single(month.Transactions);
    }

    [Fact]
    public async Task ProcessAsync_TreatsADifferingCategoryAsStillADuplicate()
    {
        var existing = new TransactionMonth
        {
            Email = Email,
            Year = 2026,
            Month = 6,
            Transactions = [new Transaction { Account = Account, Date = new DateOnly(2026, 6, 1), Description = "Coffee Shop", Category = "Dining", Amount = -4.50m }],
        };
        var months = new List<TransactionMonth> { existing };
        var candidate = new Transaction { Account = Account, Date = new DateOnly(2026, 6, 1), Description = "Coffee Shop", Category = "", Amount = -4.50m };
        var parser = new Mock<ICsvParser>();
        parser.Setup(p => p.Parse(Account)).Returns([candidate]);
        var factory = CreateFactory(parser);
        var sut = CreateProcessor(factory, months);

        await sut.ProcessAsync(Email, Account, CreateFile());

        var month = Assert.Single(months);
        Assert.Single(month.Transactions);
    }

    [Theory]
    [InlineData("date")]
    [InlineData("description")]
    [InlineData("amount")]
    [InlineData("account")]
    public async Task ProcessAsync_StillAdds_WhenOneOfTheMatchedFieldsDiffers(string differingField)
    {
        var existing = new TransactionMonth
        {
            Email = Email,
            Year = 2026,
            Month = 6,
            Transactions = [new Transaction { Account = Account, Date = new DateOnly(2026, 6, 1), Description = "Coffee Shop", Category = "", Amount = -4.50m }],
        };
        var months = new List<TransactionMonth> { existing };
        var candidate = new Transaction
        {
            Account = differingField == "account" ? "Different Account" : Account,
            Date = differingField == "date" ? new DateOnly(2026, 6, 2) : new DateOnly(2026, 6, 1),
            Description = differingField == "description" ? "Different Description" : "Coffee Shop",
            Category = "",
            Amount = differingField == "amount" ? -9.99m : -4.50m,
        };
        var parser = new Mock<ICsvParser>();
        parser.Setup(p => p.Parse(Account)).Returns([candidate]);
        var factory = CreateFactory(parser);
        var sut = CreateProcessor(factory, months);

        await sut.ProcessAsync(Email, Account, CreateFile());

        var month = Assert.Single(months);
        Assert.Equal(2, month.Transactions.Count);
    }

    private static IFormFile CreateFile() => new FormFile(new MemoryStream(), 0, 0, "file", "transactions.csv");

    private static Mock<ICSVParserFactory> CreateFactory(Mock<ICsvParser> parser)
    {
        var factory = new Mock<ICSVParserFactory>();
        factory.Setup(f => f.Create(It.IsAny<CsvReader>())).Returns(parser.Object);
        return factory;
    }

    private static CsvProcessor CreateProcessor(Mock<ICSVParserFactory> factory, List<TransactionMonth> months)
    {
        var repository = RepositoryMockFactory.Create(months);
        return new CsvProcessor(factory.Object, repository.Object, NullLogger<CsvProcessor>.Instance);
    }
}
