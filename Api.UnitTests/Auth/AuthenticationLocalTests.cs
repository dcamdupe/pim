using Pim.Api.Auth;
using Pim.Api.Data;
using Pim.Api.UnitTests.Helpers;

namespace Pim.Api.UnitTests.Auth;

public class AuthenticationLocalTests
{
    [Fact]
    public async Task ValidateAsync_ReturnsTrue_WhenLoginAndPasswordAreCorrect()
    {
        var users = new List<User>
        {
            new() { Email = "dave@example.com", PasswordHash = BCrypt.Net.BCrypt.HashPassword("correct-password") },
        };
        var repository = RepositoryMockFactory.Create(users);
        var sut = new AuthenticationLocal(repository.Object);

        var result = await sut.ValidateAsync("dave@example.com", "correct-password");

        Assert.True(result);
    }

    [Fact]
    public async Task ValidateAsync_ReturnsFalse_WhenLoginDoesNotExist()
    {
        var repository = RepositoryMockFactory.Create(new List<User>());
        var sut = new AuthenticationLocal(repository.Object);

        var result = await sut.ValidateAsync("unknown@example.com", "whatever");

        Assert.False(result);
    }

    [Fact]
    public async Task ValidateAsync_ReturnsFalse_WhenPasswordIsIncorrect()
    {
        var users = new List<User>
        {
            new() { Email = "dave@example.com", PasswordHash = BCrypt.Net.BCrypt.HashPassword("correct-password") },
        };
        var repository = RepositoryMockFactory.Create(users);
        var sut = new AuthenticationLocal(repository.Object);

        var result = await sut.ValidateAsync("dave@example.com", "wrong-password");

        Assert.False(result);
    }
}
