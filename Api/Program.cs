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

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddAWSLambdaHosting(LambdaEventSource.HttpApi);

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();
builder.Services.AddControllers();

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

const string FrontEndDevCorsPolicy = "FrontEndDev";
builder.Services.AddCors(options =>
{
    options.AddPolicy(FrontEndDevCorsPolicy, policy =>
        policy.WithOrigins("http://localhost:5173")
            .AllowAnyHeader()
            .AllowAnyMethod());
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsEnvironment("Local"))
{
    app.MapOpenApi();
    app.UseCors(FrontEndDevCorsPolicy);
}
else
{
    app.UseHttpsRedirection();
}

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

public partial class Program;
