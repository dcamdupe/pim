using System.Globalization;
using System.Text;
using CsvHelper;
using CsvHelper.Configuration;
using Pim.Api.Services.CSVParsers;

namespace Pim.Api.UnitTests.Services.CSVParsers;

public class TmBankCsvParserTests
{
    private const string Account = "Everyday";

    [Fact]
    public void Parse_ReturnsTransactions_WithEmptyCategory_IgnoringHeaderRow()
    {
        var csv = "Date,Ignore,Description,Amount,Ignore\n01 JUN 2026,x,Coffee Shop,-4.50,x\n15 JUN 2026,x,Salary,2500.00,x\n";
        var sut = CreateParser(csv);

        var transactions = sut.Parse(Account);

        Assert.Equal(2, transactions.Count);
        Assert.All(transactions, t => Assert.Equal(Account, t.Account));
        Assert.All(transactions, t => Assert.Equal(string.Empty, t.Category));
        Assert.Contains(transactions, t => t.Date == new DateOnly(2026, 6, 1) && t.Description == "Coffee Shop" && t.Amount == -4.50m);
        Assert.Contains(transactions, t => t.Date == new DateOnly(2026, 6, 15) && t.Description == "Salary" && t.Amount == 2500.00m);
    }

    [Fact]
    public void Parse_SkipsBlankTrailingLines()
    {
        var csv = "Date,Ignore,Description,Amount,Ignore\n01 JUN 2026,x,Coffee Shop,-4.50,x\n\n";
        var sut = CreateParser(csv);

        var transactions = sut.Parse(Account);

        Assert.Single(transactions);
    }

    [Fact]
    public void Parse_Throws_WhenDateCannotBeParsed()
    {
        var csv = "Date,Ignore,Description,Amount,Ignore\nnot-a-date,x,Coffee,-4.50,x\n";
        var sut = CreateParser(csv);

        Assert.Throws<FormatException>(() => sut.Parse(Account));
    }

    [Fact]
    public void Parse_Throws_WhenAmountCannotBeParsed()
    {
        var csv = "Date,Ignore,Description,Amount,Ignore\n01 JUN 2026,x,Coffee,not-a-number,x\n";
        var sut = CreateParser(csv);

        Assert.Throws<FormatException>(() => sut.Parse(Account));
    }

    private static TmBankCsvParser CreateParser(string content)
    {
        var reader = new StreamReader(new MemoryStream(Encoding.UTF8.GetBytes(content)));
        var csv = new CsvReader(reader, new CsvConfiguration(CultureInfo.InvariantCulture) { HasHeaderRecord = false });
        return new TmBankCsvParser(csv);
    }
}
