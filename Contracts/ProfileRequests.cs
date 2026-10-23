using System.ComponentModel.DataAnnotations;

namespace OzonTracker.Api.Contracts;

public sealed class UpdateProfileRequest
{
    [Required, StringLength(60, MinimumLength = 2)]
    public string DisplayName { get; init; } = string.Empty;

    [StringLength(200)]
    public string FullName { get; init; } = string.Empty;

    [StringLength(25)]
    [RegularExpression(@"^\+?(?=(?:\D*\d){7,15}\D*$)[0-9 ()-]{7,25}$",
        ErrorMessage = "Телефон должен содержать от 7 до 15 цифр; допустимы +, пробелы, скобки и дефисы.")]
    public string Phone { get; init; } = string.Empty;

    [StringLength(1000)]
    public string About { get; init; } = string.Empty;
}

public sealed class LinkEmailRequest
{
    [Required, EmailAddress, StringLength(254)]
    public string Email { get; init; } = string.Empty;
}

public sealed class ChangeSubscriptionRequest
{
    [Required, AllowedValues("Basic", "Plus", "Pro")]
    public string Subscription { get; init; } = "Basic";
}

public sealed class SendChatRequest
{
    [Required, StringLength(1000)]
    public string Text { get; init; } = string.Empty;
}
