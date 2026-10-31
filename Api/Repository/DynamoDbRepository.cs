using System.Diagnostics;
using System.Reflection;
using System.Text.Json;
using System.Text.Json.Serialization;
using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.Model;

namespace Pim.Api.Repository;

public sealed class DynamoDbRepository<T> : IRepository<T> where T : class
{
    private const string IdAttribute = "id";
    private const string DataAttribute = "data";
    private const int MaxBatchGetKeys = 100;
    private const int MaxUnprocessedRetries = 5;

    // Matches Program.cs's controller JSON options - enums round-trip as readable strings (e.g.
    // "Expense") rather than the default int encoding, so stored data is human-inspectable/editable
    // (as setup_local.sh's seed data relies on) and consistent with what the Api's own HTTP layer
    // writes/reads. JsonStringEnumConverter's reader still accepts the old int encoding too, so this
    // doesn't break any enum values written before this option existed.
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        Converters = { new JsonStringEnumConverter() },
    };

    private static readonly PropertyInfo IdProperty = typeof(T)
        .GetProperties()
        .Single(p => p.GetCustomAttribute<IdAttribute>() is not null);

    private readonly IAmazonDynamoDB _client;
    private readonly ILogger<DynamoDbRepository<T>> _logger;
    private readonly string _tableName = typeof(T).Name;

    public DynamoDbRepository(IAmazonDynamoDB client, ILogger<DynamoDbRepository<T>> logger)
    {
        _client = client;
        _logger = logger;
    }

    public async Task<T?> GetAsync(string id)
    {
        _logger.LogInformation("DynamoDB GetAsync request: table={Table} id={Id}", _tableName, id);
        var stopwatch = Stopwatch.StartNew();
        var response = await _client.GetItemAsync(_tableName, IdKey(id));
        stopwatch.Stop();
        if (!response.IsItemSet)
        {
            _logger.LogInformation(
                "DynamoDB GetAsync response: table={Table} id={Id} found=false elapsedMs={ElapsedMs}",
                _tableName, id, stopwatch.ElapsedMilliseconds);
            return null;
        }

        _logger.LogInformation(
            "DynamoDB GetAsync response: table={Table} id={Id} found=true elapsedMs={ElapsedMs}",
            _tableName, id, stopwatch.ElapsedMilliseconds);
        return JsonSerializer.Deserialize<T>(response.Item[DataAttribute].S, JsonOptions);
    }

    public async Task<List<T>> GetManyAsync(IEnumerable<string> ids)
    {
        // BatchGetItem rejects duplicate keys and caps each call at 100 keys.
        var distinctIds = ids.Distinct(StringComparer.Ordinal).ToList();
        _logger.LogInformation("DynamoDB GetManyAsync request: table={Table} count={Count}", _tableName, distinctIds.Count);
        var stopwatch = Stopwatch.StartNew();

        var results = new List<T>();
        foreach (var chunk in distinctIds.Chunk(MaxBatchGetKeys))
        {
            var pending = new Dictionary<string, KeysAndAttributes>
            {
                [_tableName] = new() { Keys = chunk.Select(IdKey).ToList() },
            };

            for (var attempt = 0; pending.Count > 0; attempt++)
            {
                if (attempt > 0)
                {
                    if (attempt > MaxUnprocessedRetries)
                    {
                        throw new InvalidOperationException(
                            $"DynamoDB BatchGetItem on {_tableName} still had unprocessed keys after {MaxUnprocessedRetries} retries.");
                    }

                    // Exponential backoff for throttled/unprocessed keys, as AWS recommends.
                    await Task.Delay(TimeSpan.FromMilliseconds(50 * Math.Pow(2, attempt - 1)));
                }

                var response = await _client.BatchGetItemAsync(new BatchGetItemRequest { RequestItems = pending });
                if (response.Responses is not null && response.Responses.TryGetValue(_tableName, out var items))
                {
                    results.AddRange(items.Select(item => JsonSerializer.Deserialize<T>(item[DataAttribute].S, JsonOptions)!));
                }

                pending = response.UnprocessedKeys ?? [];
            }
        }

        stopwatch.Stop();
        _logger.LogInformation(
            "DynamoDB GetManyAsync response: table={Table} count={Count} found={Found} elapsedMs={ElapsedMs}",
            _tableName, distinctIds.Count, results.Count, stopwatch.ElapsedMilliseconds);
        return results;
    }

    public Task AddAsync(T entity) => PutAsync("AddAsync", (string)IdProperty.GetValue(entity)!, entity);

    public Task UpdateAsync(string id, T entity) => PutAsync("UpdateAsync", id, entity);

    public async Task DeleteAsync(string id)
    {
        _logger.LogInformation("DynamoDB DeleteAsync request: table={Table} id={Id}", _tableName, id);
        var stopwatch = Stopwatch.StartNew();
        await _client.DeleteItemAsync(_tableName, IdKey(id));
        stopwatch.Stop();
        _logger.LogInformation(
            "DynamoDB DeleteAsync response: table={Table} id={Id} elapsedMs={ElapsedMs}",
            _tableName, id, stopwatch.ElapsedMilliseconds);
    }

    private async Task PutAsync(string operation, string id, T entity)
    {
        _logger.LogInformation("DynamoDB {Operation} request: table={Table} id={Id}", operation, _tableName, id);
        var stopwatch = Stopwatch.StartNew();
        await _client.PutItemAsync(_tableName, new Dictionary<string, AttributeValue>
        {
            [IdAttribute] = new(id),
            [DataAttribute] = new(JsonSerializer.Serialize(entity, JsonOptions)),
        });
        stopwatch.Stop();
        _logger.LogInformation(
            "DynamoDB {Operation} response: table={Table} id={Id} elapsedMs={ElapsedMs}",
            operation, _tableName, id, stopwatch.ElapsedMilliseconds);
    }

    private static Dictionary<string, AttributeValue> IdKey(string id) =>
        new() { [IdAttribute] = new AttributeValue(id) };
}
