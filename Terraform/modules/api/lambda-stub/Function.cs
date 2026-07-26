using Amazon.Lambda.APIGatewayEvents;
using Amazon.Lambda.Core;

[assembly: LambdaSerializer(typeof(Amazon.Lambda.Serialization.SystemTextJson.DefaultLambdaJsonSerializer))]

namespace Pim.Api.LambdaStub;

// Placeholder handler: the real Lambda code (adapting Api to run here) is a
// separate ticket. This exists only so Terraform has a real artifact to
// deploy - see the api module's `lifecycle.ignore_changes` on the
// Lambda's deployment package, which lets a future CI/CD pipeline replace
// this without Terraform reverting it.
public sealed class Function
{
    public APIGatewayHttpApiV2ProxyResponse Handler(APIGatewayHttpApiV2ProxyRequest request, ILambdaContext context)
    {
        return new APIGatewayHttpApiV2ProxyResponse
        {
            StatusCode = 200,
            Body = "{\"status\":\"placeholder - real Api Lambda handler not deployed yet\"}",
            Headers = new Dictionary<string, string> { ["Content-Type"] = "application/json" },
        };
    }
}
