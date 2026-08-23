using System.Text.Json.Serialization;
using Amazon.Lambda.AspNetCoreServer;
using Amazon.Lambda.AspNetCoreServer.Hosting;
using Amazon.Lambda.Core;
using Microsoft.AspNetCore.Mvc.Controllers;
using Pim.Api.IoC;
using Pim.Api.Middleware;

var builder = WebApplication.CreateBuilder(args);

// Captured once, up front - ConfigureApplicationPartManager's callback runs deferred (later, during
// host build), so calling builder.Environment.IsEnvironment("Local") from inside it directly is not
// guaranteed to observe the same environment as code that reads it eagerly (e.g. ServiceMapping
// below). A single eagerly-captured value keeps every environment-dependent branch in this file
// consistent with each other.
var isLocal = builder.Environment.IsEnvironment("Local");

builder.Services.AddAWSLambdaHosting(LambdaEventSource.HttpApi);

// Add services to the container.
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();
builder.Services.AddControllers()
    .AddJsonOptions(options => options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()))
    .ConfigureApplicationPartManager(apm =>
    {
        // AddControllers() already registered the default ControllerFeatureProvider - adding
        // ours alongside it (rather than instead of it) would be a no-op, since the default one
        // independently adds every controller (including LoginController) to the feature
        // regardless of what any other provider decides.
        var defaultProvider = apm.FeatureProviders.OfType<ControllerFeatureProvider>().Single();
        apm.FeatureProviders.Remove(defaultProvider);
        apm.FeatureProviders.Add(new EnvironmentControllerFeatureProvider(isLocal));
    });

ServiceMapping.MapServices(builder, isLocal);

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

app.UseMiddleware<RequestResponseLoggingMiddleware>();

// Configure the HTTP request pipeline.
if (isLocal)
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
