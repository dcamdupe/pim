using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;
using Pim.Api.Data;
using Pim.Api.Repository;

namespace Pim.Api.Auth;

// Authenticates a request by the X-Api-Key header against a stored ApiKey row. On success it
// emits the same ClaimTypes.NameIdentifier = email claim the Bearer/Cognito principals carry,
// so controllers read the caller identically regardless of which scheme authenticated them.
public sealed class ApiKeyAuthenticationHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    public const string SchemeName = "ApiKey";
    public const string HeaderName = "X-Api-Key";

    private readonly IRepository<ApiKey> _apiKeys;

    public ApiKeyAuthenticationHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder,
        IRepository<ApiKey> apiKeys)
        : base(options, logger, encoder)
    {
        _apiKeys = apiKeys;
    }

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue(HeaderName, out var header) || string.IsNullOrWhiteSpace(header))
        {
            return AuthenticateResult.NoResult();
        }

        var apiKey = await _apiKeys.GetAsync(header.ToString());
        if (apiKey is null)
        {
            return AuthenticateResult.Fail("Unknown API key.");
        }

        var identity = new ClaimsIdentity(
            [new Claim(ClaimTypes.NameIdentifier, apiKey.Email)],
            SchemeName);
        var ticket = new AuthenticationTicket(new ClaimsPrincipal(identity), SchemeName);

        return AuthenticateResult.Success(ticket);
    }
}

public static class ApiKeyAuthenticationExtensions
{
    public static AuthenticationBuilder AddApiKey(this AuthenticationBuilder builder) =>
        builder.AddScheme<AuthenticationSchemeOptions, ApiKeyAuthenticationHandler>(
            ApiKeyAuthenticationHandler.SchemeName, null);
}
