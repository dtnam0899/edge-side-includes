-- Sample schema for the esi_target database: the stand-in for a user's target database (P0-14, ESI-34).
-- Owned by core-backend. Batches are separated by lines containing only GO.
-- Integration tests recreate esi_target and apply this script before each run; never apply it to esi_core.
-- dbo.usp_GetCustomerOrders exists so tests can read a stored procedure definition; nothing may execute it.

CREATE TABLE dbo.Customers (
    CustomerId   int IDENTITY(1, 1) NOT NULL CONSTRAINT PK_Customers PRIMARY KEY,
    Name         nvarchar(200) NOT NULL,
    Country      nvarchar(100) NOT NULL,
    CreatedAt    datetime2(0) NOT NULL CONSTRAINT DF_Customers_CreatedAt DEFAULT (SYSUTCDATETIME())
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
    OrderDate    date NOT NULL,
    Status       nvarchar(20) NOT NULL
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

INSERT INTO dbo.Customers (Name, Country) VALUES (N'Contoso Ltd', N'Vietnam'), (N'Fabrikam Inc', N'Japan');
INSERT INTO dbo.Products (Sku, Name, UnitPrice) VALUES (N'SKU-001', N'Widget', 10.50), (N'SKU-002', N'Gadget', 25.00);
INSERT INTO dbo.Orders (CustomerId, OrderDate, Status) VALUES (1, '2026-01-15', N'Shipped'), (2, '2026-02-01', N'Open');
INSERT INTO dbo.OrderLines (OrderId, LineNumber, ProductId, Quantity, UnitPrice)
VALUES (1, 1, 1, 3, 10.50), (1, 2, 2, 1, 25.00), (2, 1, 2, 4, 25.00);
GO

CREATE PROCEDURE dbo.usp_GetCustomerOrders
    @CustomerId int
AS
BEGIN
    SET NOCOUNT ON;
    SELECT o.OrderId, o.OrderDate, o.Status, SUM(l.Quantity * l.UnitPrice) AS Total
    FROM dbo.Orders AS o
    JOIN dbo.OrderLines AS l ON l.OrderId = o.OrderId
    WHERE o.CustomerId = @CustomerId
    GROUP BY o.OrderId, o.OrderDate, o.Status;
END
GO
