using System.ComponentModel.DataAnnotations;

namespace OzonTracker.Api.Contracts;

public sealed class AddProductRequest
{
    [Required(ErrorMessage = "Укажите ссылку или ID товара.")]
    public string Value { get; init; } = string.Empty;
}