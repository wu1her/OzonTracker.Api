using Microsoft.AspNetCore.Mvc;
using OzonTracker.Api.Contracts;
using OzonTracker.Api.Services;

namespace OzonTracker.Api.Controllers;

[ApiController]
[Route("api/profile")]
public sealed class ProfileController(SqlProfileRepository profiles) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct) => Ok(await profiles.GetAsync(ct));

    [HttpPut]
    public async Task<IActionResult> Update(UpdateProfileRequest request, CancellationToken ct)
    {
        if (request.DisplayName.Trim().Length < 2)
            return BadRequest(new { message = "Имя должно содержать хотя бы два символа." });
        return Ok(await profiles.UpdateAsync(request, ct));
    }

    [HttpPut("email")]
    public async Task<IActionResult> LinkEmail(LinkEmailRequest request, CancellationToken ct) =>
        Ok(await profiles.SetEmailAsync(request.Email, ct));

    [HttpDelete("email")]
    public async Task<IActionResult> UnlinkEmail(CancellationToken ct) => Ok(await profiles.SetEmailAsync(null, ct));

    [HttpPut("subscription")]
    public async Task<IActionResult> ChangeSubscription(ChangeSubscriptionRequest request, CancellationToken ct) =>
        Ok(await profiles.SetSubscriptionAsync(request.Subscription, ct));

    [HttpGet("avatar")]
    public async Task<IActionResult> GetAvatar(CancellationToken ct)
    {
        var avatar = await profiles.GetAvatarAsync(ct);
        if (avatar is null) return NotFound();
        Response.Headers["X-Content-Type-Options"] = "nosniff";
        Response.Headers.CacheControl = "no-store";
        return File(avatar.Data, avatar.ContentType);
    }

    [HttpPost("avatar")]
    [RequestSizeLimit(2 * 1024 * 1024 + 65536)]
    public async Task<IActionResult> UploadAvatar(IFormFile file, CancellationToken ct)
    {
        if (file.Length is <= 0 or > 2 * 1024 * 1024)
            return BadRequest(new { message = "Выберите изображение размером до 2 МБ." });
        await using var stream = new MemoryStream();
        await file.CopyToAsync(stream, ct);
        var data = stream.ToArray();
        string? type = data.AsSpan().StartsWith(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }) ? "image/png"
            : data.AsSpan().StartsWith(new byte[] { 255, 216, 255 }) ? "image/jpeg"
            : data.Length >= 12 && data.AsSpan(0, 4).SequenceEqual("RIFF"u8) && data.AsSpan(8, 4).SequenceEqual("WEBP"u8) ? "image/webp" : null;
        if (type is null) return BadRequest(new { message = "Поддерживаются изображения PNG, JPEG и WebP. SVG не поддерживается." });
        return Ok(await profiles.SetAvatarAsync(data, type, ct));
    }

    [HttpDelete("avatar")]
    public async Task<IActionResult> DeleteAvatar(CancellationToken ct) => Ok(await profiles.SetAvatarAsync(null, null, ct));

    [HttpPut("settings")]
    public async Task<IActionResult> Settings(RefreshSettingsRequest request, CancellationToken ct) => Ok(await profiles.SetSettingsAsync(request, ct));
}
