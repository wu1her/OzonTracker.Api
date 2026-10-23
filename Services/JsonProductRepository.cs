using System.Text.Json;
using OzonTracker.Api.Models;

namespace OzonTracker.Api.Services;

public sealed class JsonProductRepository : IProductRepository
{
    private readonly string _filePath;
    private readonly SemaphoreSlim _fileLock = new(1, 1);

    private readonly JsonSerializerOptions _jsonOptions = new(
        JsonSerializerDefaults.Web)
    {
        WriteIndented = true
    };

    public JsonProductRepository(IWebHostEnvironment environment)
    {
        var dataDirectory = Path.Combine(
            environment.ContentRootPath,
            "Data");

        Directory.CreateDirectory(dataDirectory);

        _filePath = Path.Combine(
            dataDirectory,
            "products.json");

        if (!File.Exists(_filePath))
        {
            File.WriteAllText(_filePath, "[]");
        }
    }

    public async Task<IReadOnlyCollection<Product>> GetAllAsync(
        CancellationToken cancellationToken = default)
    {
        await _fileLock.WaitAsync(cancellationToken);

        try
        {
            var products = await ReadProductsUnsafeAsync(
                cancellationToken);

            return products
                .OrderByDescending(product => product.AddedAt)
                .ToList();
        }
        finally
        {
            _fileLock.Release();
        }
    }

    public async Task<Product?> GetByOzonIdAsync(
        long ozonProductId,
        CancellationToken cancellationToken = default)
    {
        await _fileLock.WaitAsync(cancellationToken);

        try
        {
            var products = await ReadProductsUnsafeAsync(
                cancellationToken);

            return products.FirstOrDefault(
                product =>
                    product.OzonProductId == ozonProductId);
        }
        finally
        {
            _fileLock.Release();
        }
    }

    public async Task<Product> AddAsync(
        Product product,
        CancellationToken cancellationToken = default)
    {
        await _fileLock.WaitAsync(cancellationToken);

        try
        {
            var products = await ReadProductsUnsafeAsync(
                cancellationToken);

            var alreadyExists = products.Any(
                existingProduct =>
                    existingProduct.OzonProductId ==
                    product.OzonProductId);

            if (alreadyExists)
            {
                throw new InvalidOperationException(
                    "Этот товар уже добавлен.");
            }

            products.Add(product);

            await WriteProductsUnsafeAsync(
                products,
                cancellationToken);

            return product;
        }
        finally
        {
            _fileLock.Release();
        }
    }

    public async Task<bool> DeleteAsync(
        long ozonProductId,
        CancellationToken cancellationToken = default)
    {
        await _fileLock.WaitAsync(cancellationToken);

        try
        {
            var products = await ReadProductsUnsafeAsync(
                cancellationToken);

            var product = products.FirstOrDefault(
                item => item.OzonProductId == ozonProductId);

            if (product is null)
            {
                return false;
            }

            products.Remove(product);

            await WriteProductsUnsafeAsync(
                products,
                cancellationToken);

            return true;
        }
        finally
        {
            _fileLock.Release();
        }
    }

    private async Task<List<Product>> ReadProductsUnsafeAsync(
        CancellationToken cancellationToken)
    {
        await using var stream = new FileStream(
            _filePath,
            FileMode.Open,
            FileAccess.Read,
            FileShare.Read);

        var products =
            await JsonSerializer.DeserializeAsync<List<Product>>(
                stream,
                _jsonOptions,
                cancellationToken);

        return products ?? new List<Product>();
    }

    private async Task WriteProductsUnsafeAsync(
        List<Product> products,
        CancellationToken cancellationToken)
    {
        var temporaryFilePath = $"{_filePath}.tmp";

        await using (var stream = new FileStream(
                         temporaryFilePath,
                         FileMode.Create,
                         FileAccess.Write,
                         FileShare.None))
        {
            await JsonSerializer.SerializeAsync(
                stream,
                products,
                _jsonOptions,
                cancellationToken);
        }

        File.Move(
            temporaryFilePath,
            _filePath,
            overwrite: true);
    }
}