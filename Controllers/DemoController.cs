using Microsoft.AspNetCore.Mvc;
using OzonTracker.Api.Services;
using OzonTracker.Api.Contracts;

namespace OzonTracker.Api.Controllers;

[ApiController]
[Route("api/demo")]
public sealed class DemoController(IProductRepository repository, IConfiguration configuration) : ControllerBase
{
    [HttpPost("simulate")]
    public async Task<IActionResult> Simulate(CancellationToken cancellationToken)
    {
        if (!configuration.GetValue<bool>("Demo:Enabled"))
            return NotFound(new { message = "Демонстрационное обновление отключено." });
        return Ok(new { updatedProducts = await repository.SimulateAsync(cancellationToken) });
    }

    [HttpPost("scenario")]
    public async Task<IActionResult> Scenario(ScenarioRequest request, CancellationToken ct)
    {
        if (!configuration.GetValue<bool>("Demo:Enabled")) return NotFound();
        var count = await repository.SimulateAsync(ct, request.Scenario, request.OzonProductId);
        return request.OzonProductId is not null && count == 0 ? NotFound(new { message = "Товар не отслеживается." }) : Ok(new { updatedProducts = count });
    }
}
