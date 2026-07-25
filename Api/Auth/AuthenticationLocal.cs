using Pim.Api.Data;

namespace Pim.Api.Auth;

public sealed class AuthenticationLocal : IAuthenticationLocal
{
    private readonly IRepository<User> _users;

    public AuthenticationLocal(IRepository<User> users)
    {
        _users = users;
    }

    public async Task<bool> ValidateAsync(string login, string password)
    {
        var user = await _users.GetAsync(login);
        return user is not null && BCrypt.Net.BCrypt.Verify(password, user.PasswordHash);
    }
}
