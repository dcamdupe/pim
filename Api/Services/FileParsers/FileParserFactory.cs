using System.Globalization;
using CsvHelper;
using CsvHelper.Configuration;

namespace Pim.Api.Services.CSVParsers;

public sealed class FileParserFactory : IFileParserFactory
{
    public IFileParser Create(Stream fileStream, string fileName)
    {
        var extension = Path.GetExtension(fileName);

        if (string.Equals(extension, ".csv", StringComparison.OrdinalIgnoreCase))
        {
            var reader = new StreamReader(fileStream);
            var csv = new CsvReader(reader, new CsvConfiguration(CultureInfo.InvariantCulture) { HasHeaderRecord = false });
            return new TmBankCsvParser(csv);
        }

        if (string.Equals(extension, ".qif", StringComparison.OrdinalIgnoreCase))
        {
            return new QifParser(fileStream);
        }

        throw new NotSupportedException($"Unsupported file type: \"{fileName}\".");
    }
}
