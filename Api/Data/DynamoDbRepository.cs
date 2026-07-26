using System.Reflection;
using System.Text.Json;
using Amazon.DynamoDBv2;
using Amazon.DynamoDBv2.Model;
using MongoDB.Bson.Serialization.Attributes;

namespace Pim.Api.Data;

public sealed class DynamoDbRepository<T> : IRepository<T> where T : class
{
    private const string IdAttribute = "id";
    private const string DataAttribute = "data";

    private static readonly PropertyInfo IdProperty = typeof(T)
        .GetProperties()
        .Single(p => p.GetCustomAttribute<BsonIdAttribute>() is not null);

    private readonly IAmazonDynamoDB _client;
    private readonly string _tableName = typeof(T).Name;

    public DynamoDbRepository(IAmazonDynamoDB client)
    {
        _client = client;
    }

    public async Task<T?> GetAsync(string id)
    {
        var response = await _client.GetItemAsync(_tableName, IdKey(id));
        if (!response.IsItemSet)
        {
            return null;
        }

        return JsonSerializer.Deserialize<T>(response.Item[DataAttribute].S);
    }

    public Task AddAsync(T entity) => PutAsync((string)IdProperty.GetValue(entity)!, entity);

    public Task UpdateAsync(string id, T entity) => PutAsync(id, entity);

    public Task DeleteAsync(string id) => _client.DeleteItemAsync(_tableName, IdKey(id));

    private Task<PutItemResponse> PutAsync(string id, T entity) =>
        _client.PutItemAsync(_tableName, new Dictionary<string, AttributeValue>
        {
            [IdAttribute] = new(id),
            [DataAttribute] = new(JsonSerializer.Serialize(entity)),
        });

    private static Dictionary<string, AttributeValue> IdKey(string id) =>
        new() { [IdAttribute] = new AttributeValue(id) };
}
