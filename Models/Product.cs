namespace OzonTracker.Api.Models;

public sealed class Product
{
    /// <summary>
    /// Внутренний идентификатор записи в нашем сервисе.
    /// </summary>
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Идентификатор товара на Ozon.
    /// </summary>
    public long OzonProductId { get; set; }

    public string Name { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public string? ImageUrl { get; set; }

    public decimal Price { get; set; }

    public decimal OzonCardPrice { get; set; }

    public int Stocks { get; set; }

    public DateTimeOffset AddedAt { get; set; }

    public DateTimeOffset LastUpdatedAt { get; set; }
}