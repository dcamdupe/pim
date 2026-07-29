using System.Reflection;
using Moq;
using Pim.Api.Repository;

namespace Pim.Api.UnitTests.Helpers;

internal static class RepositoryMockFactory
{
    public static Mock<IRepository<T>> Create<T>(List<T> items) where T : class
    {
        var idProperty = GetIdProperty<T>();
        var mock = new Mock<IRepository<T>>();

        mock.Setup(r => r.GetAsync(It.IsAny<string>()))
            .ReturnsAsync((string id) => items.FirstOrDefault(item => GetId(item, idProperty) == id));

        mock.Setup(r => r.AddAsync(It.IsAny<T>()))
            .Returns((T entity) =>
            {
                items.Add(entity);
                return Task.CompletedTask;
            });

        mock.Setup(r => r.UpdateAsync(It.IsAny<string>(), It.IsAny<T>()))
            .Returns((string id, T entity) =>
            {
                var index = items.FindIndex(item => GetId(item, idProperty) == id);
                if (index >= 0)
                {
                    items[index] = entity;
                }

                return Task.CompletedTask;
            });

        mock.Setup(r => r.DeleteAsync(It.IsAny<string>()))
            .Returns((string id) =>
            {
                items.RemoveAll(item => GetId(item, idProperty) == id);
                return Task.CompletedTask;
            });

        return mock;
    }

    private static PropertyInfo GetIdProperty<T>()
    {
        var type = typeof(T);
        var property = type.GetProperties()
            .FirstOrDefault(p => p.IsDefined(typeof(IdAttribute), inherit: true))
            ?? type.GetProperty("Id");

        return property ?? throw new InvalidOperationException(
            $"Type '{type.Name}' has no [Id] property or a property named 'Id' to key mocked lookups on.");
    }

    private static string GetId<T>(T entity, PropertyInfo idProperty) =>
        (string)(idProperty.GetValue(entity)
            ?? throw new InvalidOperationException($"Id property '{idProperty.Name}' returned null."));
}
