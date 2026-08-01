using Pim.Api.Data;

namespace Pim.Api.Services.CSVParsers;

public interface IFileParser
{
    List<Transaction> Parse(string account);
}
