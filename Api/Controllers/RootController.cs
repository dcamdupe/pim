using Microsoft.AspNetCore.Mvc;

namespace Pim.Api.Controllers;

[ApiController]
public sealed class RootController : ControllerBase
{
    private readonly IConfiguration _configuration;

    public RootController(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    [HttpGet("/")]
    public async Task<ActionResult<RootResponse>> Get()
    {
        var version = _configuration["Version"] ?? "unknown";
        return Ok(new RootResponse(version));
    }
}

public sealed record RootResponse(string Version);
