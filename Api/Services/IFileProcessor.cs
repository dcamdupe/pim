using Microsoft.AspNetCore.Http;

namespace Pim.Api.Services;

public interface IFileProcessor
{
    /// <exception cref="CsvParseException">The file could not be parsed.</exception>
    Task ProcessAsync(string email, string account, IFormFile file);
}
