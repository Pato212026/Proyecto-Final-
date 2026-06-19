import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;
const sqlHost = process.env.SQL_HOST;
const sqlDbName = process.env.SQL_DB_NAME;
const user = process.env.SQL_ADMIN_USER;
const password = process.env.SQL_ADMIN_PASSWORD;

if (!databaseUrl) {
  if (!sqlHost) {
    throw new Error("SQL_HOST or DATABASE_URL must be set in environment variables.");
  }
  if (!sqlDbName) {
    throw new Error("SQL_DB_NAME must be set in environment variables.");
  }
  if (!user) {
    throw new Error("SQL_ADMIN_USER must be set in environment variables.");
  }
  if (!password) {
    throw new Error("SQL_ADMIN_PASSWORD must be set in environment variables.");
  }
}

const useSsl = databaseUrl ? (!databaseUrl.includes('localhost') && !databaseUrl.includes('127.0.0.1')) : false;

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/drizzle", // migrations folder nested inside src/db/drizzle style
  dialect: "postgresql",
  schemaFilter: ["public"],
  dbCredentials: databaseUrl ? {
    url: databaseUrl,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
  } : {
    host: sqlHost!,
    user: user!,
    password: password!,
    database: sqlDbName!,
    ssl: false,
  },
  verbose: true,
});
