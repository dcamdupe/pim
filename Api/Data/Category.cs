namespace Pim.Api.Data;

public sealed class Category
{
    public required string Name { get; set; }

    public required string Colour { get; set; }

    public required CategoryType Type { get; set; }

    public enum CategoryType
    {
        Income,
        Expense,
        Ignore,
    }

    // Denormalizes this category's Type onto a transaction whenever its Category is set or changed
    // - callers only invoke this on an actual category change, not every save, so it doesn't fight
    // the independent manual "Ignore/Unignore" toggle on Transaction.Ignore. A Type of Ignore
    // additionally sets Transaction.Ignore, giving it the same dashboard/listing effect a category
    // explicitly meant to be excluded should have.
    public static void StampTransaction(Transaction transaction, IEnumerable<Category> categories)
    {
        var category = categories.FirstOrDefault(c => c.Name == transaction.Category);
        transaction.Type = category?.Type;
        transaction.Ignore = category is null ? null : category.Type == CategoryType.Ignore;
    }
}
