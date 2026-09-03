using System.Security.Cryptography;

namespace Pim.Api.Auth;

// Generates the API key value: 40 characters of [a-z0-9], drawn from a cryptographic RNG.
public static class ApiKeyGenerator
{
    private const string Alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
    private const int Length = 40;

    public static string Generate() => RandomNumberGenerator.GetString(Alphabet, Length);
}
