using System.Security.Claims;
using Pim.Api.Auth;

namespace Pim.Api.UnitTests.Auth;

public class CognitoClaimsMapperTests
{
    [Fact]
    public void AddNameIdentifierFromEmail_AddsNameIdentifierClaim_FromEmailClaim()
    {
        var principal = PrincipalWithClaims(new Claim("email", "dave@example.com"));

        CognitoClaimsMapper.AddNameIdentifierFromEmail(principal);

        Assert.Equal("dave@example.com", principal.FindFirstValue(ClaimTypes.NameIdentifier));
    }

    [Fact]
    public void AddNameIdentifierFromEmail_Throws_WhenEmailClaimIsMissing()
    {
        var principal = PrincipalWithClaims(new Claim("sub", "cognito-user-id"));

        Assert.Throws<InvalidOperationException>(() => CognitoClaimsMapper.AddNameIdentifierFromEmail(principal));
    }

    private static ClaimsPrincipal PrincipalWithClaims(params Claim[] claims)
    {
        var identity = new ClaimsIdentity(claims, "TestAuthType");
        return new ClaimsPrincipal(identity);
    }
}
