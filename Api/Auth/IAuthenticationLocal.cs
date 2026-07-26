namespace Pim.Api.Auth;

public interface IAuthenticationLocal
{
    Task<bool> ValidateAsync(string email, string password);
}
