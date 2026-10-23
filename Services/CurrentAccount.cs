using System.Security.Claims;

namespace OzonTracker.Api.Services;

public sealed class CurrentAccount(IHttpContextAccessor accessor)
{
    public int Id => int.Parse(accessor.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new InvalidOperationException("Требуется вход в аккаунт."));
}
