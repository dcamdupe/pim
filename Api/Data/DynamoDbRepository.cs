using System.Reflection;
using System.Text.Json;
using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.Model;
using MongoDB.Bson.Serialization.Attributes;

namespace Pim.Api.Data;

public sealed class DynamoDbRepository<T> : IRepository<T> where T : class
{
    private const string Store = "DynamoDB";
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
        _logger.DbRequest(Store, nameof(GetAsync), _tableName, id);
        var response = await _client.GetItemAsync(_tableName, IdKey(id));
        if (!response.IsItemSet)
        {
            _logger.DbResponse(Store, nameof(GetAsync), _tableName, id, "found=false");
            return null;
        }

        _logger.DbResponse(Store, nameof(GetAsync), _tableName, id, "found=true");
        return JsonSerializer.Deserialize<T>(response.Item[DataAttribute].S);
    }

    public Task AddAsync(T entity) => PutAsync(nameof(AddAsync), (string)IdProperty.GetValue(entity)!, entity);

    public Task UpdateAsync(string id, T entity) => PutAsync(nameof(UpdateAsync), id, entity);

    public async Task DeleteAsync(string id)
    {
        _logger.DbRequest(Store, nameof(DeleteAsync), _tableName, id);
        await _client.DeleteItemAsync(_tableName, IdKey(id));
        _logger.DbResponse(Store, nameof(DeleteAsync), _tableName, id, string.Empty);
    }

    private async Task PutAsync(string operation, string id, T entity)
    {
        _logger.DbRequest(Store, operation, _tableName, id);
        await _client.PutItemAsync(_tableName, new Dictionary<string, AttributeValue>
        {
            [IdAttribute] = new(id),
            [DataAttribute] = new(JsonSerializer.Serialize(entity)),
        });
        _logger.DbResponse(Store, operation, _tableName, id, string.Empty);
    }

    private static Dictionary<string, AttributeValue> IdKey(string id) =>
        new() { [IdAttribute] = new AttributeValue(id) };
}
