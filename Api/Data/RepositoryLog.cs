namespace Pim.Api.Data;

// Shared LoggerMessage delegates for MongoRepository<T>/DynamoDbRepository<T>
// (CA1848 requires these over direct ILogger.LogInformation calls).
internal static partial class RepositoryLog
{
    [LoggerMessage(EventId = 1, Level = LogLevel.Information, Message = "{Store} {Operation} request: table={Table} id={Id}")]
    public static partial void DbRequest(this ILogger logger, string store, string operation, string table, string id);

    [LoggerMessage(EventId = 2, Level = LogLevel.Information, Message = "{Store} {Operation} response: table={Table} id={Id} {Detail}")]
    public static partial void DbResponse(this ILogger logger, string store, string operation, string table, string id, string detail);
}
