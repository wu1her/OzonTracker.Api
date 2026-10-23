USE [OzonTrackerDemo];
GO
-- Find your account ID. Password hashes are deliberately not selected.
SELECT a.Id,a.Email,p.DisplayName,p.Subscription,a.CreatedAt
FROM dbo.Accounts a JOIN dbo.AccountProfiles p ON p.AccountId=a.Id;

-- Replace 1 with your account ID from the result above.
DECLARE @AccountId int=1;

SELECT p.OzonProductId,p.Name,a.IsTracked,a.IsFavorite,a.TargetPrice,s.*
FROM dbo.AccountProducts a JOIN dbo.Products p ON p.Id=a.ProductId
CROSS APPLY(SELECT TOP(1) CapturedAt,Price,OzonCardPrice,Stocks,SoldUnits,Rating,ReviewCount
    FROM dbo.AccountSnapshots WHERE AccountId=@AccountId AND ProductId=p.Id ORDER BY CapturedAt DESC,Id DESC)s
WHERE a.AccountId=@AccountId ORDER BY p.OzonProductId;

SELECT p.Name,s.CapturedAt,s.Price,
    s.Price-LAG(s.Price)OVER(PARTITION BY s.ProductId ORDER BY s.CapturedAt,s.Id)AS PriceChange,
    s.OzonCardPrice,s.Stocks,s.SoldUnits,s.Rating,s.ReviewCount
FROM dbo.AccountSnapshots s JOIN dbo.Products p ON p.Id=s.ProductId
WHERE s.AccountId=@AccountId ORDER BY p.Name,s.CapturedAt,s.Id;

SELECT p.Name,n.Price,n.TargetPrice,n.CreatedAt,n.ReadAt
FROM dbo.PriceNotifications n JOIN dbo.Products p ON p.Id=n.ProductId
WHERE n.AccountId=@AccountId ORDER BY n.Id DESC;

-- Change prices through application demo scenarios so alert rules are evaluated in the same transaction.
-- Images remain shared catalog metadata: UPDATE dbo.Products SET ImageUrl=... WHERE OzonProductId=...;
