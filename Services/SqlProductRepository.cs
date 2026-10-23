using System.Data;
using Microsoft.Data.SqlClient;
using OzonTracker.Api.Models;

namespace OzonTracker.Api.Services;

public sealed class SqlProductRepository(IConfiguration configuration) : IProductRepository
{
    private SqlConnection CreateConnection() => new(
        configuration.GetConnectionString("OzonTracker")
        ?? throw new InvalidOperationException("Задайте ConnectionStrings:OzonTracker. См. README.md."));

    public Task<IReadOnlyCollection<Product>> GetAllAsync(CancellationToken cancellationToken = default) =>
        ReadAsync(true, null, cancellationToken);

    public Task<IReadOnlyCollection<Product>> GetCatalogAsync(CancellationToken cancellationToken = default) =>
        ReadAsync(false, null, cancellationToken);

    public async Task<Product?> GetByOzonIdAsync(long ozonProductId, CancellationToken cancellationToken = default) =>
        (await ReadAsync(true, ozonProductId, cancellationToken)).SingleOrDefault();

    private async Task<IReadOnlyCollection<Product>> ReadAsync(bool tracked, long? productId, CancellationToken ct)
    {
        await using var connection = CreateConnection();
        await connection.OpenAsync(ct);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT p.Id, p.OzonProductId, p.Name, p.Description, p.ImageUrl, p.AddedAt,
                   s.Id, s.CapturedAt, s.Price, s.OzonCardPrice, s.Stocks,
                   s.SoldUnits, s.Rating, s.ReviewCount
            FROM dbo.Products p
            INNER JOIN dbo.ProductSnapshots s ON s.ProductId = p.Id
            WHERE p.IsTracked = @tracked AND (@productId IS NULL OR p.OzonProductId = @productId)
            ORDER BY p.Id, s.CapturedAt DESC, s.Id DESC;
            """;
        command.Parameters.Add("@tracked", SqlDbType.Bit).Value = tracked;
        command.Parameters.Add("@productId", SqlDbType.BigInt).Value = (object?)productId ?? DBNull.Value;
        await using var reader = await command.ExecuteReaderAsync(ct);
        var products = new Dictionary<Guid, Product>();
        while (await reader.ReadAsync(ct))
        {
            var id = reader.GetGuid(0);
            var snapshot = new ProductSnapshot
            {
                Id = reader.GetInt64(6), CapturedAt = reader.GetDateTimeOffset(7),
                Price = reader.GetDecimal(8), OzonCardPrice = reader.GetDecimal(9),
                Stocks = reader.GetInt32(10), SoldUnits = reader.GetInt32(11),
                Rating = reader.GetDecimal(12), ReviewCount = reader.GetInt32(13)
            };
            if (!products.TryGetValue(id, out var product))
            {
                product = new Product
                {
                    Id = id, OzonProductId = reader.GetInt64(1), Name = reader.GetString(2),
                    Description = reader.GetString(3), ImageUrl = reader.IsDBNull(4) ? null : reader.GetString(4),
                    AddedAt = reader.GetDateTimeOffset(5), LastUpdatedAt = snapshot.CapturedAt,
                    Price = snapshot.Price, OzonCardPrice = snapshot.OzonCardPrice, Stocks = snapshot.Stocks,
                    SoldUnits = snapshot.SoldUnits, Rating = snapshot.Rating, ReviewCount = snapshot.ReviewCount
                };
                products.Add(id, product);
            }
            product.History.Add(snapshot);
        }
        foreach (var product in products.Values) product.History.Reverse();
        return products.Values.OrderByDescending(p => p.LastUpdatedAt).ThenBy(p => p.Name).ToList();
    }

    public async Task<TrackingResult> TrackAsync(long ozonProductId, CancellationToken cancellationToken = default)
    {
        await using var connection = CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        // The conditional update serializes concurrent additions of the same catalog product.
        command.CommandText = """
            UPDATE dbo.Products SET IsTracked = 1, AddedAt = SYSDATETIMEOFFSET()
            WHERE OzonProductId = @id AND IsTracked = 0;
            IF @@ROWCOUNT = 1 SELECT 0;
            ELSE IF EXISTS (SELECT 1 FROM dbo.Products WHERE OzonProductId = @id) SELECT 2;
            ELSE SELECT 1;
            """;
        command.Parameters.Add("@id", SqlDbType.BigInt).Value = ozonProductId;
        return (TrackingResult)(int)(await command.ExecuteScalarAsync(cancellationToken))!;
    }

    public async Task<bool> DeleteAsync(long ozonProductId, CancellationToken cancellationToken = default)
    {
        await using var connection = CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = "UPDATE dbo.Products SET IsTracked = 0 WHERE OzonProductId = @id AND IsTracked = 1;";
        command.Parameters.Add("@id", SqlDbType.BigInt).Value = ozonProductId;
        return await command.ExecuteNonQueryAsync(cancellationToken) == 1;
    }

    public async Task<int> SimulateAsync(CancellationToken cancellationToken = default)
    {
        await using var connection = CreateConnection();
        await connection.OpenAsync(cancellationToken);
        // Serialize simulations so each new snapshot follows the preceding committed one.
        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            DECLARE @lockResult int;
            EXEC @lockResult = sys.sp_getapplock @Resource = N'OzonTracker.DemoSimulation',
                @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 10000;
            IF @lockResult < 0 THROW 50001, N'Не удалось запустить демонстрационное обновление.', 1;

            INSERT dbo.ProductSnapshots(ProductId, CapturedAt, Price, OzonCardPrice, Stocks, SoldUnits, Rating, ReviewCount)
            SELECT p.Id, SYSDATETIMEOFFSET(), n.Price, ROUND(n.Price * 0.94, 2),
                CASE WHEN s.Stocks < 5 THEN s.Stocks + 50 ELSE s.Stocks - 3 END,
                s.SoldUnits + 3, s.Rating, s.ReviewCount + 1
            FROM dbo.Products p
            CROSS APPLY (SELECT TOP (1) * FROM dbo.ProductSnapshots
                         WHERE ProductId = p.Id ORDER BY CapturedAt DESC, Id DESC) s
            CROSS APPLY (SELECT CAST(ROUND(CASE WHEN s.Id % 2 = 0 THEN s.Price * 1.03
                             ELSE s.Price * 0.97 END, 2) AS decimal(18,2)) AS Price) n
            WHERE p.IsTracked = 1;
            SELECT @@ROWCOUNT;
            """;
        var count = (int)(await command.ExecuteScalarAsync(cancellationToken))!;
        await transaction.CommitAsync(cancellationToken);
        return count;
    }
}
