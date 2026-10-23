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
