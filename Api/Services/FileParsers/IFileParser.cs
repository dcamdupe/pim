using Pim.Api.Data;

namespace Pim.Api.Services.FileParsers;

public interface IFileParser
{
    List<Transaction> Parse(string account);
}
