using OzonTracker.Api.Models;

namespace OzonTracker.Api.Services;

public enum TrackingResult { Success, NotFound, AlreadyTracked }

public interface IProductRepository
{
    Task<IReadOnlyCollection<Product>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyCollection<Product>> GetCatalogAsync(CancellationToken cancellationToken = default);
    Task<Product?> GetByOzonIdAsync(long ozonProductId, CancellationToken cancellationToken = default);
    Task<TrackingResult> TrackAsync(long ozonProductId, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(long ozonProductId, CancellationToken cancellationToken = default);
    Task<int> SimulateAsync(CancellationToken cancellationToken = default);
}
