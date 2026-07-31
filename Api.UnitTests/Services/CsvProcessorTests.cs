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

    [Fact]
    public async Task ProcessAsync_SetsMinTransactionDate_WhenNoneWasSetBefore()
    {
        var user = new User { Email = Email, PasswordHash = "hash" };
        var parser = new Mock<ICsvParser>();
        parser.Setup(p => p.Parse(Account)).Returns(
        [
            new Transaction { Account = Account, Date = new DateOnly(2026, 6, 15), Description = "Later", Category = "", Amount = -1m },
            new Transaction { Account = Account, Date = new DateOnly(2026, 6, 1), Description = "Earlier", Category = "", Amount = -2m },
        ]);
        var factory = CreateFactory(parser);
        var sut = CreateProcessor(factory, [], [user]);

        await sut.ProcessAsync(Email, Account, CreateFile());

        Assert.Equal(new DateOnly(2026, 6, 1), user.MinTransactionDate);
    }

    [Fact]
    public async Task ProcessAsync_LowersMinTransactionDate_WhenNewBatchHasAnEarlierDate()
    {
        var user = new User { Email = Email, PasswordHash = "hash", MinTransactionDate = new DateOnly(2026, 6, 1) };
        var parser = new Mock<ICsvParser>();
        parser.Setup(p => p.Parse(Account)).Returns(
        [
            new Transaction { Account = Account, Date = new DateOnly(2026, 5, 1), Description = "Earlier", Category = "", Amount = -1m },
        ]);
        var factory = CreateFactory(parser);
        var sut = CreateProcessor(factory, [], [user]);

        await sut.ProcessAsync(Email, Account, CreateFile());

        Assert.Equal(new DateOnly(2026, 5, 1), user.MinTransactionDate);
    }

    [Fact]
    public async Task ProcessAsync_DoesNotRaiseMinTransactionDate_WhenNewBatchIsAllLater()
    {
        var user = new User { Email = Email, PasswordHash = "hash", MinTransactionDate = new DateOnly(2026, 5, 1) };
        var parser = new Mock<ICsvParser>();
        parser.Setup(p => p.Parse(Account)).Returns(
        [
            new Transaction { Account = Account, Date = new DateOnly(2026, 6, 15), Description = "Later", Category = "", Amount = -1m },
        ]);
        var factory = CreateFactory(parser);
        var sut = CreateProcessor(factory, [], [user]);

        await sut.ProcessAsync(Email, Account, CreateFile());

        Assert.Equal(new DateOnly(2026, 5, 1), user.MinTransactionDate);
    }

    [Fact]
    public async Task ProcessAsync_DoesNotThrow_WhenParsedFileHasNoRows()
    {
        var user = new User { Email = Email, PasswordHash = "hash" };
        var parser = new Mock<ICsvParser>();
        parser.Setup(p => p.Parse(Account)).Returns([]);
        var factory = CreateFactory(parser);
        var sut = CreateProcessor(factory, [], [user]);

        await sut.ProcessAsync(Email, Account, CreateFile());

        Assert.Null(user.MinTransactionDate);
    }

    [Fact]
    public async Task ProcessAsync_CreatesDescriptionStats_ForNewTransactions()
    {
        var parser = new Mock<ICsvParser>();
        parser.Setup(p => p.Parse(Account)).Returns(
        [
            new Transaction { Account = Account, Date = new DateOnly(2026, 6, 1), Description = "Coffee Shop", Category = "", Amount = -4.50m },
            new Transaction { Account = Account, Date = new DateOnly(2026, 6, 2), Description = "Salary", Category = "Income", Amount = 2500.00m },
        ]);
        var factory = CreateFactory(parser);
        var transactionDescriptions = new List<TransactionDescriptions>();
        var sut = CreateProcessor(factory, [], transactionDescriptions: transactionDescriptions);

        await sut.ProcessAsync(Email, Account, CreateFile());

        var record = Assert.Single(transactionDescriptions);
        Assert.Equal(2, record.Descriptions.Count);
        var coffee = record.Descriptions.Single(d => d.Description == "Coffee Shop");
        Assert.Equal(1, coffee.TransactionCount);
        Assert.Equal(1, coffee.UnclassifiedCount);
        var salary = record.Descriptions.Single(d => d.Description == "Salary");
        Assert.Equal(1, salary.TransactionCount);
        Assert.Equal(0, salary.UnclassifiedCount);
    }

    [Fact]
    public async Task ProcessAsync_IncrementsExistingDescriptionStat_ForARepeatDescription()
    {
        var existing = new TransactionDescriptions
        {
            Email = Email,
            Descriptions = [new TransactionDescriptionStat { Description = "Coffee Shop", TransactionCount = 1, UnclassifiedCount = 1 }],
        };
        var parser = new Mock<ICsvParser>();
        parser.Setup(p => p.Parse(Account)).Returns(
        [
            new Transaction { Account = Account, Date = new DateOnly(2026, 6, 1), Description = "Coffee Shop", Category = "", Amount = -4.50m },
            new Transaction { Account = Account, Date = new DateOnly(2026, 6, 2), Description = "Salary", Category = "", Amount = 2500.00m },
        ]);
        var factory = CreateFactory(parser);
        var transactionDescriptions = new List<TransactionDescriptions> { existing };
        var sut = CreateProcessor(factory, [], transactionDescriptions: transactionDescriptions);

        await sut.ProcessAsync(Email, Account, CreateFile());

        var record = Assert.Single(transactionDescriptions);
        Assert.Equal(2, record.Descriptions.Count);
        var coffee = record.Descriptions.Single(d => d.Description == "Coffee Shop");
        Assert.Equal(2, coffee.TransactionCount);
        Assert.Equal(2, coffee.UnclassifiedCount);
        var salary = record.Descriptions.Single(d => d.Description == "Salary");
        Assert.Equal(1, salary.TransactionCount);
        Assert.Equal(1, salary.UnclassifiedCount);
    }

    [Fact]
    public async Task ProcessAsync_DoesNotInflateStats_WhenReUploadingADuplicateTransaction()
    {
        var existingMonth = new TransactionMonth
        {
            Email = Email,
            Year = 2026,
            Month = 6,
            Transactions = [new Transaction { Account = Account, Date = new DateOnly(2026, 6, 1), Description = "Coffee Shop", Category = "", Amount = -4.50m }],
        };
        var existingDescriptions = new TransactionDescriptions
        {
            Email = Email,
            Descriptions = [new TransactionDescriptionStat { Description = "Coffee Shop", TransactionCount = 1, UnclassifiedCount = 1 }],
        };
        var months = new List<TransactionMonth> { existingMonth };
        var transactionDescriptions = new List<TransactionDescriptions> { existingDescriptions };
        var duplicate = new Transaction { Account = Account, Date = new DateOnly(2026, 6, 1), Description = "Coffee Shop", Category = "", Amount = -4.50m };
        var parser = new Mock<ICsvParser>();
        parser.Setup(p => p.Parse(Account)).Returns([duplicate]);
        var factory = CreateFactory(parser);
        var sut = CreateProcessor(factory, months, transactionDescriptions: transactionDescriptions);

        await sut.ProcessAsync(Email, Account, CreateFile());

        var record = Assert.Single(transactionDescriptions);
        var coffee = Assert.Single(record.Descriptions);
        Assert.Equal(1, coffee.TransactionCount);
        Assert.Equal(1, coffee.UnclassifiedCount);
    }

    [Fact]
    public async Task ProcessAsync_CountsAnAutoMappedTransaction_AsClassifiedNotUnclassified()
    {
        var mapping = new CreditDescriptionMapping
        {
            Email = Email,
            Mappings = [new CreditDescriptionMappingEntry { DescriptionStart = "COLES", Category = "Groceries" }],
        };
        var parser = new Mock<ICsvParser>();
        parser.Setup(p => p.Parse(Account)).Returns(
        [
            new Transaction { Account = Account, Date = new DateOnly(2026, 6, 1), Description = "COLES 0717 TURRAMURRA AUS", Category = "", Amount = -20m },
        ]);
        var factory = CreateFactory(parser);
        var transactionDescriptions = new List<TransactionDescriptions>();
        var sut = CreateProcessor(factory, [], transactionDescriptions: transactionDescriptions, creditDescriptionMappings: [mapping]);

        await sut.ProcessAsync(Email, Account, CreateFile());

        var record = Assert.Single(transactionDescriptions);
        var stat = Assert.Single(record.Descriptions);
        Assert.Equal(1, stat.TransactionCount);
        Assert.Equal(0, stat.UnclassifiedCount);
    }

    [Fact]
    public async Task ProcessAsync_AppliesExistingCreditDescriptionMapping_ToNewlyParsedTransactions()
    {
        var mapping = new CreditDescriptionMapping
        {
            Email = Email,
            Mappings = [new CreditDescriptionMappingEntry { DescriptionStart = "COLES", Category = "Groceries" }],
        };
        var parser = new Mock<ICsvParser>();
        parser.Setup(p => p.Parse(Account)).Returns(
        [
            new Transaction { Account = Account, Date = new DateOnly(2026, 6, 1), Description = "COLES 0717 TURRAMURRA AUS", Category = "", Amount = -20m },
            new Transaction { Account = Account, Date = new DateOnly(2026, 6, 2), Description = "Salary", Category = "", Amount = 2500.00m },
        ]);
        var factory = CreateFactory(parser);
        var months = new List<TransactionMonth>();
        var sut = CreateProcessor(factory, months, creditDescriptionMappings: [mapping]);

        await sut.ProcessAsync(Email, Account, CreateFile());

        var month = Assert.Single(months);
        Assert.Equal("Groceries", month.Transactions.Single(t => t.Description == "COLES 0717 TURRAMURRA AUS").Category);
        Assert.Equal("", month.Transactions.Single(t => t.Description == "Salary").Category);
    }

    [Fact]
    public async Task ProcessAsync_PrefersTheMostPreciseCreditDescriptionMapping_WhenMoreThanOneMatches()
    {
        var mapping = new CreditDescriptionMapping
        {
            Email = Email,
            Mappings =
            [
                new CreditDescriptionMappingEntry { DescriptionStart = "COLES", Category = "Groceries" },
                new CreditDescriptionMappingEntry { DescriptionStart = "COLES 0717", Category = "Specific Coles" },
            ],
        };
        var parser = new Mock<ICsvParser>();
        parser.Setup(p => p.Parse(Account)).Returns(
        [
            new Transaction { Account = Account, Date = new DateOnly(2026, 6, 1), Description = "COLES 0717 TURRAMURRA AUS", Category = "", Amount = -20m },
        ]);
        var factory = CreateFactory(parser);
        var months = new List<TransactionMonth>();
        var sut = CreateProcessor(factory, months, creditDescriptionMappings: [mapping]);

        await sut.ProcessAsync(Email, Account, CreateFile());

        var month = Assert.Single(months);
        Assert.Equal("Specific Coles", month.Transactions.Single().Category);
    }

    private static IFormFile CreateFile() => new FormFile(new MemoryStream(), 0, 0, "file", "transactions.csv");

    private static Mock<ICSVParserFactory> CreateFactory(Mock<ICsvParser> parser)
    {
        var factory = new Mock<ICSVParserFactory>();
        factory.Setup(f => f.Create(It.IsAny<CsvReader>())).Returns(parser.Object);
        return factory;
    }

    private static CsvProcessor CreateProcessor(
        Mock<ICSVParserFactory> factory,
        List<TransactionMonth> months,
        List<User>? users = null,
        List<TransactionDescriptions>? transactionDescriptions = null,
        List<CreditDescriptionMapping>? creditDescriptionMappings = null)
    {
        var transactionRepository = RepositoryMockFactory.Create(months);
        var userRepository = RepositoryMockFactory.Create(users ?? [new User { Email = Email, PasswordHash = "hash" }]);
        var transactionDescriptionsRepository = RepositoryMockFactory.Create(transactionDescriptions ?? []);
        var creditDescriptionMappingRepository = RepositoryMockFactory.Create(creditDescriptionMappings ?? []);
        return new CsvProcessor(
            factory.Object,
            transactionRepository.Object,
            userRepository.Object,
            transactionDescriptionsRepository.Object,
            creditDescriptionMappingRepository.Object,
            NullLogger<CsvProcessor>.Instance);
    }
}
