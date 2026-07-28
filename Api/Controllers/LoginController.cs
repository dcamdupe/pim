using Microsoft.AspNetCore.Mvc;
using Pim.Api.Auth;

namespace Pim.Api.Controllers;

[ApiController]
public sealed class LoginController : ControllerBase
{
    private readonly IAuthenticationLocal _authentication;
    private readonly IJwtTokenGenerator _tokenGenerator;
    private readonly ILogger<LoginController> _logger;

    public LoginController(IAuthenticationLocal authentication, IJwtTokenGenerator tokenGenerator, ILogger<LoginController> logger)
    {
        _authentication = authentication;
        _tokenGenerator = tokenGenerator;
        _logger = logger;
    }

    [HttpPost("login")]
    public async Task<ActionResult<LoginResponse>> Post(LoginRequest request)
    {
        _logger.LogInformation("Login request received: email={Email}", request.Email);

        var isValid = await _authentication.ValidateAsync(request.Email, request.Password);
        _logger.LogInformation("Login validated");
        if (!isValid)
        {
            return BadRequest();
        }

        var token = _tokenGenerator.GenerateToken(request.Email);
        _logger.LogInformation("Login token generated");
        return Ok(new LoginResponse(token));
    }
}

public sealed record LoginRequest(string Email, string Password);

public sealed record LoginResponse(string Token);
