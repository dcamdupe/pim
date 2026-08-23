namespace Pim.Api.Auth;

public sealed class CognitoSettings
{
    // The Cognito User Pool's issuer URL (https://cognito-idp.<region>.amazonaws.com/<user-pool-id>) -
    // doubles as the OIDC discovery/JWKS base the JWT bearer handler uses to validate tokens.
    public required string Authority { get; set; }

    public required string AppClientId { get; set; }
}
