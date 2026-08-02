using System.Text;
using Pim.Api.Services.CSVParsers;

namespace Pim.Api.UnitTests.Services.CSVParsers;

public class FileParserFactoryTests
{
    [Fact]
    public void Create_ReturnsATmBankCsvParser_ForACsvFile()
    {
        var stream = new MemoryStream(Encoding.UTF8.GetBytes("Date,Ignore,Description,Amount,Ignore\n"));
        var sut = new FileParserFactory();

        var result = sut.Create(stream, "transactions.csv");

        Assert.IsType<TmBankCsvParser>(result);
    }

    [Theory]
    [InlineData("transactions.CSV")]
    [InlineData("transactions.Csv")]
    public void Create_ReturnsATmBankCsvParser_RegardlessOfExtensionCasing(string fileName)
    {
        var stream = new MemoryStream(Encoding.UTF8.GetBytes("Date,Ignore,Description,Amount,Ignore\n"));
        var sut = new FileParserFactory();

        var result = sut.Create(stream, fileName);

        Assert.IsType<TmBankCsvParser>(result);
    }

    [Fact]
    public void Create_ReturnsAQifParser_ForAQifFile()
    {
        var stream = new MemoryStream(Encoding.UTF8.GetBytes("!Type:Bank\n"));
        var sut = new FileParserFactory();

        var result = sut.Create(stream, "transactions.qif");

        Assert.IsType<QifParser>(result);
    }

    [Fact]
    public void Create_Throws_ForAnUnrecognisedFileExtension()
    {
        var stream = new MemoryStream();
        var sut = new FileParserFactory();

        Assert.Throws<NotSupportedException>(() => sut.Create(stream, "transactions.pdf"));
    }

    [Fact]
    public void Create_Throws_WhenTheFileNameHasNoExtension()
    {
        var stream = new MemoryStream();
        var sut = new FileParserFactory();

        Assert.Throws<NotSupportedException>(() => sut.Create(stream, "transactions"));
    }
}
