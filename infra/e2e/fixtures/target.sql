-- Target database for the end-to-end scenario (phase 5): the stand-in for a user's SQL Server.
-- Owned by infra/e2e (docs/process/test-data.md); same business domain as the projects' fixtures, own copy.
-- Applied by the compose service `target-seed` with sqlcmd; batches are separated by GO.
-- Recreated on every run. Contains no real data. The procedure exists only so its definition reaches
-- the schema metadata; nothing may execute it.

IF DB_ID(N'esi_target') IS NOT NULL
BEGIN
    ALTER DATABASE esi_target SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE esi_target;
END
GO

CREATE DATABASE esi_target;
GO

-- Read-only login, as the consent terms advise. The password comes from sqlcmd variable READER_PASSWORD.
IF SUSER_ID(N'e2e_reader') IS NULL
    CREATE LOGIN e2e_reader WITH PASSWORD = N'$(READER_PASSWORD)', CHECK_POLICY = OFF;
ELSE
    ALTER LOGIN e2e_reader WITH PASSWORD = N'$(READER_PASSWORD)', CHECK_POLICY = OFF;
GO

USE esi_target;
GO

CREATE USER e2e_reader FOR LOGIN e2e_reader;
ALTER ROLE db_datareader ADD MEMBER e2e_reader;
GO

CREATE TABLE dbo.Customers (
    CustomerId   int IDENTITY(1, 1) NOT NULL CONSTRAINT PK_Customers PRIMARY KEY,
    Name         nvarchar(200) NOT NULL,
    Country      nvarchar(100) NOT NULL
);
GO

CREATE TABLE dbo.Products (
    ProductId    int IDENTITY(1, 1) NOT NULL CONSTRAINT PK_Products PRIMARY KEY,
    Sku          nvarchar(50) NOT NULL CONSTRAINT UQ_Products_Sku UNIQUE,
    Name         nvarchar(200) NOT NULL,
    UnitPrice    decimal(18, 2) NOT NULL
);
GO

CREATE TABLE dbo.Orders (
    OrderId      int IDENTITY(1, 1) NOT NULL CONSTRAINT PK_Orders PRIMARY KEY,
    CustomerId   int NOT NULL CONSTRAINT FK_Orders_Customers REFERENCES dbo.Customers (CustomerId),
    OrderDate    date NOT NULL
);
GO

CREATE TABLE dbo.OrderLines (
    OrderId      int NOT NULL CONSTRAINT FK_OrderLines_Orders REFERENCES dbo.Orders (OrderId),
    LineNumber   int NOT NULL,
    ProductId    int NOT NULL CONSTRAINT FK_OrderLines_Products REFERENCES dbo.Products (ProductId),
    Quantity     int NOT NULL,
    UnitPrice    decimal(18, 2) NOT NULL,
    CONSTRAINT PK_OrderLines PRIMARY KEY (OrderId, LineNumber)
);
GO

-- 25 customers, so a result has more rows than one page (20) and paging is exercised.
INSERT INTO dbo.Customers (Name, Country)
SELECT CONCAT(N'Customer ', FORMAT(n, '00')),
       CHOOSE((n - 1) % 5 + 1, N'Vietnam', N'Japan', N'Germany', N'Brazil', N'Canada')
FROM (SELECT TOP (25) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS n FROM sys.all_objects) AS numbers;

INSERT INTO dbo.Products (Sku, Name, UnitPrice)
VALUES (N'SKU-001', N'Widget', 10.00), (N'SKU-002', N'Gadget', 25.00);

-- One order per customer: customer n buys n widgets and one gadget, so revenue = 10 * n + 25.
INSERT INTO dbo.Orders (CustomerId, OrderDate)
SELECT CustomerId, DATEADD(DAY, CustomerId, '2026-01-01') FROM dbo.Customers;

INSERT INTO dbo.OrderLines (OrderId, LineNumber, ProductId, Quantity, UnitPrice)
SELECT o.OrderId, 1, 1, o.CustomerId, 10.00 FROM dbo.Orders AS o
UNION ALL
SELECT o.OrderId, 2, 2, 1, 25.00 FROM dbo.Orders AS o;
GO

CREATE PROCEDURE dbo.usp_GetCustomerOrders
    @CustomerId int
AS
BEGIN
    SET NOCOUNT ON;
    SELECT o.OrderId, o.OrderDate FROM dbo.Orders AS o WHERE o.CustomerId = @CustomerId;
END
GO
