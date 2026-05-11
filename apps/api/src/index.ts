import { loadConfig } from "./config";
import { buildServer } from "./server";

const config = loadConfig();
const app = await buildServer();

await app.listen({
  port: config.port,
  host: config.host
});
