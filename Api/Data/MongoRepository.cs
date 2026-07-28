using MongoDB.Driver;

namespace Pim.Api.Data;

public sealed class MongoRepository<T> : IRepository<T> where T : class
{
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
        _logger.LogInformation("Mongo GetAsync request: collection={Collection} id={Id}", _collectionName, id);
        var result = await _collection.Find(IdFilter(id)).FirstOrDefaultAsync();
        _logger.LogInformation(
            "Mongo GetAsync response: collection={Collection} id={Id} found={Found}", _collectionName, id, result is not null);
        return result;
    }

    public async Task AddAsync(T entity)
    {
        _logger.LogInformation("Mongo AddAsync request: collection={Collection}", _collectionName);
        await _collection.InsertOneAsync(entity);
        _logger.LogInformation("Mongo AddAsync response: collection={Collection}", _collectionName);
    }

    public async Task UpdateAsync(string id, T entity)
    {
        _logger.LogInformation("Mongo UpdateAsync request: collection={Collection} id={Id}", _collectionName, id);
        var result = await _collection.ReplaceOneAsync(IdFilter(id), entity);
        _logger.LogInformation(
            "Mongo UpdateAsync response: collection={Collection} id={Id} matched={Matched}",
            _collectionName, id, result.MatchedCount);
    }

    public async Task DeleteAsync(string id)
    {
        _logger.LogInformation("Mongo DeleteAsync request: collection={Collection} id={Id}", _collectionName, id);
        var result = await _collection.DeleteOneAsync(IdFilter(id));
        _logger.LogInformation(
            "Mongo DeleteAsync response: collection={Collection} id={Id} deleted={Deleted}",
            _collectionName, id, result.DeletedCount);
    }

    private static FilterDefinition<T> IdFilter(string id) =>
        Builders<T>.Filter.Eq("_id", id);
}
