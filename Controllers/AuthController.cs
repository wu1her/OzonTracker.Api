using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using OzonTracker.Api.Contracts;
using OzonTracker.Api.Models;
using OzonTracker.Api.Services;

namespace OzonTracker.Api.Controllers;

[ApiController, Route("api/auth")]
public sealed class AuthController(SqlAccountRepository accounts) : ControllerBase
{
    private async Task<IActionResult> SignIn(Account account)
    {
        var principal = new ClaimsPrincipal(new ClaimsIdentity([
            new Claim(ClaimTypes.NameIdentifier, account.Id.ToString()), new Claim(ClaimTypes.Email, account.Email)
        ], CookieAuthenticationDefaults.AuthenticationScheme));
        await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, principal,
            new AuthenticationProperties { IsPersistent = true });
        return Ok(new AccountInfo(account.Id, account.Email));
    }

    [AllowAnonymous, HttpPost("register"), EnableRateLimiting("auth")]
    public async Task<IActionResult> Register(RegisterRequest request, CancellationToken ct)
    {
        if (request.DisplayName.Trim().Length < 2) return BadRequest(new { message = "Введите имя длиной от 2 символов." });
        var account = await accounts.RegisterAsync(request, ct);
        return account is null ? Conflict(new { message = "Этот адрес уже зарегистрирован." }) : await SignIn(account);
    }

    [AllowAnonymous, HttpPost("login"), EnableRateLimiting("auth")]
    public async Task<IActionResult> Login(LoginRequest request, CancellationToken ct)
    {
        var account = await accounts.FindAsync(request.Email, ct);
        if (account is null || !accounts.Verify(account, request.Password))
            return Unauthorized(new { message = "Неверная почта или пароль." });
        return await SignIn(account);
    }

    [Authorize, HttpGet("me")]
    public IActionResult Me() => Ok(new AccountInfo(int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!), User.FindFirstValue(ClaimTypes.Email)!));

    [Authorize, HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync();
        return NoContent();
    }
}
