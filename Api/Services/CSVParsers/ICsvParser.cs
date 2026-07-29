using Pim.Api.Data;

namespace Pim.Api.Services.CSVParsers;

public interface ICsvParser
{
    List<Transaction> Parse(string account);
}
