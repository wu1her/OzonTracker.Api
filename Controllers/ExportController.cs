using System.Globalization;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using OzonTracker.Api.Services;

namespace OzonTracker.Api.Controllers;

[ApiController]
[Route("api/products/export")]
public sealed class ExportController(SqlProfileRepository profiles, IProductRepository products) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        if ((await profiles.GetAsync(ct)).Subscription is not ("Plus" or "Pro"))
            return StatusCode(403, new { message = "Экспорт CSV доступен на тарифах Plus и Pro." });
        static string Cell(string text)
        {
            // Prevent spreadsheet formulas when opening catalog text in Excel.
            if (text.TrimStart().FirstOrDefault() is '=' or '+' or '-' or '@') text = "'" + text;
            return '"' + text.Replace("\"", "\"\"") + '"';
        }
        var csv = new StringBuilder("ID;Название;Цена;Цена по карте;Остаток;Продано всего;Обновлено\r\n");
        var culture = CultureInfo.GetCultureInfo("ru-RU");
        foreach (var p in await products.GetAllAsync(ct))
            csv.AppendLine(string.Join(";", new[] { p.OzonProductId.ToString(CultureInfo.InvariantCulture), Cell(p.Name),
                p.Price.ToString("F2", culture), p.OzonCardPrice.ToString("F2", culture),
                p.Stocks.ToString(CultureInfo.InvariantCulture), p.SoldUnits.ToString(CultureInfo.InvariantCulture), p.LastUpdatedAt.ToString("O") }));
        var data = Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(csv.ToString())).ToArray();
        return File(data, "text/csv; charset=utf-8", "ozon-products.csv");
    }
}
