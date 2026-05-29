#!/usr/bin/env node

import { McpServer, StdioServerTransport } from "@modelcontextprotocol/server";
import { loadConfig } from "./config.js";
import { registerCombinedTool } from "./tools/combined.js";
import { registerEnergyTool } from "./tools/energy.js";
import { registerLoadShiftTool } from "./tools/load-shift.js";
import { registerResolveLocationTool } from "./tools/resolve-location.js";
import { registerWeatherTool } from "./tools/weather.js";

const config = loadConfig();

const server = new McpServer({
  name: "stroomr",
  version: "1.0.0",
});

registerResolveLocationTool(server, config);
registerWeatherTool(server, config);
registerEnergyTool(server, config);
registerCombinedTool(server, config);
registerLoadShiftTool(server, config);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error in stroomr-mcp:", err);
  process.exit(1);
});
