using Microsoft.AspNetCore.Mvc;
using OzonTracker.Api.Contracts;
using OzonTracker.Api.Services;

namespace OzonTracker.Api.Controllers;

[ApiController]
[Route("api/chat")]
public sealed class ChatController(SqlProfileRepository profiles, IProductRepository products) : ControllerBase
{
    private ObjectResult ProRequired() => StatusCode(403, new { message = "Демочат доступен только на тарифе Pro." });

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var messages = await profiles.GetChatAsync(ct);
        return messages is null ? ProRequired() : Ok(messages);
    }

    [HttpPost]
    public async Task<IActionResult> Send(SendChatRequest request, CancellationToken ct)
    {
        if ((await profiles.GetAsync(ct)).Subscription != "Pro") return ProRequired();
        var text = request.Text.Trim();
        var reply = DemoAssistant.Reply(text, await products.GetAllAsync(ct));
        var messages = await profiles.AddChatAsync(text, reply, ct);
        return messages is null ? ProRequired() : Ok(messages);
    }

    [HttpDelete]
    public async Task<IActionResult> Clear(CancellationToken ct)
    {
        var messages = await profiles.ClearChatAsync(ct);
        return messages is null ? ProRequired() : NoContent();
    }
}
