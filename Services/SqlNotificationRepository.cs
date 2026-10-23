using System.Data;
using Microsoft.Data.SqlClient;
using OzonTracker.Api.Models;

namespace OzonTracker.Api.Services;

public sealed class SqlNotificationRepository(IConfiguration configuration, CurrentAccount account)
{
    public async Task<NotificationInbox> GetAsync(CancellationToken ct)
    {
        await using var connection = new SqlConnection(configuration.GetConnectionString("OzonTracker")); await connection.OpenAsync(ct);
        await using var command = new SqlCommand("""
            SELECT TOP(100) n.Id,p.OzonProductId,p.Name,n.Price,n.TargetPrice,n.CreatedAt,n.ReadAt
            FROM dbo.PriceNotifications n JOIN dbo.Products p ON p.Id=n.ProductId WHERE n.AccountId=@account ORDER BY n.Id DESC;
            SELECT COUNT(*) FROM dbo.PriceNotifications WHERE AccountId=@account AND ReadAt IS NULL;
            """, connection);
        command.Parameters.Add("@account", SqlDbType.Int).Value = account.Id;
        var items = new List<PriceNotification>(); await using var reader = await command.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct)) items.Add(new(reader.GetInt64(0), reader.GetInt64(1), reader.GetString(2), reader.GetDecimal(3), reader.GetDecimal(4), reader.GetDateTimeOffset(5), reader.IsDBNull(6) ? null : reader.GetDateTimeOffset(6)));
        await reader.NextResultAsync(ct); await reader.ReadAsync(ct); return new(items, reader.GetInt32(0));
    }
    public async Task<int> ReadAsync(long? id, CancellationToken ct)
    {
        await using var connection = new SqlConnection(configuration.GetConnectionString("OzonTracker")); await connection.OpenAsync(ct);
        await using var command = new SqlCommand("UPDATE dbo.PriceNotifications SET ReadAt=COALESCE(ReadAt,SYSDATETIMEOFFSET()) WHERE AccountId=@account AND (@id IS NULL OR Id=@id);", connection);
        command.Parameters.Add("@account", SqlDbType.Int).Value = account.Id; command.Parameters.Add("@id", SqlDbType.BigInt).Value = (object?)id ?? DBNull.Value;
        return await command.ExecuteNonQueryAsync(ct);
    }
}
