using Pim.Api.Auth;

namespace Pim.Api.UnitTests.Auth;

public class ApiKeyGeneratorTests
{
    [Fact]
    public void Generate_Returns40CharsFromLowercaseAlphanumericAlphabet()
    {
        var key = ApiKeyGenerator.Generate();

        Assert.Equal(40, key.Length);
        Assert.Matches("^[a-z0-9]{40}$", key);
    }

    [Fact]
    public void Generate_ReturnsADifferentValueEachCall()
    {
        var keys = Enumerable.Range(0, 100).Select(_ => ApiKeyGenerator.Generate()).ToList();

        Assert.Equal(keys.Count, keys.Distinct().Count());
    }
}
