-- Extra sample data for the local esi_customer database only (manual testing and demos), applied by
-- seed-customer-db.sh after target-sample-schema.sql. The integration tests never apply it, so esi_target keeps its
-- small, exact data set. Batches are separated by lines containing only GO.
-- Adds categories, a sales team (hr schema, with a self-referencing manager), payments, a few columns on the sample
-- tables, and about 60 customers, 30 products and 1,500 orders from 2025-01 to 2026-10. Values come from a SHA-256
-- hash (dbo.SeedHash, dropped at the end), not NEWID, so every reset gives the same rows. Names are fictitious.
-- One transaction across the batches: sqlcmd -b stops at the first error and the open transaction is rolled back.

SET XACT_ABORT ON;
BEGIN TRANSACTION;
GO

-- Deterministic, evenly spread pseudo-random number (CHECKSUM of small ints is not: its low bits follow the last
-- argument). Seeding only; dropped before the commit.
CREATE FUNCTION dbo.SeedHash (@a int, @b int, @salt int)
RETURNS int
AS
BEGIN
    RETURN ABS(CAST(CAST(HASHBYTES('SHA2_256', CONCAT(@a, ':', @b, ':', @salt)) AS binary(4)) AS int) % 2147483647);
END;
GO

CREATE SCHEMA hr;
GO

CREATE TABLE dbo.Categories (
    CategoryId   int IDENTITY(1, 1) NOT NULL CONSTRAINT PK_Categories PRIMARY KEY,
    Name         nvarchar(100) NOT NULL CONSTRAINT UQ_Categories_Name UNIQUE
);
GO

CREATE TABLE hr.Employees (
    EmployeeId   int IDENTITY(1, 1) NOT NULL CONSTRAINT PK_Employees PRIMARY KEY,
    FullName     nvarchar(200) NOT NULL,
    Title        nvarchar(100) NOT NULL,
    Region       nvarchar(50) NOT NULL,
    HireDate     date NOT NULL,
    ManagerId    int NULL CONSTRAINT FK_Employees_Manager REFERENCES hr.Employees (EmployeeId)
);
GO

ALTER TABLE dbo.Products ADD CategoryId int NULL CONSTRAINT FK_Products_Categories REFERENCES dbo.Categories (CategoryId);
ALTER TABLE dbo.Customers ADD City nvarchar(100) NULL, Segment nvarchar(20) NULL;
ALTER TABLE dbo.Orders ADD
    SalesRepId   int NULL CONSTRAINT FK_Orders_Employees REFERENCES hr.Employees (EmployeeId),
    ShippedDate  date NULL;
GO

CREATE TABLE dbo.Payments (
    PaymentId    int IDENTITY(1, 1) NOT NULL CONSTRAINT PK_Payments PRIMARY KEY,
    OrderId      int NOT NULL CONSTRAINT FK_Payments_Orders REFERENCES dbo.Orders (OrderId),
    PaidAt       date NOT NULL,
    Amount       decimal(18, 2) NOT NULL,
    Method       nvarchar(20) NOT NULL
);
GO

INSERT INTO dbo.Categories (Name) VALUES
    (N'Electronics'), (N'Office Supplies'), (N'Furniture'), (N'Software'), (N'Accessories'), (N'Networking');

INSERT INTO hr.Employees (FullName, Title, Region, HireDate, ManagerId) VALUES
    (N'Linh Tran', N'VP of Sales', N'Global', '2019-03-01', NULL),
    (N'Minh Nguyen', N'Sales Manager', N'Asia Pacific', '2020-06-15', 1),
    (N'Anna Schmidt', N'Sales Manager', N'Europe', '2021-01-11', 1),
    (N'James Carter', N'Sales Manager', N'Americas', '2021-09-01', 1),
    (N'Hoa Pham', N'Account Executive', N'Asia Pacific', '2022-02-14', 2),
    (N'Kenji Sato', N'Account Executive', N'Asia Pacific', '2022-08-01', 2),
    (N'Tuan Le', N'Account Executive', N'Asia Pacific', '2023-04-03', 2),
    (N'Mai Vo', N'Account Executive', N'Asia Pacific', '2024-07-22', 2),
    (N'Lukas Weber', N'Account Executive', N'Europe', '2022-05-09', 3),
    (N'Claire Martin', N'Account Executive', N'Europe', '2023-10-02', 3),
    (N'Emily Brooks', N'Account Executive', N'Americas', '2022-11-07', 4),
    (N'Daniel Reyes', N'Account Executive', N'Americas', '2024-01-15', 4);

UPDATE dbo.Products SET CategoryId = CASE Sku WHEN N'SKU-001' THEN 5 ELSE 1 END;

INSERT INTO dbo.Products (Sku, Name, UnitPrice, CategoryId) VALUES
    (N'SKU-003', N'Laptop 14"', 899.00, 1),
    (N'SKU-004', N'Laptop 16" Pro', 1499.00, 1),
    (N'SKU-005', N'27" Monitor', 279.00, 1),
    (N'SKU-006', N'Docking Station', 189.00, 1),
    (N'SKU-007', N'Wireless Headset', 129.00, 1),
    (N'SKU-008', N'Webcam HD', 69.00, 1),
    (N'SKU-009', N'Printer Paper A4 (box)', 32.50, 2),
    (N'SKU-010', N'Ballpoint Pens (50)', 12.90, 2),
    (N'SKU-011', N'Sticky Notes (12)', 9.80, 2),
    (N'SKU-012', N'Whiteboard Markers (8)', 11.40, 2),
    (N'SKU-013', N'Desk Organizer', 24.00, 2),
    (N'SKU-014', N'Ergonomic Chair', 349.00, 3),
    (N'SKU-015', N'Standing Desk', 529.00, 3),
    (N'SKU-016', N'Filing Cabinet', 219.00, 3),
    (N'SKU-017', N'Meeting Table', 799.00, 3),
    (N'SKU-018', N'Bookshelf', 149.00, 3),
    (N'SKU-019', N'Office Suite (1 year)', 99.00, 4),
    (N'SKU-020', N'Antivirus (1 year)', 39.00, 4),
    (N'SKU-021', N'BI Dashboard License', 480.00, 4),
    (N'SKU-022', N'Accounting Software', 360.00, 4),
    (N'SKU-023', N'Design Suite (1 year)', 599.00, 4),
    (N'SKU-024', N'USB-C Cable', 14.00, 5),
    (N'SKU-025', N'Wireless Mouse', 29.00, 5),
    (N'SKU-026', N'Mechanical Keyboard', 89.00, 5),
    (N'SKU-027', N'Laptop Sleeve', 35.00, 5),
    (N'SKU-028', N'Wi-Fi Router', 159.00, 6),
    (N'SKU-029', N'24-port Switch', 329.00, 6),
    (N'SKU-030', N'Network Cable 10 m', 18.00, 6),
    (N'SKU-031', N'Firewall Appliance', 1199.00, 6),
    (N'SKU-032', N'Access Point', 199.00, 6);
GO

-- Places: country, city and the sales region that serves them.
DECLARE @place TABLE (i int PRIMARY KEY, Country nvarchar(100), City nvarchar(100), Region nvarchar(50));
INSERT INTO @place VALUES
    (0, N'Vietnam', N'Ho Chi Minh City', N'Asia Pacific'), (1, N'Vietnam', N'Hanoi', N'Asia Pacific'),
    (2, N'Vietnam', N'Da Nang', N'Asia Pacific'), (3, N'Vietnam', N'Ho Chi Minh City', N'Asia Pacific'),
    (4, N'Japan', N'Tokyo', N'Asia Pacific'), (5, N'Japan', N'Osaka', N'Asia Pacific'),
    (6, N'Singapore', N'Singapore', N'Asia Pacific'), (7, N'Thailand', N'Bangkok', N'Asia Pacific'),
    (8, N'South Korea', N'Seoul', N'Asia Pacific'), (9, N'Australia', N'Sydney', N'Asia Pacific'),
    (10, N'Germany', N'Berlin', N'Europe'), (11, N'France', N'Paris', N'Europe'),
    (12, N'United Kingdom', N'London', N'Europe'), (13, N'United States', N'Seattle', N'Americas'),
    (14, N'United States', N'Austin', N'Americas'), (15, N'Canada', N'Toronto', N'Americas');

DECLARE @prefix TABLE (i int PRIMARY KEY, Word nvarchar(50));
INSERT INTO @prefix VALUES
    (0, N'Northwind'), (1, N'Adventure'), (2, N'Blue Yonder'), (3, N'Tailspin'), (4, N'Wide World'),
    (5, N'Litware'), (6, N'Proseware'), (7, N'Lucerne'), (8, N'Coho'), (9, N'Alpine'),
    (10, N'Woodgrove'), (11, N'Trey'), (12, N'Margie'), (13, N'Fourth Coffee'), (14, N'Humongous'),
    (15, N'Lamna'), (16, N'VanArsdel'), (17, N'Relecloud'), (18, N'Southridge'), (19, N'Datum');
DECLARE @suffix TABLE (i int PRIMARY KEY, Word nvarchar(50));
INSERT INTO @suffix VALUES (0, N'Traders'), (1, N'Works'), (2, N'Group');

UPDATE dbo.Customers
SET City = CASE Country WHEN N'Vietnam' THEN N'Ho Chi Minh City' ELSE N'Tokyo' END,
    Segment = CASE Country WHEN N'Vietnam' THEN N'Enterprise' ELSE N'SMB' END;

WITH n AS (
    SELECT TOP (58) CAST(ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS int) AS n FROM sys.all_objects
)
INSERT INTO dbo.Customers (Name, Country, City, Segment, CreatedAt)
SELECT p.Word + N' ' + s.Word, pl.Country, pl.City,
       CASE WHEN dbo.SeedHash(n.n, 0, 3) % 10 < 2 THEN N'Enterprise'
            WHEN dbo.SeedHash(n.n, 0, 3) % 10 < 7 THEN N'SMB' ELSE N'Consumer' END,
       DATEADD(day, dbo.SeedHash(n.n, 0, 2) % 600, CAST('2024-06-01' AS datetime2(0)))
FROM n
JOIN @prefix AS p ON p.i = (n.n - 1) % 20
JOIN @suffix AS s ON s.i = (n.n - 1) / 20
JOIN @place AS pl ON pl.i = dbo.SeedHash(n.n, 0, 1) % 16
ORDER BY n.n;

-- Orders: more of them in recent months (growth), a sales rep from the customer's region.
WITH n AS (
    SELECT TOP (1500) CAST(ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS int) AS n
    FROM sys.all_objects AS a CROSS JOIN sys.all_objects AS b
),
draft AS (
    SELECT n.n,
           1 + dbo.SeedHash(n.n, 0, 10) % 60 AS CustomerId,
           DATEADD(day, CAST(SQRT((dbo.SeedHash(n.n, 0, 11) % 10000) / 10000.0) * 658 AS int),
                   CAST('2025-01-01' AS date)) AS OrderDate
    FROM n
)
INSERT INTO dbo.Orders (CustomerId, OrderDate, Status, SalesRepId, ShippedDate)
SELECT d.CustomerId, d.OrderDate, st.Status, rep.EmployeeId,
       CASE WHEN st.Status IN (N'Shipped', N'Delivered')
            THEN DATEADD(day, 1 + dbo.SeedHash(d.n, 0, 12) % 5, d.OrderDate) END
FROM draft AS d
JOIN dbo.Customers AS c ON c.CustomerId = d.CustomerId
CROSS APPLY (
    SELECT CASE WHEN dbo.SeedHash(d.n, 0, 13) % 25 = 0 THEN N'Cancelled'
                WHEN d.OrderDate >= '2026-10-14' THEN N'Open'
                WHEN d.OrderDate >= '2026-09-28' THEN N'Shipped'
                ELSE N'Delivered' END AS Status
) AS st
OUTER APPLY (
    SELECT TOP (1) e.EmployeeId
    FROM hr.Employees AS e
    JOIN (SELECT DISTINCT Country, Region FROM @place) AS pl ON pl.Region = e.Region
    WHERE pl.Country = c.Country AND e.Title = N'Account Executive'
    ORDER BY dbo.SeedHash(e.EmployeeId, d.CustomerId, 40)
) AS rep
ORDER BY d.OrderDate, d.n;
GO

-- 1 to 4 lines per new order; 10% off from 10 units.
WITH k AS (SELECT k FROM (VALUES (1), (2), (3), (4)) AS v (k))
INSERT INTO dbo.OrderLines (OrderId, LineNumber, ProductId, Quantity, UnitPrice)
SELECT o.OrderId, k.k, p.ProductId, q.Quantity,
       CASE WHEN q.Quantity >= 10 THEN ROUND(p.UnitPrice * 0.9, 2) ELSE p.UnitPrice END
FROM dbo.Orders AS o
JOIN k ON k.k <= 1 + dbo.SeedHash(o.OrderId, 0, 20) % 4
JOIN dbo.Products AS p ON p.ProductId = 1 + dbo.SeedHash(o.OrderId, k.k, 21) % 32
CROSS APPLY (
    SELECT CASE WHEN p.UnitPrice < 50 THEN 2 + dbo.SeedHash(o.OrderId, k.k, 22) % 19
                ELSE 1 + dbo.SeedHash(o.OrderId, k.k, 22) % 4 END AS Quantity
) AS q
WHERE o.OrderId > 2;
GO

-- Payments: most delivered orders are paid in full, about half of the shipped ones; a few delivered are still due.
INSERT INTO dbo.Payments (OrderId, PaidAt, Amount, Method)
SELECT o.OrderId,
       CASE WHEN pay.PaidAt > '2026-10-21' THEN '2026-10-21' ELSE pay.PaidAt END,
       t.Total,
       CASE dbo.SeedHash(o.OrderId, 0, 31) % 4
            WHEN 0 THEN N'Bank transfer' WHEN 1 THEN N'Credit card' WHEN 2 THEN N'E-wallet' ELSE N'Cash' END
FROM dbo.Orders AS o
CROSS APPLY (SELECT SUM(l.Quantity * l.UnitPrice) AS Total FROM dbo.OrderLines AS l WHERE l.OrderId = o.OrderId) AS t
CROSS APPLY (SELECT DATEADD(day, dbo.SeedHash(o.OrderId, 0, 30) % 30, COALESCE(o.ShippedDate, o.OrderDate)) AS PaidAt) AS pay
WHERE o.OrderId > 2
  AND t.Total IS NOT NULL
  AND ((o.Status = N'Delivered' AND dbo.SeedHash(o.OrderId, 0, 32) % 10 <> 0)
    OR (o.Status = N'Shipped' AND dbo.SeedHash(o.OrderId, 0, 32) % 2 = 0));
GO

DROP FUNCTION dbo.SeedHash;

COMMIT TRANSACTION;
GO
