using System.Text;
using Amazon;
using Amazon.DynamoDBv2;
using Amazon.Lambda.AspNetCoreServer.Hosting;
using Amazon.Runtime;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using NLog.Web;
using Pim.Api.Auth;
using Pim.Api.Configuration;
using Pim.Api.Repository;
using Pim.Api.Services;
using Pim.Api.Services.FileParsers;

namespace Pim.Api.IoC;

public static class ServiceMapping
{
    public const string FrontEndCorsPolicy = "FrontEnd";

    public static void MapServices(WebApplicationBuilder builder, bool isLocal)
    {
        ConfigureLogging(builder);

        builder.Services.Configure<AwsSettings>(builder.Configuration.GetSection("Aws"));
        builder.Services.AddSingleton<IAmazonDynamoDB>(sp =>
        {
            var awsSettings = sp.GetRequiredService<IOptions<AwsSettings>>().Value;
            if (awsSettings.ServiceUrl is null)
            {
                return new AmazonDynamoDBClient(RegionEndpoint.GetBySystemName(awsSettings.Region));
            }

            // ServiceUrl is only set locally, to point at DynamoDB Local - it doesn't check
            // credentials, but the SDK still needs some static credentials supplied since
            // there's no real AWS environment/role to fall back to.
            return new AmazonDynamoDBClient(
                new BasicAWSCredentials("local", "local"),
                new AmazonDynamoDBConfig { ServiceURL = awsSettings.ServiceUrl });
        });
        builder.Services.AddScoped(typeof(IRepository<>), typeof(DynamoDbRepository<>));
        builder.Services.AddSingleton<IFileParserFactory, FileParserFactory>();
        builder.Services.AddScoped<IFileProcessor, FileProcessor>();
        builder.Services.AddScoped<ITransactionQueryService, TransactionQueryService>();
        builder.Services.AddScoped<ITransactionUpdateService, TransactionUpdateService>();
        builder.Services.AddScoped<IInternalTransferMatcher, InternalTransferMatcher>();

        if (isLocal)
        {
            AddLocalAuthentication(builder);
        }
        else
        {
            AddCognitoAuthentication(builder);
        }

        builder.Services.AddAuthorization();

        AddCors(builder);
    }

    // Local dev keeps the original email/password + self-signed JWT flow (LoginController),
    // since there's no real Cognito user pool to point a local build at.
    private static void AddLocalAuthentication(WebApplicationBuilder builder)
    {
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
            })
            .AddApiKey();
    }

    // Every non-Local environment authenticates via Cognito's Hosted UI (Google-federated);
    // the FrontEnd sends Cognito's ID token as the bearer token, which the JWT bearer
    // handler validates against the User Pool's own JWKS (via Authority). MapInboundClaims is
    // turned off to keep the token's own claim names ("email" etc.) rather than remapping them
    // via the default short-to-XML-namespace table, so CognitoClaimsMapper can find "email" and
    // derive ClaimTypes.NameIdentifier from it (see CognitoClaimsMapper for why).
    private static void AddCognitoAuthentication(WebApplicationBuilder builder)
    {
        var cognitoSettings = builder.Configuration.GetSection("CognitoSettings").Get<CognitoSettings>()
            ?? throw new InvalidOperationException("CognitoSettings configuration section is missing.");

        builder.Services
            .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.Authority = cognitoSettings.Authority;
                options.MapInboundClaims = false;
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = cognitoSettings.Authority,
                    ValidateAudience = true,
                    ValidAudience = cognitoSettings.AppClientId,
                    ValidateLifetime = true,
                };
                options.Events = new JwtBearerEvents
                {
                    OnTokenValidated = context =>
                    {
                        CognitoClaimsMapper.AddNameIdentifierFromEmail(context.Principal!);
                        return Task.CompletedTask;
                    },
                };
            })
            .AddApiKey();
    }

    // Replaces the default console provider with NLog (config in nlog.config)
    // rather than running both side by side.
    private static void ConfigureLogging(WebApplicationBuilder builder)
    {
        builder.Logging.ClearProviders();
        builder.Host.UseNLog();
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
