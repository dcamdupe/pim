namespace Pim.Api.Data;

// Shared LoggerMessage delegates for MongoRepository<T>/DynamoDbRepository<T>
// (CA1848 requires these over direct ILogger.LogInformation calls; CA1873
// requires typed parameters here rather than pre-formatted/interpolated
// strings, so the formatting is skipped entirely when logging is disabled).
internal static partial class RepositoryLog
{
    [LoggerMessage(EventId = 1, Level = LogLevel.Information, Message = "{Store} {Operation} request: table={Table} id={Id}")]
    public static partial void DbRequest(this ILogger logger, string store, string operation, string table, string id);

    [LoggerMessage(EventId = 2, Level = LogLevel.Information, Message = "{Store} {Operation} response: table={Table} id={Id}")]
    public static partial void DbResponse(this ILogger logger, string store, string operation, string table, string id);

    [LoggerMessage(EventId = 3, Level = LogLevel.Information, Message = "{Store} {Operation} response: table={Table} id={Id} found={Found}")]
    public static partial void DbResponseFound(this ILogger logger, string store, string operation, string table, string id, bool found);

    [LoggerMessage(EventId = 4, Level = LogLevel.Information, Message = "{Store} {Operation} response: table={Table} id={Id} count={Count}")]
    public static partial void DbResponseCount(this ILogger logger, string store, string operation, string table, string id, long count);
}
