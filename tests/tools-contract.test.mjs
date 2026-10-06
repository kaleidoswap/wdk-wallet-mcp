import test from 'node:test'
import assert from 'node:assert/strict'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createServer } from '../dist/server.js'

async function listToolNames() {
  const server = createServer('http://127.0.0.1:1')
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 'contract-test', version: '0.0.0' })
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
  const { tools } = await client.listTools()
  await client.close()
  return tools.map((t) => t.name)
}

test('wdk-wallet-rln-mcp exposes the expected tool contract', async () => {
  const tools = await listToolNames()

  assert.deepEqual([...tools].sort(), [
    'wdk_atomic_taker',
    'wdk_connect_peer',
    'wdk_create_ln_invoice',
    'wdk_create_rgb_invoice',
    'wdk_create_utxos',
    'wdk_get_address',
    'wdk_get_asset_balance',
    'wdk_get_balances',
    'wdk_get_node_info',
    'wdk_get_swap',
    'wdk_issue_asset',
    'wdk_list_assets',
    'wdk_list_channels',
    'wdk_list_payments',
    'wdk_list_swaps',
    'wdk_list_transfers',
    'wdk_mpp_pay',
    'wdk_open_channel',
    'wdk_pay_invoice',
    'wdk_refresh_transfers',
    'wdk_send_asset',
    'wdk_send_btc',
  ])
})
