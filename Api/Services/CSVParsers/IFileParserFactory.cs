namespace Pim.Api.Services.CSVParsers;

public interface IFileParserFactory
{
    IFileParser Create(Stream fileStream, string fileName);
}
