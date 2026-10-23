-- Upgrade existing database: preserves legacy data and images.
USE [OzonTrackerDemo];
GO
SET XACT_ABORT ON;
BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.UserProfiles', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.UserProfiles
    (
        Id tinyint NOT NULL CONSTRAINT PK_UserProfiles PRIMARY KEY,
        DisplayName nvarchar(60) NOT NULL,
        FullName nvarchar(200) NOT NULL DEFAULT N'',
        Phone nvarchar(25) NOT NULL DEFAULT N'',
        About nvarchar(1000) NOT NULL DEFAULT N'',
        Email nvarchar(254) NULL,
        Subscription nvarchar(5) NOT NULL DEFAULT N'Basic',
        AvatarData varbinary(max) NULL,
        AvatarContentType varchar(10) NULL,
        UpdatedAt datetimeoffset(7) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT CK_UserProfiles_SingleDemo CHECK (Id = 1),
        CONSTRAINT CK_UserProfiles_Subscription CHECK (Subscription IN (N'Basic', N'Plus', N'Pro')),
        CONSTRAINT CK_UserProfiles_Avatar CHECK (
            (AvatarData IS NULL AND AvatarContentType IS NULL) OR
            (AvatarData IS NOT NULL AND AvatarContentType IS NOT NULL
             AND AvatarContentType IN ('image/png', 'image/jpeg', 'image/webp')
             AND DATALENGTH(AvatarData) BETWEEN 1 AND 2097152))
    );
END;

IF NOT EXISTS (SELECT 1 FROM dbo.UserProfiles WITH (UPDLOCK, HOLDLOCK) WHERE Id = 1)
    INSERT dbo.UserProfiles(Id, DisplayName) VALUES (1, N'Пользователь');

IF OBJECT_ID(N'dbo.ChatMessages', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ChatMessages
    (
        Id bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_ChatMessages PRIMARY KEY,
        ProfileId tinyint NOT NULL DEFAULT 1,
        Role varchar(9) NOT NULL,
        Text nvarchar(2000) NOT NULL,
        CreatedAt datetimeoffset(7) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT FK_ChatMessages_Profile FOREIGN KEY (ProfileId) REFERENCES dbo.UserProfiles(Id),
        CONSTRAINT CK_ChatMessages_Role CHECK (Role IN ('user', 'assistant'))
    );
END;

COMMIT;
GO

USE [OzonTrackerDemo];
GO
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID(N'dbo.Accounts', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Accounts (
        Id int IDENTITY PRIMARY KEY,
        Email nvarchar(254) NOT NULL,
        NormalizedEmail nvarchar(254) NOT NULL UNIQUE,
        PasswordHash nvarchar(500) NOT NULL,
        CreatedAt datetimeoffset NOT NULL DEFAULT SYSDATETIMEOFFSET()
    );
    CREATE TABLE dbo.AccountProfiles (
        AccountId int PRIMARY KEY REFERENCES dbo.Accounts(Id),
        DisplayName nvarchar(60) NOT NULL,
        FullName nvarchar(200) NOT NULL DEFAULT N'',
        Phone nvarchar(25) NOT NULL DEFAULT N'',
        About nvarchar(1000) NOT NULL DEFAULT N'',
        Email nvarchar(254) NULL,
        Subscription nvarchar(5) NOT NULL DEFAULT N'Basic' CHECK (Subscription IN (N'Basic',N'Plus',N'Pro')),
        AvatarData varbinary(max) NULL,
        AvatarContentType varchar(10) NULL,
        RefreshMinutes int NOT NULL DEFAULT 60 CHECK (RefreshMinutes BETWEEN 5 AND 1440),
        UpdatedAt datetimeoffset(7) NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CHECK ((AvatarData IS NULL AND AvatarContentType IS NULL) OR
            (AvatarData IS NOT NULL AND AvatarContentType IS NOT NULL AND AvatarContentType IN ('image/png','image/jpeg','image/webp') AND DATALENGTH(AvatarData) BETWEEN 1 AND 2097152))
    );
    CREATE TABLE dbo.AccountProducts (
        AccountId int NOT NULL REFERENCES dbo.Accounts(Id),
        ProductId uniqueidentifier NOT NULL REFERENCES dbo.Products(Id),
        IsTracked bit NOT NULL DEFAULT 1,
        AddedAt datetimeoffset NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        IsFavorite bit NOT NULL DEFAULT 0,
        TargetPrice decimal(18,2) NULL CHECK (TargetPrice > 0),
        TargetTriggered bit NOT NULL DEFAULT 0,
        PRIMARY KEY (AccountId,ProductId)
    );
    CREATE TABLE dbo.AccountSnapshots (
        Id bigint IDENTITY PRIMARY KEY,
        AccountId int NOT NULL,
        ProductId uniqueidentifier NOT NULL,
        CapturedAt datetimeoffset(7) NOT NULL,
        Price decimal(18,2) NOT NULL CHECK (Price > 0),
        OzonCardPrice decimal(18,2) NOT NULL,
        Stocks int NOT NULL CHECK (Stocks >= 0),
        SoldUnits int NOT NULL CHECK (SoldUnits >= 0),
        Rating decimal(3,2) NOT NULL CHECK (Rating BETWEEN 0 AND 5),
        ReviewCount int NOT NULL CHECK (ReviewCount >= 0),
        FOREIGN KEY (AccountId,ProductId) REFERENCES dbo.AccountProducts(AccountId,ProductId),
        CHECK (OzonCardPrice BETWEEN 0 AND Price)
    );
    CREATE INDEX IX_AccountSnapshots_Time ON dbo.AccountSnapshots(AccountId,ProductId,CapturedAt DESC,Id DESC)
        INCLUDE (Price,OzonCardPrice,Stocks,SoldUnits,Rating,ReviewCount);
    CREATE TABLE dbo.AccountChatMessages (
        Id bigint IDENTITY PRIMARY KEY,
        AccountId int NOT NULL REFERENCES dbo.Accounts(Id),
        Role varchar(9) NOT NULL CHECK (Role IN ('user','assistant')),
        Text nvarchar(2000) NOT NULL,
        CreatedAt datetimeoffset NOT NULL DEFAULT SYSDATETIMEOFFSET()
    );
    CREATE INDEX IX_AccountChat ON dbo.AccountChatMessages(AccountId,Id DESC);
    CREATE TABLE dbo.PriceNotifications (
        Id bigint IDENTITY PRIMARY KEY,
        AccountId int NOT NULL,
        ProductId uniqueidentifier NOT NULL,
        Price decimal(18,2) NOT NULL,
        TargetPrice decimal(18,2) NOT NULL,
        CreatedAt datetimeoffset NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        ReadAt datetimeoffset NULL,
        FOREIGN KEY (AccountId,ProductId) REFERENCES dbo.AccountProducts(AccountId,ProductId)
    );
    CREATE INDEX IX_PriceNotifications_Account ON dbo.PriceNotifications(AccountId,Id DESC);
END;
-- Additive settings upgrade, including databases prepared by an earlier build.
IF COL_LENGTH(N'dbo.AccountProfiles', N'NotificationsEnabled') IS NULL
    ALTER TABLE dbo.AccountProfiles ADD NotificationsEnabled bit NOT NULL DEFAULT 1;
IF COL_LENGTH(N'dbo.AccountProfiles', N'CompactTable') IS NULL
    ALTER TABLE dbo.AccountProfiles ADD CompactTable bit NOT NULL DEFAULT 0;
COMMIT;
GO
