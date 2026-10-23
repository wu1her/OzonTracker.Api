using Microsoft.AspNetCore.Mvc;
using OzonTracker.Api.Services;

namespace OzonTracker.Api.Controllers;

[ApiController, Route("api/notifications")]
public sealed class NotificationsController(SqlNotificationRepository notifications) : ControllerBase
{
    [HttpGet] public async Task<IActionResult> Get(CancellationToken ct) => Ok(await notifications.GetAsync(ct));
    [HttpPost("read-all")] public async Task<IActionResult> ReadAll(CancellationToken ct) { await notifications.ReadAsync(null, ct); return NoContent(); }
    [HttpPost("{id:long}/read")] public async Task<IActionResult> Read(long id, CancellationToken ct) => await notifications.ReadAsync(id, ct) > 0 ? NoContent() : NotFound();
}
