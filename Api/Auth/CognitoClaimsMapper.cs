using System.Security.Claims;

namespace Pim.Api.Auth;

// Cognito's "sub" claim is an opaque user id, not the email - every controller keys the
// authenticated user off ClaimTypes.NameIdentifier expecting an email (matching User.Email, the
// DynamoDB partition key), same as the Local JWT flow. This adds that claim from the token's own
// "email" claim so controllers work unchanged regardless of which auth path issued the token.
public static class CognitoClaimsMapper
{
    public static void AddNameIdentifierFromEmail(ClaimsPrincipal principal)
    {
        var identity = (ClaimsIdentity)principal.Identity!;
        var email = identity.FindFirst("email")?.Value
            ?? throw new InvalidOperationException("Cognito token is missing the \"email\" claim.");
        identity.AddClaim(new Claim(ClaimTypes.NameIdentifier, email));
    }
}
