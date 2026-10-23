using System.Data;
using Microsoft.Data.SqlClient;
using OzonTracker.Api.Contracts;
using OzonTracker.Api.Models;

namespace OzonTracker.Api.Services;

public sealed class SqlProfileRepository(IConfiguration configuration)
{
    private SqlConnection CreateConnection() => new(configuration.GetConnectionString("OzonTracker"));

    public async Task<DemoProfile> GetAsync(CancellationToken ct)
    {
        await using var connection = CreateConnection();
        await connection.OpenAsync(ct);
        await using var command = new SqlCommand("""
            SELECT DisplayName, FullName, Phone, About, Email, Subscription,
                   IIF(AvatarData IS NULL, 0, 1), UpdatedAt
            FROM dbo.UserProfiles WHERE Id = 1;
            """, connection);
        await using var reader = await command.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) throw new InvalidOperationException("Выполните Database/profile.sql.");
        return new DemoProfile(reader.GetString(0), reader.GetString(1), reader.GetString(2), reader.GetString(3),
            reader.IsDBNull(4) ? null : reader.GetString(4), reader.GetString(5),
            reader.GetInt32(6) == 0 ? null : $"/api/profile/avatar?v={reader.GetDateTimeOffset(7).UtcTicks}");
    }

    public Task<DemoProfile> UpdateAsync(UpdateProfileRequest request, CancellationToken ct) =>
        UpdateColumnsAsync("DisplayName = @name, FullName = @fullName, Phone = @phone, About = @about", ct,
            new SqlParameter("@name", SqlDbType.NVarChar, 60) { Value = request.DisplayName.Trim() },
            new SqlParameter("@fullName", SqlDbType.NVarChar, 200) { Value = request.FullName.Trim() },
            new SqlParameter("@phone", SqlDbType.NVarChar, 25) { Value = request.Phone.Trim() },
            new SqlParameter("@about", SqlDbType.NVarChar, 1000) { Value = request.About.Trim() });

    public Task<DemoProfile> SetEmailAsync(string? email, CancellationToken ct) =>
        UpdateColumnsAsync("Email = @email", ct,
            new SqlParameter("@email", SqlDbType.NVarChar, 254) { Value = (object?)email?.Trim() ?? DBNull.Value });

    public Task<DemoProfile> SetSubscriptionAsync(string subscription, CancellationToken ct) =>
        UpdateColumnsAsync("Subscription = @subscription", ct,
            new SqlParameter("@subscription", SqlDbType.NVarChar, 5) { Value = subscription });

    public Task<DemoProfile> SetAvatarAsync(byte[]? data, string? contentType, CancellationToken ct) =>
        UpdateColumnsAsync("AvatarData = @data, AvatarContentType = @contentType", ct,
            new SqlParameter("@data", SqlDbType.VarBinary, -1) { Value = (object?)data ?? DBNull.Value },
            new SqlParameter("@contentType", SqlDbType.VarChar, 10) { Value = (object?)contentType ?? DBNull.Value });

    // The assignments are internal constants; all user-provided values are SQL parameters.
    private async Task<DemoProfile> UpdateColumnsAsync(string assignments, CancellationToken ct, params SqlParameter[] parameters)
    {
        await using var connection = CreateConnection();
        await connection.OpenAsync(ct);
        await using var command = new SqlCommand($"UPDATE dbo.UserProfiles SET {assignments}, UpdatedAt = SYSDATETIMEOFFSET() WHERE Id = 1;", connection);
        command.Parameters.AddRange(parameters);
        if (await command.ExecuteNonQueryAsync(ct) != 1) throw new InvalidOperationException("Выполните Database/profile.sql.");
        return await GetAsync(ct);
    }

    public async Task<ProfileAvatar?> GetAvatarAsync(CancellationToken ct)
    {
        await using var connection = CreateConnection();
        await connection.OpenAsync(ct);
        await using var command = new SqlCommand("SELECT AvatarData, AvatarContentType FROM dbo.UserProfiles WHERE Id = 1 AND AvatarData IS NOT NULL;", connection);
        await using var reader = await command.ExecuteReaderAsync(ct);
        return await reader.ReadAsync(ct) ? new ProfileAvatar((byte[])reader[0], reader.GetString(1)) : null;
    }

    public Task<IReadOnlyCollection<ChatMessage>?> GetChatAsync(CancellationToken ct) => ChatAsync(null, null, false, ct);
    public Task<IReadOnlyCollection<ChatMessage>?> AddChatAsync(string text, string answer, CancellationToken ct) => ChatAsync(text, answer, false, ct);
    public Task<IReadOnlyCollection<ChatMessage>?> ClearChatAsync(CancellationToken ct) => ChatAsync(null, null, true, ct);

    private async Task<IReadOnlyCollection<ChatMessage>?> ChatAsync(string? text, string? answer, bool clear, CancellationToken ct)
    {
        await using var connection = CreateConnection();
        await connection.OpenAsync(ct);
        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(ct);
        await using var access = new SqlCommand("SELECT Subscription FROM dbo.UserProfiles WITH (UPDLOCK, HOLDLOCK) WHERE Id = 1;", connection, transaction);
        // The profile lock also prevents a simultaneous downgrade from bypassing the Pro gate.
        if ((string?)await access.ExecuteScalarAsync(ct) != "Pro") return null;
        if (clear)
        {
            await using var delete = new SqlCommand("DELETE dbo.ChatMessages WHERE ProfileId = 1;", connection, transaction);
            await delete.ExecuteNonQueryAsync(ct);
        }
        if (text is not null)
        {
            await using var insert = new SqlCommand("""
                INSERT dbo.ChatMessages(ProfileId, Role, Text)
                VALUES (1, 'user', @text);
                INSERT dbo.ChatMessages(ProfileId, Role, Text) VALUES (1, 'assistant', @answer);
                """, connection, transaction);
            insert.Parameters.Add("@text", SqlDbType.NVarChar, 1000).Value = text;
            insert.Parameters.Add("@answer", SqlDbType.NVarChar, 2000).Value = answer!;
            await insert.ExecuteNonQueryAsync(ct);
        }
        var messages = new List<ChatMessage>();
        await using (var read = new SqlCommand("SELECT TOP (100) Id, Role, Text, CreatedAt FROM dbo.ChatMessages WHERE ProfileId = 1 ORDER BY Id DESC;", connection, transaction))
        await using (var reader = await read.ExecuteReaderAsync(ct))
            while (await reader.ReadAsync(ct))
                messages.Add(new(reader.GetInt64(0), reader.GetString(1), reader.GetString(2), reader.GetDateTimeOffset(3)));
        await transaction.CommitAsync(ct);
        messages.Reverse();
        return messages;
    }
}
