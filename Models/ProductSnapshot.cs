namespace OzonTracker.Api.Models;

public sealed class ProductSnapshot
{
    public long Id { get; set; }
    public DateTimeOffset CapturedAt { get; set; }
    public decimal Price { get; set; }
    public decimal OzonCardPrice { get; set; }
    public int Stocks { get; set; }
    public int SoldUnits { get; set; }
    public decimal Rating { get; set; }
    public int ReviewCount { get; set; }
}
