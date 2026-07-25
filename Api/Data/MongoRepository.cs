using MongoDB.Driver;

namespace Pim.Api.Data;

public sealed class MongoRepository<T> : IRepository<T> where T : class
{
    private readonly IMongoCollection<T> _collection;

    public MongoRepository(IMongoDatabase database)
    {
        _collection = database.GetCollection<T>(typeof(T).Name);
    }

    public Task<T?> GetAsync(string id) =>
        _collection.Find(IdFilter(id)).FirstOrDefaultAsync()!;

    public Task AddAsync(T entity) => _collection.InsertOneAsync(entity);

    public Task UpdateAsync(string id, T entity) =>
        _collection.ReplaceOneAsync(IdFilter(id), entity);

    public Task DeleteAsync(string id) =>
        _collection.DeleteOneAsync(IdFilter(id));

    private static FilterDefinition<T> IdFilter(string id) =>
        Builders<T>.Filter.Eq("_id", id);
}
