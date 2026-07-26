using Microsoft.AspNetCore.Mvc;
using Pim.Api.Auth;

namespace Pim.Api.Controllers;

[ApiController]
[Route("login")]
public sealed class LoginController : ControllerBase
{
    private readonly IAuthenticationLocal _authentication;
    private readonly IJwtTokenGenerator _tokenGenerator;

    public LoginController(IAuthenticationLocal authentication, IJwtTokenGenerator tokenGenerator)
    {
        _authentication = authentication;
        _tokenGenerator = tokenGenerator;
    }

    [HttpPost]
    public async Task<ActionResult<LoginResponse>> Post(LoginRequest request)
    {
        var isValid = await _authentication.ValidateAsync(request.Email, request.Password);
        if (!isValid)
        {
            return BadRequest();
        }

        var token = _tokenGenerator.GenerateToken(request.Email);
        return Ok(new LoginResponse(token));
    }
}

public sealed record LoginRequest(string Email, string Password);

public sealed record LoginResponse(string Token);
