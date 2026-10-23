using System.Text.RegularExpressions;

namespace OzonTracker.Api.Utilities;

public static partial class OzonProductIdParser
{
    public static bool TryParse(string? value, out long productId)
    {
        productId = 0;

        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        var input = value.Trim();

        // Пользователь ввёл обычный числовой ID.
        if (long.TryParse(input, out productId) && productId > 0)
        {
            return true;
        }

        // Пользователь ввёл полноценную ссылку.
        if (Uri.TryCreate(input, UriKind.Absolute, out var uri))
        {
            var path = Uri.UnescapeDataString(
                uri.AbsolutePath.TrimEnd('/'));

            // Обычно ID товара находится в конце адреса.
            var pathMatch = ProductIdAtEndRegex().Match(path);

            if (pathMatch.Success &&
                long.TryParse(
                    pathMatch.Groups["id"].Value,
                    out productId) &&
                productId > 0)
            {
                return true;
            }
        }

        // Запасной вариант: ищем длинное число в тексте.
        var matches = LongNumberRegex().Matches(input);

        if (matches.Count == 0)
        {
            return false;
        }

        var lastMatch = matches[matches.Count - 1];

        return long.TryParse(lastMatch.Value, out productId)
               && productId > 0;
    }

    [GeneratedRegex(@"(?<id>\d+)$")]
    private static partial Regex ProductIdAtEndRegex();

    [GeneratedRegex(@"(?<!\d)\d{5,}(?!\d)")]
    private static partial Regex LongNumberRegex();
}