using Microsoft.AspNetCore.Mvc;
using OzonTracker.Api.Services;

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
}
