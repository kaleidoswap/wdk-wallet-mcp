import test from 'node:test'
import { assertExactTools, listToolNames } from '../../scripts/mcp-contract-test-utils.mjs'

test('wdk-wallet-rln-mcp exposes the expected tool contract', async () => {
  const tools = await listToolNames({
    cwd: new URL('..', import.meta.url).pathname,
  })

  assertExactTools(tools, [
    'wdk_atomic_taker',
    'wdk_connect_peer',
    'wdk_create_ln_invoice',
    'wdk_create_rgb_invoice',
    'wdk_get_address',
    'wdk_get_asset_balance',
    'wdk_get_balances',
    'wdk_get_node_info',
    'wdk_get_swap',
    'wdk_list_assets',
    'wdk_list_channels',
    'wdk_list_payments',
    'wdk_list_swaps',
    'wdk_mpp_pay',
    'wdk_open_channel',
    'wdk_pay_invoice',
    'wdk_refresh_transfers',
    'wdk_send_asset',
    'wdk_send_btc',
  ])
})
