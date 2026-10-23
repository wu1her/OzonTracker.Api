using Microsoft.AspNetCore.Mvc;
using OzonTracker.Api.Contracts;
using OzonTracker.Api.Models;
using OzonTracker.Api.Services;
using OzonTracker.Api.Utilities;

namespace OzonTracker.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class ProductsController : ControllerBase
{
    private readonly IProductRepository _repository;

    public ProductsController(IProductRepository repository)
    {
        _repository = repository;
    }

    /// <summary>
    /// Получить все добавленные товары.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(
        typeof(IReadOnlyCollection<Product>),
        StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyCollection<Product>>> GetAll(
        CancellationToken cancellationToken)
    {
        var products = await _repository.GetAllAsync(
            cancellationToken);

        return Ok(products);
    }

    /// <summary>
    /// Получить товар по ID Ozon.
    /// </summary>
    [HttpGet("{ozonProductId:long}")]
    [ProducesResponseType(
        typeof(Product),
        StatusCodes.Status200OK)]
    [ProducesResponseType(
        StatusCodes.Status404NotFound)]
    public async Task<ActionResult<Product>> GetById(
        long ozonProductId,
        CancellationToken cancellationToken)
    {
        var product = await _repository.GetByOzonIdAsync(
            ozonProductId,
            cancellationToken);

        if (product is null)
        {
            return NotFound(new
            {
                message = "Товар не найден."
            });
        }

        return Ok(product);
    }

    /// <summary>
    /// Добавить товар по ссылке или ID.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(
        typeof(Product),
        StatusCodes.Status201Created)]
    [ProducesResponseType(
        StatusCodes.Status400BadRequest)]
    [ProducesResponseType(
        StatusCodes.Status409Conflict)]
    public async Task<ActionResult<Product>> Add(
        [FromBody] AddProductRequest request,
        CancellationToken cancellationToken)
    {
        if (!OzonProductIdParser.TryParse(
                request.Value,
                out var ozonProductId))
        {
            return BadRequest(new
            {
                message =
                    "Не удалось определить ID товара. " +
                    "Введите числовой ID или корректную ссылку Ozon."
            });
        }

        var existingProduct =
            await _repository.GetByOzonIdAsync(
                ozonProductId,
                cancellationToken);

        if (existingProduct is not null)
        {
            return Conflict(new
            {
                message = "Этот товар уже добавлен.",
                product = existingProduct
            });
        }

        var now = DateTimeOffset.UtcNow;

        var product = new Product
        {
            Id = Guid.NewGuid(),
            OzonProductId = ozonProductId,
            Name = $"Товар Ozon {ozonProductId}",
            Description =
                "Информация ещё не загружена из Ozon API.",
            Price = 0,
            OzonCardPrice = 0,
            Stocks = 0,
            AddedAt = now,
            LastUpdatedAt = now
        };

        try
        {
            await _repository.AddAsync(
                product,
                cancellationToken);
        }
        catch (InvalidOperationException exception)
        {
            return Conflict(new
            {
                message = exception.Message
            });
        }

        return CreatedAtAction(
            nameof(GetById),
            new
            {
                ozonProductId = product.OzonProductId
            },
            product);
    }

    /// <summary>
    /// Удалить товар из отслеживания.
    /// </summary>
    [HttpDelete("{ozonProductId:long}")]
    [ProducesResponseType(
        StatusCodes.Status204NoContent)]
    [ProducesResponseType(
        StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(
        long ozonProductId,
        CancellationToken cancellationToken)
    {
        var deleted = await _repository.DeleteAsync(
            ozonProductId,
            cancellationToken);

        if (!deleted)
        {
            return NotFound(new
            {
                message = "Товар не найден."
            });
        }

        return NoContent();
    }
}