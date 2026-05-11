import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadDotenv } from "dotenv";

for (const candidate of [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../../.env")]) {
  if (existsSync(candidate)) {
    loadDotenv({ path: candidate, override: false });
  }
}

export interface ApiConfig {
  port: number;
  host: string;
}

export function loadConfig(): ApiConfig {
  return {
    port: Number(process.env.API_PORT ?? 4000),
    host: process.env.API_HOST ?? "0.0.0.0"
  };
}
