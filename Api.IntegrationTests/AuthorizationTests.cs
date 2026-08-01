using System.Net;

namespace Pim.Api.IntegrationTests;

public sealed class AuthorizationTests : IClassFixture<ApiWebApplicationFactory>
{
    private readonly ApiWebApplicationFactory _factory;

    public AuthorizationTests(ApiWebApplicationFactory factory)
    {
        _factory = factory;
    }

    public static IEnumerable<object[]> ProtectedEndpoints()
    {
        yield return [HttpMethod.Get, "/settings"];
        yield return [HttpMethod.Put, "/settings"];
        yield return [HttpMethod.Get, "/transactions?startDate=2026-01-01&endDate=2026-01-31"];
        yield return [HttpMethod.Post, "/transactions/file"];
        yield return [HttpMethod.Put, "/transactions"];
        yield return [HttpMethod.Get, "/transactions/descriptions"];
        yield return [HttpMethod.Post, "/mapping/description"];
    }

    [Theory]
    [MemberData(nameof(ProtectedEndpoints))]
    public async Task ReturnsUnauthorized_WhenNoTokenIsProvided(HttpMethod method, string url)
    {
        var client = _factory.CreateClient();
        using var request = new HttpRequestMessage(method, url);

        var response = await client.SendAsync(request);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
