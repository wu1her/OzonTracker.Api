using Microsoft.AspNetCore.Mvc;
using OzonTracker.Api.Services;

namespace OzonTracker.Api.Controllers;

[ApiController]
[Route("api/catalog")]
public sealed class CatalogController(IProductRepository repository) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken cancellationToken) =>
        Ok(await repository.GetCatalogAsync(cancellationToken));
}
