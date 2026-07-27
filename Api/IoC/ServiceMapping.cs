using System.Text;
using Amazon;
using Amazon.DynamoDBv2;
using Amazon.Lambda.AspNetCoreServer.Hosting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using MongoDB.Driver;
using Pim.Api.Auth;
using Pim.Api.Data;

namespace Pim.Api.IoC;

public static class ServiceMapping
{
    public const string FrontEndCorsPolicy = "FrontEnd";

    public static void MapServices(WebApplicationBuilder builder)
    {
        // DynamoDB is used whenever MongoSettings isn't configured (i.e. in
        // production/Lambda, where appsettings.Production.json has no MongoSettings
        // section) - MongoSettings is only present locally, via appsettings.Local.json.
        if (builder.Configuration.GetSection("MongoSettings").Exists())
        {
            builder.Services.Configure<MongoSettings>(builder.Configuration.GetSection("MongoSettings"));
            builder.Services.AddSingleton<IMongoClient>(sp =>
                new MongoClient(sp.GetRequiredService<IOptions<MongoSettings>>().Value.ConnectionString));
            builder.Services.AddSingleton(sp =>
                sp.GetRequiredService<IMongoClient>().GetDatabase(sp.GetRequiredService<IOptions<MongoSettings>>().Value.DatabaseName));
            builder.Services.AddScoped(typeof(IRepository<>), typeof(MongoRepository<>));
        }
        else
        {
            builder.Services.Configure<AwsSettings>(builder.Configuration.GetSection("Aws"));
            builder.Services.AddSingleton<IAmazonDynamoDB>(sp =>
                new AmazonDynamoDBClient(RegionEndpoint.GetBySystemName(sp.GetRequiredService<IOptions<AwsSettings>>().Value.Region)));
            builder.Services.AddScoped(typeof(IRepository<>), typeof(DynamoDbRepository<>));
        }

        builder.Services.Configure<JwtSettings>(builder.Configuration.GetSection("JwtSettings"));
        builder.Services.AddSingleton<IJwtTokenGenerator, JwtTokenGenerator>();
        builder.Services.AddScoped<IAuthenticationLocal, AuthenticationLocal>();

        var jwtSettings = builder.Configuration.GetSection("JwtSettings").Get<JwtSettings>()
            ?? throw new InvalidOperationException("JwtSettings configuration section is missing.");

        builder.Services
            .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = jwtSettings.Issuer,
                    ValidateAudience = true,
                    ValidAudience = jwtSettings.Audience,
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings.SigningKey)),
                    ValidateLifetime = true,
                };
            });
        builder.Services.AddAuthorization();

        AddCors(builder);
    }

    // Local dev and Production run on different origins, so the allowed
    // origin has to switch with the environment - explicit per-environment
    // mapping (rather than "anything not Local") so an unrecognized
    // environment name fails loudly instead of silently getting the
    // Production origin.
    private static void AddCors(WebApplicationBuilder builder)
    {
        var origin = builder.Environment.EnvironmentName switch
        {
            "Local" => "http://localhost:5173",
            "Production" => "https://pim.uberconcept.com",
            _ => throw new InvalidOperationException(
                $"No CORS origin configured for environment \"{builder.Environment.EnvironmentName}\"."),
        };

        builder.Services.AddCors(options =>
        {
            options.AddPolicy(FrontEndCorsPolicy, policy =>
                policy.WithOrigins(origin)
                    .AllowAnyHeader()
                    .AllowAnyMethod());
        });
    }
}
