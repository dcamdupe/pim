using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Pim.Api.IntegrationTests;

public sealed class EnvironmentGatingTests : IClassFixture<NonLocalApiWebApplicationFactory>
{
    private readonly NonLocalApiWebApplicationFactory _factory;

    public EnvironmentGatingTests(NonLocalApiWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Theory]
    [InlineData("/login")]
    [InlineData("/login/refresh")]
    public async Task LoginEndpoints_ReturnNotFound_OutsideLocal(string url)
    {
        // https base address so UseHttpsRedirection (active outside Local) doesn't 307 the
        // request before routing ever runs.
        var client = _factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("https://localhost") });

        var response = await client.PostAsync(url, content: null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
