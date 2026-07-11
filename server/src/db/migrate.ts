import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { db } from "./connection";
import { resolve } from "path";

const migrationsFolder = resolve(import.meta.dir, "migrations");

console.log("Running migrations...");
migrate(db, { migrationsFolder });
console.log("Migrations complete.");