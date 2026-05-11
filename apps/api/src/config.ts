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
