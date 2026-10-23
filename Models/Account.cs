namespace OzonTracker.Api.Models;

public sealed record Account(int Id, string Email, string PasswordHash);
public sealed record AccountInfo(int Id, string Email);
public sealed record PriceNotification(long Id, long OzonProductId, string ProductName,
    decimal Price, decimal TargetPrice, DateTimeOffset CreatedAt, DateTimeOffset? ReadAt);
public sealed record NotificationInbox(IReadOnlyCollection<PriceNotification> Items, int UnreadCount);
