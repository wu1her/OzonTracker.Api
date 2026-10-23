/* Run the entire file in SSMS (F5). SQL Server 2019+.
   All products, prices, ratings and sales are fictional demo data.
   Re-running is safe: existing products and their history are preserved. */
USE [master];
GO
IF DB_ID(N'OzonTrackerDemo') IS NULL
    CREATE DATABASE [OzonTrackerDemo];
GO
USE [OzonTrackerDemo];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.Products', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Products
    (
        Id uniqueidentifier NOT NULL CONSTRAINT PK_Products PRIMARY KEY DEFAULT NEWID(),
        OzonProductId bigint NOT NULL CONSTRAINT UQ_Products_OzonProductId UNIQUE,
        Name nvarchar(200) NOT NULL,
        Description nvarchar(1000) NOT NULL,
        ImageUrl nvarchar(1000) NULL,
        IsTracked bit NOT NULL DEFAULT 0,
        AddedAt datetimeoffset(7) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT CK_Products_OzonProductId CHECK (OzonProductId > 0)
    );
END;

IF OBJECT_ID(N'dbo.ProductSnapshots', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ProductSnapshots
    (
        Id bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_ProductSnapshots PRIMARY KEY,
        ProductId uniqueidentifier NOT NULL,
        CapturedAt datetimeoffset(7) NOT NULL,
        Price decimal(18,2) NOT NULL,
        OzonCardPrice decimal(18,2) NOT NULL,
        Stocks int NOT NULL,
        SoldUnits int NOT NULL,
        Rating decimal(3,2) NOT NULL,
        ReviewCount int NOT NULL,
        CONSTRAINT FK_ProductSnapshots_Products FOREIGN KEY (ProductId) REFERENCES dbo.Products(Id),
        CONSTRAINT CK_ProductSnapshots_Price CHECK (Price > 0 AND OzonCardPrice >= 0 AND OzonCardPrice <= Price),
        CONSTRAINT CK_ProductSnapshots_Counters CHECK (Stocks >= 0 AND SoldUnits >= 0 AND ReviewCount >= 0),
        CONSTRAINT CK_ProductSnapshots_Rating CHECK (Rating BETWEEN 0 AND 5)
    );
    CREATE INDEX IX_ProductSnapshots_Product_Time
        ON dbo.ProductSnapshots(ProductId, CapturedAt DESC, Id DESC)
        INCLUDE (Price, OzonCardPrice, Stocks, SoldUnits, Rating, ReviewCount);
END;

DECLARE @Catalog TABLE
(
    OzonProductId bigint, Name nvarchar(200), Description nvarchar(1000),
    BasePrice decimal(18,2), InitialStock int, Number int
);
INSERT @Catalog VALUES
(100000001, N'Беспроводные наушники AirSound Pro', N'Демо · Электроника · Bluetooth 5.3, шумоподавление, 30 часов работы', 5990, 85, 1),
(100000002, N'Смартфон Nova X12 256 ГБ', N'Демо · Электроника · AMOLED 6.7, 8 ГБ RAM, аккумулятор 5000 мА·ч', 32990, 48, 2),
(100000003, N'Кофемашина Barista Home', N'Демо · Бытовая техника · 15 бар, капучинатор, резервуар 1.5 л', 18990, 36, 3),
(100000004, N'Робот-пылесос CleanBot S5', N'Демо · Бытовая техника · Влажная уборка, лидар, 120 минут работы', 24990, 60, 4),
(100000005, N'Кроссовки Urban Run', N'Демо · Спорт · Размер 42, амортизирующая подошва, сетчатый верх', 4590, 120, 5),
(100000006, N'Рюкзак CityPack 25 л', N'Демо · Аксессуары · Отделение для ноутбука 15.6, влагостойкая ткань', 2790, 30, 6),
(100000007, N'Монитор ViewMax 27 дюймов', N'Демо · Компьютеры · IPS, 2560×1440, 165 Гц', 21990, 44, 7),
(100000008, N'Клавиатура Mechanical K87', N'Демо · Компьютеры · Механические переключатели, RGB, USB-C', 6490, 95, 8),
(100000009, N'Фитнес-браслет Pulse Fit', N'Демо · Спорт · Пульс, шаги, сон, защита IP68', 3490, 130, 9),
(100000010, N'Настольная лампа LightDesk', N'Демо · Дом · Три температуры света, диммер, USB', 1990, 72, 10),
(100000011, N'Набор посуды Chef Set', N'Демо · Кухня · Нержавеющая сталь, 6 предметов, индукция', 7990, 40, 11),
(100000012, N'Портативная колонка BassGo', N'Демо · Электроника · 20 Вт, Bluetooth, влагозащита IPX7', 4290, 110, 12);

DECLARE @Inserted TABLE (Id uniqueidentifier, OzonProductId bigint);
DECLARE @Now datetimeoffset(7) = SYSDATETIMEOFFSET();
INSERT dbo.Products(OzonProductId, Name, Description, IsTracked, AddedAt)
OUTPUT inserted.Id, inserted.OzonProductId INTO @Inserted
SELECT c.OzonProductId, c.Name, c.Description, IIF(c.Number <= 6, 1, 0), DATEADD(day, -29, @Now)
FROM @Catalog c
WHERE NOT EXISTS (SELECT 1 FROM dbo.Products p WITH (UPDLOCK, HOLDLOCK) WHERE p.OzonProductId = c.OzonProductId);

;WITH Days AS
(
    SELECT 0 AS DayNumber
    UNION ALL SELECT DayNumber + 1 FROM Days WHERE DayNumber < 29
)
INSERT dbo.ProductSnapshots(ProductId, CapturedAt, Price, OzonCardPrice, Stocks, SoldUnits, Rating, ReviewCount)
SELECT i.Id, DATEADD(day, d.DayNumber - 29, @Now), price.Value, ROUND(price.Value * 0.94, 2),
       CASE WHEN c.Number = 6 AND d.DayNumber >= 27 THEN 0
            ELSE c.InitialStock + (d.DayNumber / 10) * 30 - (d.DayNumber % 10) * 3 END,
       100 * c.Number + d.DayNumber * (c.Number % 4 + 2),
       CAST(4.2 + (c.Number % 8) * 0.1 AS decimal(3,2)),
       20 * c.Number + d.DayNumber / 2
FROM @Inserted i
JOIN @Catalog c ON c.OzonProductId = i.OzonProductId
CROSS JOIN Days d
CROSS APPLY (SELECT CAST(ROUND(c.BasePrice *
    (1.0 + (c.Number % 3 - 1) * d.DayNumber * 0.003 + ((d.DayNumber + c.Number) % 7 - 3) * 0.012), 2)
    AS decimal(18,2)) AS Value) price;

COMMIT;

SELECT COUNT(*) AS CatalogProducts, SUM(CONVERT(int, IsTracked)) AS TrackedProducts FROM dbo.Products;
SELECT COUNT(*) AS HistorySnapshots FROM dbo.ProductSnapshots;
GO
