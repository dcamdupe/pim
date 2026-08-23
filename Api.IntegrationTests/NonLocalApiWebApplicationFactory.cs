using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Pim.Api.IntegrationTests;

// Hosts the Api under a non-Local environment name (matching Production's auth wiring - see
// ServiceMapping.AddCognitoAuthentication) so environment-gated behavior (UBE-39: LoginController
// only exists in Local) can be exercised without needing a real Cognito user pool. The
// CognitoSettings values here are never actually validated against - the tests using this factory
// only need the host to start, not a real token to be presented.
//
// Set as process environment variables (rather than via ConfigureWebHost's ConfigureAppConfiguration)
// because Program.cs reads WebApplicationBuilder.Configuration synchronously, inside its own
// top-level statements, before builder.Build() - by that point it's too late for the test host's
// own config customizations (only merged in at Build()) to be visible, but WebApplication.CreateBuilder
// already includes environment variables as a config source at construction time, matching exactly
// how Terraform supplies these values to the real Lambda.
public sealed class NonLocalApiWebApplicationFactory : WebApplicationFactory<Program>
{
    public NonLocalApiWebApplicationFactory()
    {
        Environment.SetEnvironmentVariable(
            "CognitoSettings__Authority", "https://cognito-idp.ap-southeast-2.amazonaws.com/ap-southeast-2_test");
        Environment.SetEnvironmentVariable("CognitoSettings__AppClientId", "test-client-id");
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder) => builder.UseEnvironment("Production");
}
