using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EnklWiki.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddAdminCredential : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "AdminCredentialHash",
                table: "Sites",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "AdminCredentialSalt",
                table: "Sites",
                type: "text",
                nullable: true);

            migrationBuilder.UpdateData(
                table: "Sites",
                keyColumn: "Id",
                keyValue: 1,
                columns: new[] { "AdminCredentialHash", "AdminCredentialSalt" },
                values: new object[] { null, null });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AdminCredentialHash",
                table: "Sites");

            migrationBuilder.DropColumn(
                name: "AdminCredentialSalt",
                table: "Sites");
        }
    }
}
