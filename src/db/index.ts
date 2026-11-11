import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

declare global {
  var __ma3Pg: postgres.Sql | undefined;
}

const connectionString =
  process.env.DATABASE_URL ?? "postgres://madani:madani@localhost:5432/madani_aqiqah";

const globalForPg = globalThis as typeof globalThis & { __ma3Pg?: postgres.Sql };

export const sql = globalForPg.__ma3Pg ?? postgres(connectionString, { prepare: false, max: 5 });

if (process.env.NODE_ENV !== "production") globalForPg.__ma3Pg = sql;

export const db = drizzle(sql, { schema });

export type DB = typeof db;