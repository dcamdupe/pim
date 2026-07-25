using Microsoft.AspNetCore.Mvc;
using MongoDB.Bson;
using MongoDB.Driver;

namespace Pim.Api.Controllers;

[ApiController]
[Route("/")]
public sealed class RootController : ControllerBase
{
    private readonly IMongoDatabase _database;
    private readonly IConfiguration _configuration;

    public RootController(IMongoDatabase database, IConfiguration configuration)
    {
        _database = database;
        _configuration = configuration;
    }

    [HttpGet]
    public async Task<ActionResult<RootResponse>> Get()
    {
        try
        {
            await _database.RunCommandAsync<BsonDocument>(new BsonDocument("ping", 1));
        }
        catch (MongoException ex)
        {
            return MongoUnavailable(ex);
        }
        catch (TimeoutException ex)
        {
            return MongoUnavailable(ex);
        }

        var version = _configuration["Version"] ?? "unknown";
        return Ok(new RootResponse(version));
    }

    private ObjectResult MongoUnavailable(Exception ex) =>
        Problem(
            title: "Unable to connect to MongoDB",
            detail: ex.Message,
            statusCode: StatusCodes.Status503ServiceUnavailable);
}

public sealed record RootResponse(string Version);
