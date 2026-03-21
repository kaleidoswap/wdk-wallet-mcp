#!/usr/bin/env node
/**
 * WDK Wallet RLN MCP Server
 *
 * Exposes RLN (RGB Lightning Node) wallet tools to AI agents via the Model Context Protocol.
 *
 * Transport:
 *   stdio (default)  — connect via Claude Desktop, kaleidoagent, or any MCP host
 *   HTTP             — set PORT to enable StreamableHTTP on that port (for hosted/remote use)
 *
 * Usage:
 *   RLN_NODE_URL=http://localhost:3001 npx wdk-wallet-rln-mcp
 *   PORT=3011 RLN_NODE_URL=http://localhost:3001 npx wdk-wallet-rln-mcp
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createServer } from './server.js'
import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from 'node:http'

const NODE_URL = process.env.RLN_NODE_URL ?? 'http://localhost:3001'
const PORT     = process.env.PORT ? parseInt(process.env.PORT, 10) : null

async function main() {
  const mcpServer = createServer(NODE_URL)

  if (PORT) {
    const AUTH_TOKEN = process.env.MCP_AUTH_TOKEN ?? null
    // HTTP mode — one StreamableHTTP transport per request (stateless)
    const httpServer = createHttpServer(async (req: IncomingMessage, res: ServerResponse) => {
      if (AUTH_TOKEN) {
        const auth = req.headers['authorization']
        if (auth !== `Bearer ${AUTH_TOKEN}`) {
          res.writeHead(401, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Unauthorized' }))
          return
        }
      }
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
      res.on('close', () => { transport.close().catch(() => {}) })
      await mcpServer.connect(transport)
      await transport.handleRequest(req, res)
    })
    httpServer.listen(PORT, '0.0.0.0', () => {
      process.stderr.write(`[wdk-wallet-rln-mcp] HTTP transport listening on port ${PORT} — RLN node: ${NODE_URL}\n`)
    })
  } else {
    // stdio mode (default)
    const transport = new StdioServerTransport()
    await mcpServer.connect(transport)
    process.stderr.write(`[wdk-wallet-rln-mcp] stdio transport connected — RLN node: ${NODE_URL}\n`)
  }
}

main().catch((err) => {
  process.stderr.write(`[wdk-wallet-rln-mcp] Fatal error: ${err}\n`)
  process.exit(1)
})
