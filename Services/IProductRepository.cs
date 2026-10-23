using OzonTracker.Api.Models;

namespace OzonTracker.Api.Services;

public interface IProductRepository
{
    Task<IReadOnlyCollection<Product>> GetAllAsync(
        CancellationToken cancellationToken = default);

    Task<Product?> GetByOzonIdAsync(
        long ozonProductId,
        CancellationToken cancellationToken = default);

    Task<Product> AddAsync(
        Product product,
        CancellationToken cancellationToken = default);

    Task<bool> DeleteAsync(
        long ozonProductId,
        CancellationToken cancellationToken = default);
}