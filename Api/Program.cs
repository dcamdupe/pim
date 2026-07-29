using System.Text.Json.Serialization;
using Amazon.Lambda.AspNetCoreServer;
using Amazon.Lambda.AspNetCoreServer.Hosting;
using Amazon.Lambda.Core;
using Pim.Api.IoC;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddAWSLambdaHosting(LambdaEventSource.HttpApi);

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();
builder.Services.AddControllers()
    .AddJsonOptions(options => options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));

ServiceMapping.MapServices(builder);

var app = builder.Build();

// In Lambda, prefix logs with the actual Lambda request id (not ASP.NET Core's own generated
// TraceIdentifier) so log lines can be cross-referenced with CloudWatch/API Gateway/X-Ray. Runs
// first in the pipeline, before anything else can log. No-op locally, since there's no Lambda
// context outside a real Lambda invocation.
app.Use(async (context, next) =>
{
    if (context.Items[AbstractAspNetCoreFunction.LAMBDA_CONTEXT] is ILambdaContext lambdaContext)
    {
        context.TraceIdentifier = lambdaContext.AwsRequestId;
    }

    await next();
});

// Configure the HTTP request pipeline.
if (app.Environment.IsEnvironment("Local"))
{
    app.MapOpenApi();
}
else
{
    app.UseHttpsRedirection();
}

app.UseCors(ServiceMapping.FrontEndCorsPolicy);

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

public partial class Program;
