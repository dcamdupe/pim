namespace Pim.Api.Services.FileParsers;

public interface IFileParserFactory
{
    IFileParser Create(Stream fileStream, string fileName);
}
