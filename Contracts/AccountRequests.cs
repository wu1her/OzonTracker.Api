using System.ComponentModel.DataAnnotations;

namespace OzonTracker.Api.Contracts;

public sealed class RegisterRequest
{
    [Required, EmailAddress, StringLength(254)] public string Email { get; init; } = "";
    [Required, StringLength(128, MinimumLength = 8)] public string Password { get; init; } = "";
    [Required, StringLength(60, MinimumLength = 2)] public string DisplayName { get; init; } = "";
}
public sealed class LoginRequest
{
    [Required, EmailAddress, StringLength(254)] public string Email { get; init; } = "";
    [Required, StringLength(128)] public string Password { get; init; } = "";
}
public sealed class ProductPreferencesRequest
{
    public bool IsFavorite { get; init; }
    [Range(typeof(decimal), "0.01", "9999999999999999.99")]
    public decimal? TargetPrice { get; init; }
}
public sealed class ScenarioRequest
{
    [Required, AllowedValues("random", "sale", "outOfStock", "restock")]
    public string Scenario { get; init; } = "random";
    public long? OzonProductId { get; init; }
}
public sealed class RefreshSettingsRequest
{
    [Range(5, 1440)] public int RefreshMinutes { get; init; } = 60;
    public bool NotificationsEnabled { get; init; } = true;
    public bool CompactTable { get; init; }
}
