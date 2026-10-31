using Microsoft.AspNetCore.Http;
using Pim.Api.Data;

namespace Pim.Api.Services;

public interface IFileProcessor
{
    /// <exception cref="FileParseException">The file could not be parsed.</exception>
    // user is the caller's already-loaded record, so the upload doesn't re-read it.
    Task ProcessAsync(User user, string account, IFormFile file);
}
