namespace Pim.Api.Services;

public sealed class CsvParseException : Exception
{
    public CsvParseException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}
