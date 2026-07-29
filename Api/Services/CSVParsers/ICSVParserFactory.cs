using CsvHelper;

namespace Pim.Api.Services.CSVParsers;

public interface ICSVParserFactory
{
    ICsvParser Create(CsvReader reader);
}
