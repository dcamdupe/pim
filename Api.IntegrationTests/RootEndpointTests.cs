using System.Net;
using System.Net.Http.Json;
using Pim.Api.Controllers;

namespace Pim.Api.IntegrationTests;

public sealed class RootEndpointTests : IClassFixture<ApiWebApplicationFactory>
{
    private readonly ApiWebApplicationFactory _factory;

    public RootEndpointTests(ApiWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Get_ReturnsOkWithVersion()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync("/");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<RootResponse>();
        Assert.False(string.IsNullOrWhiteSpace(body?.Version));
    }
}
