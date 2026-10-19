-- Sample target database for the ESI demo (ADR-0005): what a user would connect the assistant to.
-- Owned by infra/azure; run once against esi_demo_target (Azure portal Query editor or sqlcmd). Re-running
-- drops and recreates the tables. Demo data only: no real people or companies.

DROP TABLE IF EXISTS dbo.OrderLines;
DROP TABLE IF EXISTS dbo.Orders;
DROP TABLE IF EXISTS dbo.Products;
DROP TABLE IF EXISTS dbo.Customers;
GO

CREATE TABLE dbo.Customers (
    CustomerId   int           NOT NULL PRIMARY KEY,
    Name         nvarchar(100) NOT NULL,
    City         nvarchar(60)  NOT NULL,
    Segment      nvarchar(20)  NOT NULL,
    CreatedAt    date          NOT NULL
);

CREATE TABLE dbo.Products (
    ProductId    int           NOT NULL PRIMARY KEY,
    Name         nvarchar(100) NOT NULL,
    Category     nvarchar(40)  NOT NULL,
    UnitPrice    decimal(10,2) NOT NULL
);

CREATE TABLE dbo.Orders (
    OrderId      int           NOT NULL PRIMARY KEY,
    CustomerId   int           NOT NULL REFERENCES dbo.Customers (CustomerId),
    OrderDate    date          NOT NULL,
    Status       nvarchar(20)  NOT NULL
);

CREATE TABLE dbo.OrderLines (
    OrderId      int           NOT NULL REFERENCES dbo.Orders (OrderId),
    LineNumber   int           NOT NULL,
    ProductId    int           NOT NULL REFERENCES dbo.Products (ProductId),
    Quantity     int           NOT NULL,
    UnitPrice    decimal(10,2) NOT NULL,
    PRIMARY KEY (OrderId, LineNumber)
);
GO

INSERT INTO dbo.Customers (CustomerId, Name, City, Segment, CreatedAt) VALUES
    (1, N'Blue River Cafe',     N'Hanoi',       N'Retail',    '2025-01-12'),
    (2, N'Northwind Books',     N'Da Nang',     N'Retail',    '2025-02-03'),
    (3, N'Lotus Logistics',     N'Ho Chi Minh', N'Business',  '2025-02-20'),
    (4, N'Green Leaf Studio',   N'Hue',         N'Business',  '2025-03-15'),
    (5, N'Sunrise Fitness',     N'Hanoi',       N'Retail',    '2025-04-01'),
    (6, N'Harbor Electronics',  N'Hai Phong',   N'Business',  '2025-05-09');

INSERT INTO dbo.Products (ProductId, Name, Category, UnitPrice) VALUES
    (1, N'Espresso beans 1 kg', N'Coffee',      18.50),
    (2, N'Paper notebook',      N'Stationery',   3.20),
    (3, N'USB-C cable',         N'Electronics',  6.90),
    (4, N'Desk lamp',           N'Electronics', 24.00),
    (5, N'Green tea 500 g',     N'Tea',          9.75);

INSERT INTO dbo.Orders (OrderId, CustomerId, OrderDate, Status) VALUES
    (101, 1, '2026-07-02', N'Delivered'),
    (102, 3, '2026-07-05', N'Delivered'),
    (103, 2, '2026-07-19', N'Delivered'),
    (104, 6, '2026-08-01', N'Delivered'),
    (105, 1, '2026-08-14', N'Shipped'),
    (106, 4, '2026-08-30', N'Delivered'),
    (107, 5, '2026-09-03', N'Cancelled'),
    (108, 3, '2026-09-21', N'Shipped'),
    (109, 6, '2026-10-02', N'Pending'),
    (110, 2, '2026-10-10', N'Pending');

INSERT INTO dbo.OrderLines (OrderId, LineNumber, ProductId, Quantity, UnitPrice) VALUES
    (101, 1, 1,  4, 18.50), (101, 2, 5, 2,  9.75),
    (102, 1, 3, 20,  6.90), (102, 2, 4, 5, 24.00),
    (103, 1, 2, 50,  3.20),
    (104, 1, 3, 40,  6.50), (104, 2, 4, 10, 23.00),
    (105, 1, 1,  6, 18.50),
    (106, 1, 2, 30,  3.20), (106, 2, 5, 4,  9.75),
    (107, 1, 5,  3,  9.75),
    (108, 1, 4,  8, 24.00),
    (109, 1, 3, 25,  6.90),
    (110, 1, 2, 15,  3.20), (110, 2, 1, 2, 18.50);
GO
