# wdk-wallet-rln-mcp

MCP server that exposes an [RGB Lightning Node (RLN)](https://github.com/RGB-Tools/rgb-lightning-node) wallet to AI agents via the [Model Context Protocol](https://modelcontextprotocol.io).

Provides full wallet control: balances, RGB invoices, Lightning payments, channel management, and atomic swap taker support.

## Tools

### Node & Balances

| Tool | Description |
|------|-------------|
| `wdk_get_node_info` | Node pubkey, channel count, Lightning balance, connected peers |
| `wdk_get_balances` | BTC on-chain (vanilla + colored UTXOs) and Lightning balance |
| `wdk_get_asset_balance` | RGB asset balance by `asset_id` — settled, spendable, off-chain |
| `wdk_list_assets` | All RGB assets held by the node (NIA, UDA, CFA schemas) |
| `wdk_get_address` | On-chain BTC deposit address |

### Invoices & Payments

| Tool | Description |
|------|-------------|
| `wdk_create_rgb_invoice` | Create an RGB invoice to receive an asset off-chain |
| `wdk_create_ln_invoice` | Create a BOLT11 Lightning invoice to receive BTC |
| `wdk_pay_invoice` | Pay a BOLT11 Lightning invoice |
| `wdk_send_btc` | Send BTC on-chain |
| `wdk_send_asset` | Send an RGB asset on-chain to a recipient ID |

### Channel Management

| Tool | Description |
|------|-------------|
| `wdk_list_channels` | All channels: capacity, outbound/inbound balance, usability, RGB asset |
| `wdk_open_channel` | Open a new channel, optionally with RGB asset allocation |
| `wdk_connect_peer` | Connect to a Lightning peer (`pubkey@host:port`) — required before requesting an LSPS1 channel if the LSP isn't already a connected peer |

### Transfers & Payments History

| Tool | Description |
|------|-------------|
| `wdk_list_payments` | Recent Lightning payments (sent and received) |
| `wdk_refresh_transfers` | Flush pending RGB asset transfers |
| `wdk_list_transfers` | RGB transfers for one asset with status — check if an RGB invoice was paid |

### RGB Issuance

| Tool | Description |
|------|-------------|
| `wdk_create_utxos` | Create colorable UTXOs — needed before issuing, invoicing RGB, or opening asset channels |
| `wdk_issue_asset` | Issue a new RGB asset: `NIA` (fungible token with ticker), `CFA` (collectible fungible), `UDA` (unique / NFT). Amount in display units, converted with `precision` |

Typical flow on a fresh regtest node: `wdk_get_address` → fund it → `wdk_create_utxos` → `wdk_issue_asset { name: "Hackathon Ticket", ticker: "TICKET", amount: 1000 }` → `wdk_create_rgb_invoice` / `wdk_send_asset`.

### Atomic Swap Taker

| Tool | Description |
|------|-------------|
| `wdk_atomic_taker` | Step 2 of atomic swap — whitelist HTLC on node before execute |
| `wdk_list_swaps` | List all atomic swaps on the node |
| `wdk_get_swap` | Get atomic swap state by `payment_hash` |

### MPP (Machine Payments Protocol)

| Tool | Description |
|------|-------------|
| `wdk_mpp_pay` | Pay an MPP Lightning challenge from the RLN wallet; returns a credential JSON for `mpp_submit_credential` (mpp-gateway domain) |

## Atomic Swap Flow

This server handles **step 2** of the 5-step atomic swap flow:

```
kaleidoswap_atomic_init    → swapstring + payment_hash  (kaleidoswap-mcp)
wdk_atomic_taker           → whitelist HTLC on node     ← this server
wdk_get_node_info          → taker_pubkey               ← this server
kaleidoswap_atomic_execute → HTLC settlement            (kaleidoswap-mcp)
```

## Installation

```bash
npm install
npm run build
```

## Usage

```bash
# Stdio transport (use with any MCP host)
RLN_NODE_URL=http://localhost:3001 node dist/index.js
```

### Claude Desktop

```json
{
  "mcpServers": {
    "wdk_wallet": {
      "command": "node",
      "args": ["/path/to/wdk-wallet-rln-mcp/dist/index.js"],
      "env": {
        "RLN_NODE_URL": "http://localhost:3001"
      }
    }
  }
}
```

## Configuration

| Env var | Default | Description |
|---------|---------|-------------|
| `RLN_NODE_URL` | `http://localhost:3001` | RLN daemon HTTP API URL |

## Requirements

A running [RGB Lightning Node](https://github.com/RGB-Tools/rgb-lightning-node) daemon accessible at `RLN_NODE_URL`.

## License

Apache-2.0
