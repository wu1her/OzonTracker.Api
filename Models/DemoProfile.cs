namespace OzonTracker.Api.Models;

// One shared local demonstration profile, without authentication or billing.
public sealed record DemoProfile(
    string DisplayName, string FullName, string Phone, string About,
    string? Email, string Subscription, string? AvatarUrl);

public sealed record ChatMessage(long Id, string Role, string Text, DateTimeOffset CreatedAt);

public sealed record ProfileAvatar(byte[] Data, string ContentType);
