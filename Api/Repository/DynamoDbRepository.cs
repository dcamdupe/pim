using System.Reflection;
using System.Text.Json;
using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.Model;
using MongoDB.Bson.Serialization.Attributes;

namespace Pim.Api.Repository;

public sealed class DynamoDbRepository<T> : IRepository<T> where T : class
{
    private const string IdAttribute = "id";
    private const string DataAttribute = "data";

    private static readonly PropertyInfo IdProperty = typeof(T)
        .GetProperties()
        .Single(p => p.GetCustomAttribute<BsonIdAttribute>() is not null);

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
        return JsonSerializer.Deserialize<T>(response.Item[DataAttribute].S);
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
            [DataAttribute] = new(JsonSerializer.Serialize(entity)),
        });
        _logger.LogInformation("DynamoDB {Operation} response: table={Table} id={Id}", operation, _tableName, id);
    }

    private static Dictionary<string, AttributeValue> IdKey(string id) =>
        new() { [IdAttribute] = new AttributeValue(id) };
}
