using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Esi.Core.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddConnectionsAndConsent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Connections",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OwnerId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Server = table.Column<string>(type: "nvarchar(400)", maxLength: 400, nullable: false),
                    Database = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: false),
                    Consent = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    SecretCiphertext = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    SecretNonce = table.Column<byte[]>(type: "varbinary(12)", maxLength: 12, nullable: false),
                    SecretTag = table.Column<byte[]>(type: "varbinary(16)", maxLength: 16, nullable: false),
                    SecretWrappedDataKey = table.Column<byte[]>(type: "varbinary(60)", maxLength: 60, nullable: false),
                    SecretKeyVersion = table.Column<int>(type: "int", nullable: false),
                    SecretAlgorithm = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Connections", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ConsentAcceptances",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TermsVersion = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    AcceptedAt = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ConsentAcceptances", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Connections_OwnerId",
                table: "Connections",
                column: "OwnerId");

            migrationBuilder.CreateIndex(
                name: "IX_ConsentAcceptances_UserId_AcceptedAt",
                table: "ConsentAcceptances",
                columns: new[] { "UserId", "AcceptedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Connections");

            migrationBuilder.DropTable(
                name: "ConsentAcceptances");
        }
    }
}
