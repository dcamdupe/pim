using MongoDB.Driver;

namespace Pim.Api.Data;

public sealed class MongoRepository<T> : IRepository<T> where T : class
{
    private const string Store = "Mongo";

    private readonly IMongoCollection<T> _collection;
    private readonly ILogger<MongoRepository<T>> _logger;
    private readonly string _collectionName = typeof(T).Name;

    public MongoRepository(IMongoDatabase database, ILogger<MongoRepository<T>> logger)
    {
        _collection = database.GetCollection<T>(_collectionName);
        _logger = logger;
    }

    public async Task<T?> GetAsync(string id)
    {
        _logger.DbRequest(Store, nameof(GetAsync), _collectionName, id);
        var result = await _collection.Find(IdFilter(id)).FirstOrDefaultAsync();
        _logger.DbResponse(Store, nameof(GetAsync), _collectionName, id, $"found={result is not null}");
        return result;
    }

    public async Task AddAsync(T entity)
    {
        _logger.DbRequest(Store, nameof(AddAsync), _collectionName, string.Empty);
        await _collection.InsertOneAsync(entity);
        _logger.DbResponse(Store, nameof(AddAsync), _collectionName, string.Empty, string.Empty);
    }

    public async Task UpdateAsync(string id, T entity)
    {
        _logger.DbRequest(Store, nameof(UpdateAsync), _collectionName, id);
        var result = await _collection.ReplaceOneAsync(IdFilter(id), entity);
        _logger.DbResponse(Store, nameof(UpdateAsync), _collectionName, id, $"matched={result.MatchedCount}");
    }

    public async Task DeleteAsync(string id)
    {
        _logger.DbRequest(Store, nameof(DeleteAsync), _collectionName, id);
        var result = await _collection.DeleteOneAsync(IdFilter(id));
        _logger.DbResponse(Store, nameof(DeleteAsync), _collectionName, id, $"deleted={result.DeletedCount}");
    }

    private static FilterDefinition<T> IdFilter(string id) =>
        Builders<T>.Filter.Eq("_id", id);
}
