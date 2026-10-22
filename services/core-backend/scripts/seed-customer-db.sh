#!/usr/bin/env bash
# Creates the local customer database (a SQL Server target database for manual testing) on the compose sqlserver,
# loads the sample schema and rows, and adds a read-only login, as the consent terms ask of real users. Then it loads
# the extra demo data (EXTRA_DATA_FILE) once: also into a database created before that file existed.
# Run by the `customer-db-seed` compose service; it never changes data that is already there, so data survives
# restarts. `docker compose down -v` removes it. Integration tests never touch it (they recreate esi_target).
set -euo pipefail

: "${SA_PASSWORD:?}" "${CUSTOMER_DB:?}" "${READER_LOGIN:?}" "${READER_PASSWORD:?}" "${SCHEMA_FILE:?}"
sql() { /opt/mssql-tools18/bin/sqlcmd -C -S sqlserver -U sa -P "$SA_PASSWORD" -b "$@"; }
scalar() { sql -h -1 -W -Q "SET NOCOUNT ON; $1"; }

if [ "$(scalar "SELECT CASE WHEN DB_ID(N'$CUSTOMER_DB') IS NULL THEN 0 ELSE 1 END")" = "1" ]; then
  echo "$CUSTOMER_DB already exists."
else
  sql -Q "CREATE DATABASE [$CUSTOMER_DB];"
  sql -d "$CUSTOMER_DB" -i "$SCHEMA_FILE"
  sql -Q "IF SUSER_ID(N'$READER_LOGIN') IS NULL CREATE LOGIN [$READER_LOGIN] WITH PASSWORD = N'$READER_PASSWORD', CHECK_POLICY = OFF;"
  sql -d "$CUSTOMER_DB" -Q "CREATE USER [$READER_LOGIN] FOR LOGIN [$READER_LOGIN];
ALTER ROLE db_datareader ADD MEMBER [$READER_LOGIN];
GRANT VIEW DEFINITION TO [$READER_LOGIN];"
  echo "$CUSTOMER_DB created with read-only login $READER_LOGIN."
fi

if [ -n "${EXTRA_DATA_FILE:-}" ]; then
  if [ "$(scalar "SELECT CASE WHEN OBJECT_ID(N'[$CUSTOMER_DB].dbo.Payments') IS NULL THEN 0 ELSE 1 END")" = "1" ]; then
    echo "Extra demo data already loaded; nothing to do."
  else
    # The file runs in one transaction: a failure leaves the database as it was, so the next run tries again.
    sql -d "$CUSTOMER_DB" -i "$EXTRA_DATA_FILE"
    echo "Extra demo data loaded: $(scalar "SELECT CONCAT((SELECT COUNT(*) FROM [$CUSTOMER_DB].dbo.Customers), ' customers, ', (SELECT COUNT(*) FROM [$CUSTOMER_DB].dbo.Orders), ' orders, ', (SELECT COUNT(*) FROM [$CUSTOMER_DB].dbo.OrderLines), ' order lines, ', (SELECT COUNT(*) FROM [$CUSTOMER_DB].dbo.Payments), ' payments')")."
  fi
fi
