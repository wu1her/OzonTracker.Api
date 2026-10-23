using System.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.Data.SqlClient;
using OzonTracker.Api.Contracts;
using OzonTracker.Api.Models;

namespace OzonTracker.Api.Services;

public sealed class SqlAccountRepository(IConfiguration configuration, IPasswordHasher<Account> hasher)
{
    private SqlConnection Connection() => new(configuration.GetConnectionString("OzonTracker"));
    private static string Normalize(string email) => email.Trim().ToUpperInvariant();

    public async Task<Account?> FindAsync(string email, CancellationToken ct)
    {
        await using var connection = Connection(); await connection.OpenAsync(ct);
        await using var command = new SqlCommand("SELECT Id, Email, PasswordHash FROM dbo.Accounts WHERE NormalizedEmail = @email;", connection);
        command.Parameters.Add("@email", SqlDbType.NVarChar, 254).Value = Normalize(email);
        await using var reader = await command.ExecuteReaderAsync(ct);
        return await reader.ReadAsync(ct) ? new(reader.GetInt32(0), reader.GetString(1), reader.GetString(2)) : null;
    }

    public async Task<Account?> RegisterAsync(RegisterRequest request, CancellationToken ct)
    {
        var account = new Account(0, request.Email.Trim(), "");
        var hash = hasher.HashPassword(account, request.Password);
        await using var connection = Connection(); await connection.OpenAsync(ct);
        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        await using var command = new SqlCommand("""
            DECLARE @first bit = IIF(EXISTS(SELECT 1 FROM dbo.Accounts WITH (UPDLOCK,HOLDLOCK)), 0, 1);
            IF EXISTS(SELECT 1 FROM dbo.Accounts WHERE NormalizedEmail = @normalized) BEGIN SELECT 0; RETURN; END;
            INSERT dbo.Accounts(Email,NormalizedEmail,PasswordHash) VALUES(@email,@normalized,@hash);
            DECLARE @id int = SCOPE_IDENTITY();
            INSERT dbo.AccountProfiles(AccountId,DisplayName,FullName,Phone,About,Email,Subscription,AvatarData,AvatarContentType)
            SELECT @id,@name, IIF(@first=1,FullName,N''), IIF(@first=1,Phone,N''), IIF(@first=1,About,N''),
                IIF(@first=1,Email,NULL), IIF(@first=1,Subscription,N'Basic'),
                IIF(@first=1,AvatarData,NULL), IIF(@first=1,AvatarContentType,NULL)
            FROM dbo.UserProfiles WHERE Id=1;
            INSERT dbo.AccountProducts(AccountId,ProductId,AddedAt)
                SELECT @id,Id,AddedAt FROM dbo.Products WHERE IsTracked=1;
            INSERT dbo.AccountSnapshots(AccountId,ProductId,CapturedAt,Price,OzonCardPrice,Stocks,SoldUnits,Rating,ReviewCount)
                SELECT @id,s.ProductId,s.CapturedAt,s.Price,s.OzonCardPrice,s.Stocks,s.SoldUnits,s.Rating,s.ReviewCount
                FROM dbo.ProductSnapshots s JOIN dbo.AccountProducts p ON p.ProductId=s.ProductId AND p.AccountId=@id;
            IF @first=1
                INSERT dbo.AccountChatMessages(AccountId,Role,Text,CreatedAt)
                SELECT @id,Role,Text,CreatedAt FROM dbo.ChatMessages ORDER BY Id;
            SELECT @id;
            """, connection, transaction);
        command.Parameters.Add("@email", SqlDbType.NVarChar, 254).Value = account.Email;
        command.Parameters.Add("@normalized", SqlDbType.NVarChar, 254).Value = Normalize(request.Email);
        command.Parameters.Add("@hash", SqlDbType.NVarChar, 500).Value = hash;
        command.Parameters.Add("@name", SqlDbType.NVarChar, 60).Value = request.DisplayName.Trim();
        var id = (int)(await command.ExecuteScalarAsync(ct))!;
        await transaction.CommitAsync(ct);
        return id == 0 ? null : account with { Id = id, PasswordHash = hash };
    }

    public bool Verify(Account account, string password) =>
        hasher.VerifyHashedPassword(account, account.PasswordHash, password) != PasswordVerificationResult.Failed;
}
