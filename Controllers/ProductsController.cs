using Microsoft.AspNetCore.Mvc;
using OzonTracker.Api.Contracts;
using OzonTracker.Api.Services;
using OzonTracker.Api.Utilities;

namespace OzonTracker.Api.Controllers;

[ApiController]
[Route("api/products")]
public sealed class ProductsController(IProductRepository repository) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken cancellationToken) =>
        Ok(await repository.GetAllAsync(cancellationToken));

    [HttpGet("{ozonProductId:long}")]
    public async Task<IActionResult> GetById(long ozonProductId, CancellationToken cancellationToken)
    {
        var product = await repository.GetByOzonIdAsync(ozonProductId, cancellationToken);
        return product is null ? NotFound(new { message = "Товар не отслеживается." }) : Ok(product);
    }

    [HttpPost]
    public async Task<IActionResult> Add(AddProductRequest request, CancellationToken cancellationToken)
    {
        if (!OzonProductIdParser.TryParse(request.Value, out var id))
            return BadRequest(new { message = "Введите числовой ID или ссылку на товар из демокаталога." });

        var result = await repository.TrackAsync(id, cancellationToken);
        if (result == TrackingResult.NotFound)
            return NotFound(new { message = "Товара нет в демонстрационной БД. Выберите товар из каталога." });
        if (result == TrackingResult.AlreadyTracked)
            return Conflict(new { message = "Этот товар уже отслеживается." });

        return CreatedAtAction(nameof(GetById), new { ozonProductId = id },
            await repository.GetByOzonIdAsync(id, cancellationToken));
    }

    [HttpDelete("{ozonProductId:long}")]
    public async Task<IActionResult> Delete(long ozonProductId, CancellationToken cancellationToken) =>
        await repository.DeleteAsync(ozonProductId, cancellationToken)
            ? NoContent() : NotFound(new { message = "Товар не отслеживается." });

    [HttpPut("{ozonProductId:long}/preferences")]
    public async Task<IActionResult> Preferences(long ozonProductId, ProductPreferencesRequest request, CancellationToken ct)
    {
        if (!await repository.SetPreferencesAsync(ozonProductId, request.IsFavorite, request.TargetPrice, ct)) return NotFound();
        return Ok(await repository.GetByOzonIdAsync(ozonProductId, ct));
    }
}
