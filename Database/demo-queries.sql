USE [OzonTrackerDemo];
GO

-- Каталог и текущие показатели (включая неотслеживаемые товары).
SELECT p.OzonProductId, p.Name, p.IsTracked, s.*
FROM dbo.Products p
CROSS APPLY (SELECT TOP (1) CapturedAt, Price, OzonCardPrice, Stocks, SoldUnits, Rating, ReviewCount
             FROM dbo.ProductSnapshots WHERE ProductId = p.Id ORDER BY CapturedAt DESC, Id DESC) s
ORDER BY p.OzonProductId;

-- История и изменения цены между сохранёнными срезами.
SELECT p.Name, s.CapturedAt, s.Price,
       s.Price - LAG(s.Price) OVER (PARTITION BY p.Id ORDER BY s.CapturedAt, s.Id) AS PriceChange,
       s.OzonCardPrice, s.Stocks, s.SoldUnits, s.Rating, s.ReviewCount
FROM dbo.Products p
JOIN dbo.ProductSnapshots s ON s.ProductId = p.Id
ORDER BY p.Name, s.CapturedAt, s.Id;

/* Пример ручного изменения цены. Выделите и выполните отдельно.
   История дополняется, старые срезы не перезаписываются.
   Затем нажмите «Обновить список» в приложении.

DECLARE @OzonProductId bigint = 100000001;
DECLARE @NewPrice decimal(18,2) = 4990.00;
INSERT dbo.ProductSnapshots(ProductId, CapturedAt, Price, OzonCardPrice, Stocks, SoldUnits, Rating, ReviewCount)
SELECT p.Id, SYSDATETIMEOFFSET(), @NewPrice, ROUND(@NewPrice * 0.94, 2),
       s.Stocks, s.SoldUnits, s.Rating, s.ReviewCount
FROM dbo.Products p
CROSS APPLY (SELECT TOP (1) * FROM dbo.ProductSnapshots
             WHERE ProductId = p.Id ORDER BY CapturedAt DESC, Id DESC) s
WHERE p.OzonProductId = @OzonProductId;
*/
