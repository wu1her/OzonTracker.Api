using System.Data;
using Microsoft.Data.SqlClient;
using OzonTracker.Api.Models;

namespace OzonTracker.Api.Services;

public sealed class SqlProductRepository(IConfiguration configuration, CurrentAccount account) : IProductRepository
{
    private SqlConnection Connection() => new(configuration.GetConnectionString("OzonTracker"));
    private void Scope(SqlCommand command) => command.Parameters.Add("@account", SqlDbType.Int).Value = account.Id;
    public Task<IReadOnlyCollection<Product>> GetAllAsync(CancellationToken cancellationToken = default) => ReadAsync(true, null, cancellationToken);
    public Task<IReadOnlyCollection<Product>> GetCatalogAsync(CancellationToken cancellationToken = default) => ReadAsync(false, null, cancellationToken);
    public async Task<Product?> GetByOzonIdAsync(long id, CancellationToken cancellationToken = default) =>
        (await ReadAsync(true, id, cancellationToken)).SingleOrDefault();

    private async Task<IReadOnlyCollection<Product>> ReadAsync(bool tracked, long? id, CancellationToken ct)
    {
        await using var connection = Connection(); await connection.OpenAsync(ct);
        await using var command = new SqlCommand("""
            SELECT p.Id,p.OzonProductId,p.Name,p.Description,p.ImageUrl,COALESCE(a.AddedAt,p.AddedAt),
                s.Id,s.CapturedAt,s.Price,s.OzonCardPrice,s.Stocks,s.SoldUnits,s.Rating,s.ReviewCount,
                ISNULL(a.IsFavorite,0),a.TargetPrice
            FROM dbo.Products p
            LEFT JOIN dbo.AccountProducts a ON a.ProductId=p.Id AND a.AccountId=@account
            CROSS APPLY (
                SELECT Id,CapturedAt,Price,OzonCardPrice,Stocks,SoldUnits,Rating,ReviewCount
                FROM dbo.AccountSnapshots WHERE AccountId=@account AND ProductId=p.Id
                UNION ALL
                SELECT Id,CapturedAt,Price,OzonCardPrice,Stocks,SoldUnits,Rating,ReviewCount
                FROM dbo.ProductSnapshots WHERE ProductId=p.Id AND NOT EXISTS (
                    SELECT 1 FROM dbo.AccountSnapshots WHERE AccountId=@account AND ProductId=p.Id)
            ) s
            WHERE ISNULL(a.IsTracked,0)=@tracked AND (@id IS NULL OR p.OzonProductId=@id)
            ORDER BY p.Id,s.CapturedAt DESC,s.Id DESC;
            """, connection);
        Scope(command); command.Parameters.Add("@tracked", SqlDbType.Bit).Value = tracked;
        command.Parameters.Add("@id", SqlDbType.BigInt).Value = (object?)id ?? DBNull.Value;
        var products = new Dictionary<Guid, Product>();
        await using var reader = await command.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var key = reader.GetGuid(0);
            var point = new ProductSnapshot
            {
                Id = reader.GetInt64(6),
                CapturedAt = reader.GetDateTimeOffset(7),
                Price = reader.GetDecimal(8),
                OzonCardPrice = reader.GetDecimal(9),
                Stocks = reader.GetInt32(10),
                SoldUnits = reader.GetInt32(11),
                Rating = reader.GetDecimal(12),
                ReviewCount = reader.GetInt32(13)
            };
            if (!products.TryGetValue(key, out var product))
            {
                product = new Product
                {
                    Id = key,
                    OzonProductId = reader.GetInt64(1),
                    Name = reader.GetString(2),
                    Description = reader.GetString(3),
                    ImageUrl = reader.IsDBNull(4) ? null : reader.GetString(4),
                    AddedAt = reader.GetDateTimeOffset(5),
                    LastUpdatedAt = point.CapturedAt,
                    Price = point.Price,
                    OzonCardPrice = point.OzonCardPrice,
                    Stocks = point.Stocks,
                    SoldUnits = point.SoldUnits,
                    Rating = point.Rating,
                    ReviewCount = point.ReviewCount,
                    IsFavorite = reader.GetBoolean(14),
                    TargetPrice = reader.IsDBNull(15) ? null : reader.GetDecimal(15)
                };
                products.Add(key, product);
            }
            product.History.Add(point);
        }
        foreach (var product in products.Values) product.History.Reverse();
        return products.Values.OrderByDescending(p => p.LastUpdatedAt).ThenBy(p => p.Name).ToList();
    }

    private async Task<SqlTransaction> BeginAsync(SqlConnection connection, CancellationToken ct)
    {
        var transaction = (SqlTransaction)await connection.BeginTransactionAsync(ct);
        await using var command = new SqlCommand("""
            DECLARE @resource nvarchar(255)=CONCAT(N'OzonTracker.Products.',@account), @result int;
            EXEC @result=sys.sp_getapplock @Resource=@resource,@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;
            IF @result<0 THROW 50001,N'Не удалось обновить товары. Повторите операцию.',1;
            """, connection, transaction);
        Scope(command);
        try { await command.ExecuteNonQueryAsync(ct); return transaction; }
        catch { await transaction.DisposeAsync(); throw; }
    }

    public async Task<TrackingResult> TrackAsync(long id, CancellationToken cancellationToken = default)
    {
        await using var connection = Connection(); await connection.OpenAsync(cancellationToken);
        await using var transaction = await BeginAsync(connection, cancellationToken);
        await using var command = new SqlCommand("""
            DECLARE @product uniqueidentifier=(SELECT Id FROM dbo.Products WHERE OzonProductId=@id);
            IF @product IS NULL BEGIN SELECT 1; RETURN; END;
            IF EXISTS(SELECT 1 FROM dbo.AccountProducts WHERE AccountId=@account AND ProductId=@product AND IsTracked=1)
                BEGIN SELECT 2; RETURN; END;
            IF EXISTS(SELECT 1 FROM dbo.AccountProducts WHERE AccountId=@account AND ProductId=@product)
                UPDATE dbo.AccountProducts SET IsTracked=1,AddedAt=SYSDATETIMEOFFSET() WHERE AccountId=@account AND ProductId=@product;
            ELSE INSERT dbo.AccountProducts(AccountId,ProductId) VALUES(@account,@product);
            IF NOT EXISTS(SELECT 1 FROM dbo.AccountSnapshots WHERE AccountId=@account AND ProductId=@product)
                INSERT dbo.AccountSnapshots(AccountId,ProductId,CapturedAt,Price,OzonCardPrice,Stocks,SoldUnits,Rating,ReviewCount)
                SELECT @account,ProductId,CapturedAt,Price,OzonCardPrice,Stocks,SoldUnits,Rating,ReviewCount FROM dbo.ProductSnapshots WHERE ProductId=@product;
            SELECT 0;
            """, connection, transaction);
        Scope(command); command.Parameters.Add("@id", SqlDbType.BigInt).Value = id;
        var result = (TrackingResult)(int)(await command.ExecuteScalarAsync(cancellationToken))!;
        await transaction.CommitAsync(cancellationToken); return result;
    }

    public async Task<bool> DeleteAsync(long id, CancellationToken cancellationToken = default)
    {
        await using var connection = Connection(); await connection.OpenAsync(cancellationToken);
        await using var transaction = await BeginAsync(connection, cancellationToken);
        await using var command = new SqlCommand("""
            UPDATE a SET IsTracked=0 FROM dbo.AccountProducts a JOIN dbo.Products p ON p.Id=a.ProductId
            WHERE a.AccountId=@account AND p.OzonProductId=@id AND a.IsTracked=1;
            """, connection, transaction);
        Scope(command); command.Parameters.Add("@id", SqlDbType.BigInt).Value = id;
        var changed = await command.ExecuteNonQueryAsync(cancellationToken) == 1;
        await transaction.CommitAsync(cancellationToken); return changed;
    }

    // Called inside the same transaction as price or rule changes. Rearm only above the threshold.
    private async Task AlertAsync(SqlConnection connection, SqlTransaction transaction, CancellationToken ct)
    {
        await using var command = new SqlCommand("""
            DECLARE @enabled bit=(SELECT NotificationsEnabled FROM dbo.AccountProfiles WHERE AccountId=@account);
            INSERT dbo.PriceNotifications(AccountId,ProductId,Price,TargetPrice)
            SELECT a.AccountId,a.ProductId,s.Price,a.TargetPrice FROM dbo.AccountProducts a
            CROSS APPLY(SELECT TOP(1) Price FROM dbo.AccountSnapshots WHERE AccountId=a.AccountId AND ProductId=a.ProductId ORDER BY CapturedAt DESC,Id DESC)s
            WHERE a.AccountId=@account AND a.IsTracked=1 AND a.TargetPrice IS NOT NULL AND a.TargetTriggered=0 AND s.Price<=a.TargetPrice AND @enabled=1;
            UPDATE a SET TargetTriggered=CASE WHEN s.Price>a.TargetPrice THEN 0 WHEN @enabled=1 THEN 1 ELSE a.TargetTriggered END FROM dbo.AccountProducts a
            CROSS APPLY(SELECT TOP(1) Price FROM dbo.AccountSnapshots WHERE AccountId=a.AccountId AND ProductId=a.ProductId ORDER BY CapturedAt DESC,Id DESC)s
            WHERE a.AccountId=@account AND a.IsTracked=1 AND a.TargetPrice IS NOT NULL;
            """, connection, transaction);
        Scope(command); await command.ExecuteNonQueryAsync(ct);
    }

    public async Task<bool> SetPreferencesAsync(long id, bool favorite, decimal? target, CancellationToken ct)
    {
        await using var connection = Connection(); await connection.OpenAsync(ct);
        await using var transaction = await BeginAsync(connection, ct);
        await using var command = new SqlCommand("""
            UPDATE a SET IsFavorite=@favorite,TargetTriggered=CASE WHEN TargetPrice=@target OR (TargetPrice IS NULL AND @target IS NULL) THEN TargetTriggered ELSE 0 END,
                TargetPrice=@target FROM dbo.AccountProducts a JOIN dbo.Products p ON p.Id=a.ProductId
            WHERE a.AccountId=@account AND p.OzonProductId=@id AND a.IsTracked=1;
            """, connection, transaction);
        Scope(command); command.Parameters.Add("@id", SqlDbType.BigInt).Value = id;
        command.Parameters.Add("@favorite", SqlDbType.Bit).Value = favorite;
        var price = command.Parameters.Add("@target", SqlDbType.Decimal); price.Precision = 18; price.Scale = 2; price.Value = (object?)target ?? DBNull.Value;
        if (await command.ExecuteNonQueryAsync(ct) != 1) return false;
        await AlertAsync(connection, transaction, ct); await transaction.CommitAsync(ct); return true;
    }

    public async Task<int> SimulateAsync(CancellationToken cancellationToken = default, string scenario = "random", long? ozonProductId = null)
    {
        await using var connection = Connection(); await connection.OpenAsync(cancellationToken);
        await using var transaction = await BeginAsync(connection, cancellationToken);
        await using var command = new SqlCommand("""
            INSERT dbo.AccountSnapshots(AccountId,ProductId,CapturedAt,Price,OzonCardPrice,Stocks,SoldUnits,Rating,ReviewCount)
            SELECT @account,p.Id,SYSDATETIMEOFFSET(),n.Price,ROUND(n.Price*0.94,2),
                CASE @scenario WHEN 'outOfStock' THEN 0 WHEN 'restock' THEN s.Stocks+50 ELSE IIF(s.Stocks<5,s.Stocks+50,s.Stocks-3) END,
                s.SoldUnits+CASE @scenario WHEN 'outOfStock' THEN s.Stocks WHEN 'restock' THEN 0 ELSE 3 END,
                s.Rating,s.ReviewCount+IIF(@scenario IN ('outOfStock','restock'),0,1)
            FROM dbo.AccountProducts a JOIN dbo.Products p ON p.Id=a.ProductId
            CROSS APPLY(SELECT TOP(1)* FROM dbo.AccountSnapshots WHERE AccountId=@account AND ProductId=p.Id ORDER BY CapturedAt DESC,Id DESC)s
            CROSS APPLY(SELECT CAST(ROUND(CASE @scenario WHEN 'sale' THEN s.Price*0.8 WHEN 'random' THEN s.Price*IIF(s.Id%2=0,1.03,0.97) ELSE s.Price END,2)AS decimal(18,2))Price)n
            WHERE a.AccountId=@account AND a.IsTracked=1 AND (@id IS NULL OR p.OzonProductId=@id);
            SELECT @@ROWCOUNT;
            """, connection, transaction);
        Scope(command); command.Parameters.Add("@scenario", SqlDbType.VarChar, 10).Value = scenario;
        command.Parameters.Add("@id", SqlDbType.BigInt).Value = (object?)ozonProductId ?? DBNull.Value;
        var count = (int)(await command.ExecuteScalarAsync(cancellationToken))!;
        await AlertAsync(connection, transaction, cancellationToken); await transaction.CommitAsync(cancellationToken); return count;
    }
}
