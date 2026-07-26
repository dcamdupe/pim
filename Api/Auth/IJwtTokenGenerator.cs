namespace Pim.Api.Auth;

public interface IJwtTokenGenerator
{
    string GenerateToken(string email);
}
