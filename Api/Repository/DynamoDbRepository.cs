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
        var response = await _client.GetItemAsync(_tableName, IdKey(id));
        if (!response.IsItemSet)
        {
            _logger.LogInformation("DynamoDB GetAsync response: table={Table} id={Id} found=false", _tableName, id);
            return null;
        }

        _logger.LogInformation("DynamoDB GetAsync response: table={Table} id={Id} found=true", _tableName, id);
        return JsonSerializer.Deserialize<T>(response.Item[DataAttribute].S, JsonOptions);
    }

    public Task AddAsync(T entity) => PutAsync("AddAsync", (string)IdProperty.GetValue(entity)!, entity);

    public Task UpdateAsync(string id, T entity) => PutAsync("UpdateAsync", id, entity);

    public async Task DeleteAsync(string id)
    {
        _logger.LogInformation("DynamoDB DeleteAsync request: table={Table} id={Id}", _tableName, id);
        await _client.DeleteItemAsync(_tableName, IdKey(id));
        _logger.LogInformation("DynamoDB DeleteAsync response: table={Table} id={Id}", _tableName, id);
    }

    private async Task PutAsync(string operation, string id, T entity)
    {
        _logger.LogInformation("DynamoDB {Operation} request: table={Table} id={Id}", operation, _tableName, id);
        await _client.PutItemAsync(_tableName, new Dictionary<string, AttributeValue>
        {
            [IdAttribute] = new(id),
            [DataAttribute] = new(JsonSerializer.Serialize(entity, JsonOptions)),
        });
        _logger.LogInformation("DynamoDB {Operation} response: table={Table} id={Id}", operation, _tableName, id);
    }

    private static Dictionary<string, AttributeValue> IdKey(string id) =>
        new() { [IdAttribute] = new AttributeValue(id) };
}
