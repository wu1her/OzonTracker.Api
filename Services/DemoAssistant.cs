using System.Globalization;
using OzonTracker.Api.Models;

namespace OzonTracker.Api.Services;

// Deterministic local imitation. No model, external requests, keys or invented predictions.
public static class DemoAssistant
{
    public static string Reply(string text, IReadOnlyCollection<Product> products)
    {
        var query = text.ToLowerInvariant();
        string Money(decimal value) => value.ToString("N2", CultureInfo.GetCultureInfo("ru-RU")) + " ₽";
        if (query.Contains("привет") || query.Contains("умеешь") || query.Contains("помощ"))
            return "Привет! Я демоассистент: отвечаю по шаблонам на основе ваших товаров в БД. Спросите: «Какие товары подешевели?», «Что с остатками?» или «Покажи сводку». Это имитация ИИ, без прогнозов и обращения к Ozon.";
        if (products.Count == 0) return "У вас пока нет отслеживаемых товаров. Добавьте товар из каталога, и я смогу показать сводку, изменения цен и остатки.";
        if (query.Contains("остат") || query.Contains("налич") || query.Contains("склад"))
        {
            var low = products.OrderBy(p => p.Stocks).Take(4);
            return "Наименьшие остатки по последнему срезу БД:\n" + string.Join("\n", low.Select(p => $"• {p.Name}: {p.Stocks} шт.")) + "\nЭто демонстрационные данные.";
        }
        if (query.Contains("подешев") || query.Contains("снижен") || query.Contains("скид") || query.Contains("цен"))
        {
            var falling = products.Where(p => p.History.Count >= 2 && p.Price < p.History[^2].Price)
                .OrderBy(p => (p.Price - p.History[^2].Price) / p.History[^2].Price).Take(4).ToList();
            return falling.Count == 0 ? "Между двумя последними срезами снижения цен нет. Откройте историю товара или смоделируйте изменения для демонстрации."
                : "Снижение цены между двумя последними срезами:\n" + string.Join("\n", falling.Select(p => $"• {p.Name}: {Money(p.History[^2].Price)} → {Money(p.Price)}")) + "\nЭто сравнение сохранённых демоданных, а не прогноз.";
        }
        if (query.Contains("продаж") || query.Contains("продан"))
            return "Накопленные демонстрационные продажи: " + products.Sum(p => (long)p.SoldUnits) + " шт.\nЛидер по этому счётчику: " + products.MaxBy(p => p.SoldUnits)!.Name + ". Счётчик не является продажами за сегодня.";
        if (query.Contains("свод") || query.Contains("стат") || query.Contains("обзор"))
            return $"В отслеживании: {products.Count} товаров.\nОстаток: {products.Sum(p => (long)p.Stocks)} шт.\nСредняя цена: {Money(products.Average(p => p.Price))}.\nБез остатка: {products.Count(p => p.Stocks == 0)}.\nИсточник: последние демонстрационные срезы в SQL Server.";
        return "Я демоассистент с готовыми сценариями, поэтому не могу ответить на произвольный вопрос. Попробуйте: «Покажи сводку», «Какие товары подешевели?», «Что с остатками?» или «Расскажи о продажах».";
    }
}
