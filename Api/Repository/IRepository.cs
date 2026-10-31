namespace Pim.Api.Repository;

public interface IRepository<T> where T : class
{
    Task<T?> GetAsync(string id);

    // Fetches many items in as few round trips as possible; missing ids are omitted.
    Task<List<T>> GetManyAsync(IEnumerable<string> ids);

    Task AddAsync(T entity);

    Task UpdateAsync(string id, T entity);

    Task DeleteAsync(string id);
}
