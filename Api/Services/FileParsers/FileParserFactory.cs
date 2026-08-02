namespace Pim.Api.Services.FileParsers;

public sealed class FileParserFactory : IFileParserFactory
{
    public IFileParser Create(Stream fileStream, string fileName)
    {
        var extension = Path.GetExtension(fileName);

        if (string.Equals(extension, ".qif", StringComparison.OrdinalIgnoreCase))
        {
            return new QifParser(fileStream);
        }

        throw new NotSupportedException($"Unsupported file type: \"{fileName}\".");
    }
}
