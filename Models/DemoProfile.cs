namespace OzonTracker.Api.Models;

// Personal profile; email linking and subscriptions remain demonstrations.
public sealed record DemoProfile(
    string DisplayName, string FullName, string Phone, string About,
    string? Email, string Subscription, string? AvatarUrl, int RefreshMinutes, string LoginEmail,
    bool NotificationsEnabled, bool CompactTable);

public sealed record ChatMessage(long Id, string Role, string Text, DateTimeOffset CreatedAt);

public sealed record ProfileAvatar(byte[] Data, string ContentType);
