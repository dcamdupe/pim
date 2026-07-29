using System.Globalization;
using System.Text;
using CsvHelper;
using CsvHelper.Configuration;
using Pim.Api.Services.CSVParsers;

namespace Pim.Api.UnitTests.Services.CSVParsers;

public class CSVParserFactoryTests
{
    [Fact]
    public void Create_ReturnsACsvParser()
    {
        var reader = new StreamReader(new MemoryStream(Encoding.UTF8.GetBytes("Date,Ignore,Description,Amount,Ignore\n")));
        var csv = new CsvReader(reader, new CsvConfiguration(CultureInfo.InvariantCulture) { HasHeaderRecord = false });
        var sut = new CSVParserFactory();

        var result = sut.Create(csv);

        Assert.IsType<TmBankCsvParser>(result);
    }
}
