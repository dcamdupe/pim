namespace Pim.Api.Repository;

public interface IRepository<T> where T : class
{
    Task<T?> GetAsync(string id);

    Task AddAsync(T entity);

    Task UpdateAsync(string id, T entity);

    Task DeleteAsync(string id);
}
