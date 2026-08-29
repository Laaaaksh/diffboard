import { config } from "dotenv";
import { resolve } from "node:path";

// Only fills in vars CI/the environment hasn't already set (e.g. a CI
// Postgres service container's DATABASE_URL).
config({ path: resolve(__dirname, ".env.test") });
