using System.Text;
using Pim.Api.Services.FileParsers;

namespace Pim.Api.UnitTests.Services.FileParsers;

public class FileParserFactoryTests
{
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
