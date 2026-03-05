#!/usr/bin/env node
/**
 * WDK Wallet MCP Server
 *
 * Exposes RLN (RGB Lightning Node) wallet tools to AI agents via the Model Context Protocol.
 * Communicates over stdio — connect via Claude Desktop, OpenClaw, or any MCP-compatible host.
 *
 * Usage:
 *   RLN_NODE_URL=http://localhost:3001 npx wdk-wallet-mcp
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createServer } from './server.js'

const NODE_URL = process.env.RLN_NODE_URL ?? 'http://localhost:3001'

async function main() {
  const server = createServer(NODE_URL)
  const transport = new StdioServerTransport()

  await server.connect(transport)

  process.stderr.write(`[wdk-wallet-mcp] Connected — RLN node: ${NODE_URL}\n`)
}

main().catch((err) => {
  process.stderr.write(`[wdk-wallet-mcp] Fatal error: ${err}\n`)
  process.exit(1)
})
