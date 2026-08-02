namespace Pim.Api.Services;

public sealed class FileParseException : Exception
{
    public FileParseException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}
