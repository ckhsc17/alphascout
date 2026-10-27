import { defineConfig } from "drizzle-kit";

// Migrations need a direct (unpooled) connection; fall back to DATABASE_URL elsewhere.
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dbCredentials: { url },
  schemaFilter: ["public"],
  casing: "snake_case",
});
