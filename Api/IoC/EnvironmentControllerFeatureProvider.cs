using System.Reflection;
using Microsoft.AspNetCore.Mvc.Controllers;
using Pim.Api.Controllers;

namespace Pim.Api.IoC;

// LoginController's email/password endpoints are local-dev-only (UBE-39) - Cognito's Hosted UI
// handles login everywhere else. Removing the controller here means the routes genuinely don't
// exist outside Local (404, not just a runtime environment check inside the action), and non-Local
// environments never need IAuthenticationLocal/IJwtTokenGenerator registered.
public sealed class EnvironmentControllerFeatureProvider : ControllerFeatureProvider
{
    private readonly bool _isLocal;

    public EnvironmentControllerFeatureProvider(bool isLocal)
    {
        _isLocal = isLocal;
    }

    protected override bool IsController(TypeInfo typeInfo)
    {
        if (!_isLocal && typeInfo == typeof(LoginController).GetTypeInfo())
        {
            return false;
        }

        return base.IsController(typeInfo);
    }
}
