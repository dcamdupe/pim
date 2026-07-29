using CsvHelper;

namespace Pim.Api.Services.CSVParsers;

public sealed class CSVParserFactory : ICSVParserFactory
{
    public ICsvParser Create(CsvReader reader) => new TmBankCsvParser(reader);
}
