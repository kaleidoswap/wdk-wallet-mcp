import { WdkMcpServer } from '@tetherto/wdk-mcp-toolkit'
import { z } from 'zod'
import { RlnClient, type Swap } from './rln-client.js'

export function createServer(nodeUrl: string): WdkMcpServer {
  const rln = new RlnClient(nodeUrl)

  const server = new WdkMcpServer('wdk-wallet', '1.0.0')

  // -----------------------------------------------------------------------
  // Tool: wdk_get_node_info
  // -----------------------------------------------------------------------
  server.tool(
    'wdk_get_node_info',
    'Get the RLN node identity and network summary: pubkey, number of channels, Lightning balance, connected peers. Call this first to confirm the node is reachable.',
    {},
    async () => {
      const info = await rln.getNodeInfo()
      return text(JSON.stringify(info, null, 2))
    }
  )

  // -----------------------------------------------------------------------
  // Tool: wdk_get_balances
  // -----------------------------------------------------------------------
  server.tool(
    'wdk_get_balances',
    'Get current wallet balances: BTC on-chain (vanilla and colored UTXOs). For RGB asset balances use wdk_get_asset_balance with a specific asset_id.',
    {
      skip_sync: z
        .boolean()
        .optional()
        .describe('Skip blockchain sync for a faster response (default: false)'),
    },
    async ({ skip_sync = false }) => {
      const [btc, nodeInfo] = await Promise.all([
        rln.getBtcBalance(skip_sync),
        rln.getNodeInfo(),
      ])

      return text(
        JSON.stringify(
          {
            btc_onchain: {
              vanilla_spendable_sats: btc.vanilla?.spendable ?? 0,
              vanilla_settled_sats: btc.vanilla?.settled ?? 0,
              colored_spendable_sats: btc.colored?.spendable ?? 0,
              colored_settled_sats: btc.colored?.settled ?? 0,
            },
            lightning_balance_sat: nodeInfo.local_balance_sat ?? 0,
          },
          null,
          2
        )
      )
    }
  )

  // -----------------------------------------------------------------------
  // Tool: wdk_get_asset_balance
  // -----------------------------------------------------------------------
  server.tool(
    'wdk_get_asset_balance',
    'Get the balance of a specific RGB asset (e.g. USDT, XAUT) by its asset_id. Returns settled, future, spendable, and off-chain amounts.',
    {
      asset_id: z
        .string()
        .describe("RGB asset ID, e.g. 'rgb:2JEUOrsc-JsWuPGF-3cr9SSv-mqqRmaz-8waf0gl-8vAcOXw'"),
    },
    async ({ asset_id }) => {
      const balance = await rln.getAssetBalance(asset_id)
      return text(JSON.stringify({ asset_id, ...balance }, null, 2))
    }
  )

  // -----------------------------------------------------------------------
  // Tool: wdk_list_assets
  // -----------------------------------------------------------------------
  server.tool(
    'wdk_list_assets',
    'List all RGB assets held by the node (NIA, UDA, CFA schemas). Returns asset IDs, names, tickers, and precision.',
    {
      schemas: z
        .array(z.enum(['Nia', 'Uda', 'Cfa']))
        .optional()
        .describe("Filter by asset schema. Omit to return all. Options: 'Nia', 'Uda', 'Cfa'"),
    },
    async ({ schemas = [] }) => {
      const assets = await rln.listAssets(schemas)
      const all = [
        ...(assets.nia ?? []).map((a) => ({ ...a, schema: 'Nia' })),
        ...(assets.uda ?? []).map((a) => ({ ...a, schema: 'Uda' })),
        ...(assets.cfa ?? []).map((a) => ({ ...a, schema: 'Cfa' })),
      ]
      return text(JSON.stringify(all, null, 2))
    }
  )

  // -----------------------------------------------------------------------
  // Tool: wdk_get_address
  // -----------------------------------------------------------------------
  server.tool(
    'wdk_get_address',
    'Get the node on-chain BTC address for receiving Bitcoin deposits.',
    {},
    async () => {
      const res = await rln.getAddress()
      return text(JSON.stringify(res, null, 2))
    }
  )

  // -----------------------------------------------------------------------
  // Tool: wdk_create_rgb_invoice
  // -----------------------------------------------------------------------
  server.tool(
    'wdk_create_rgb_invoice',
    'Create an RGB invoice to receive an RGB asset (e.g. USDT from a KaleidoSwap). Pass the returned invoice string as receiver_address when calling kaleidoswap_place_order with receiver_address_format="RGB_INVOICE".',
    {
      asset_id: z
        .string()
        .optional()
        .describe('RGB asset ID to receive. Omit to create a generic invoice for any asset.'),
      amount: z
        .number()
        .positive()
        .optional()
        .describe('Expected amount to receive in display units (e.g. 65.5 for 65.5 USDT). Omit for any amount.'),
      duration_seconds: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('Invoice expiry in seconds (default: 86400 = 24h)'),
    },
    async ({ asset_id, amount, duration_seconds }) => {
      const invoice = await rln.createRgbInvoice({
        assetId: asset_id,
        amount,
        durationSeconds: duration_seconds,
      })
      return text(
        JSON.stringify(
          {
            invoice: invoice.invoice,
            recipient_id: invoice.recipient_id,
            expires_at: invoice.expiration_timestamp
              ? new Date(invoice.expiration_timestamp * 1000).toISOString()
              : null,
            usage: 'Pass invoice as receiver_address with receiver_address_format="RGB_INVOICE"',
          },
          null,
          2
        )
      )
    }
  )

  // -----------------------------------------------------------------------
  // Tool: wdk_create_ln_invoice
  // -----------------------------------------------------------------------
  server.tool(
    'wdk_create_ln_invoice',
    'Create a BOLT11 Lightning invoice to receive BTC via Lightning Network.',
    {
      amount_msat: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('Amount in millisatoshis. Omit for a zero-amount invoice.'),
      description: z
        .string()
        .optional()
        .describe('Invoice description / memo'),
      expiry_sec: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('Invoice expiry in seconds (default: 3600)'),
    },
    async ({ amount_msat, description, expiry_sec }) => {
      const inv = await rln.createLnInvoice({
        amtMsat: amount_msat,
        description,
        expirySec: expiry_sec,
      })
      return text(JSON.stringify(inv, null, 2))
    }
  )

  // -----------------------------------------------------------------------
  // Tool: wdk_pay_invoice
  // -----------------------------------------------------------------------
  server.tool(
    'wdk_pay_invoice',
    'Pay a BOLT11 Lightning invoice. Use this to send payment to a KaleidoSwap deposit_address after placing a swap order.',
    {
      invoice: z
        .string()
        .describe('BOLT11 Lightning invoice string (starts with lnbc... or lntb...)'),
    },
    async ({ invoice }) => {
      const result = await rln.sendPayment(invoice)
      return text(JSON.stringify(result, null, 2))
    }
  )

  // -----------------------------------------------------------------------
  // Tool: wdk_send_btc
  // -----------------------------------------------------------------------
  server.tool(
    'wdk_send_btc',
    'Send BTC on-chain to a Bitcoin address.',
    {
      address: z.string().describe('Destination Bitcoin address'),
      amount_sat: z.number().int().positive().describe('Amount in satoshis'),
      fee_rate: z
        .number()
        .positive()
        .optional()
        .describe('Fee rate in sat/vbyte (default: 3)'),
    },
    async ({ address, amount_sat, fee_rate = 3 }) => {
      await rln.sendBtc(address, amount_sat, fee_rate)
      return text(
        JSON.stringify({ sent: true, address, amount_sat, fee_rate }, null, 2)
      )
    }
  )

  // -----------------------------------------------------------------------
  // Tool: wdk_send_asset
  // -----------------------------------------------------------------------
  server.tool(
    'wdk_send_asset',
    'Send an RGB asset (e.g. USDT) on-chain to a recipient identified by their RGB recipient_id. Use this to fund a KaleidoSwap order whose deposit_address.format is "RGB_INVOICE" — pass the deposit_address.address as recipient_id.',
    {
      asset_id: z
        .string()
        .describe("RGB asset ID to send, e.g. 'rgb:2JEUOrsc-JsWuPGF-3cr9SSv-mqqRmaz-8waf0gl-8vAcOXw'"),
      recipient_id: z
        .string()
        .describe('Recipient identifier from an RGB invoice (deposit_address.address for RGB_INVOICE format)'),
      amount: z
        .number()
        .positive()
        .describe('Amount to send in display units (e.g. 65.5 for 65.5 USDT). Will be converted to raw units using asset precision.'),
      transport_endpoints: z
        .array(z.string())
        .optional()
        .describe('Optional transport endpoints for the RGB transfer'),
      fee_rate: z
        .number()
        .positive()
        .optional()
        .describe('On-chain fee rate in sat/vbyte (default: node decides)'),
    },
    async ({ asset_id, recipient_id, amount, transport_endpoints, fee_rate }) => {
      // Resolve precision for the asset
      const assets = await rln.listAssets([])
      const all = [
        ...(assets.nia ?? []),
        ...(assets.uda ?? []),
        ...(assets.cfa ?? []),
      ]
      const asset = all.find((a) => a.asset_id === asset_id)
      const precision = asset?.precision ?? 0
      const rawAmount = Math.round(amount * Math.pow(10, precision))

      const result = await rln.sendAsset({
        assetId: asset_id,
        recipientId: recipient_id,
        amount: rawAmount,
        transportEndpoints: transport_endpoints,
        feeRate: fee_rate,
      })
      return text(
        JSON.stringify(
          {
            sent: true,
            asset_id,
            recipient_id,
            amount_display: amount,
            amount_raw: rawAmount,
            txid: result.txid ?? null,
          },
          null,
          2
        )
      )
    }
  )

  // -----------------------------------------------------------------------
  // Tool: wdk_list_channels
  // -----------------------------------------------------------------------
  server.tool(
    'wdk_list_channels',
    'List all Lightning channels: capacity, local balance, usability status, and any RGB asset allocated to the channel.',
    {
      usable_only: z
        .boolean()
        .optional()
        .describe('Return only channels that are ready and usable (default: false)'),
    },
    async ({ usable_only = false }) => {
      const res = await rln.listChannels()
      const channels = usable_only
        ? (res.channels ?? []).filter((c) => c.is_usable)
        : (res.channels ?? [])

      const summary = channels.map((c) => ({
        channel_id: c.channel_id,
        peer_pubkey: c.peer_pubkey,
        status: c.status,
        ready: c.ready,
        is_usable: c.is_usable,
        capacity_sat: c.capacity_sat,
        local_balance_sat: c.local_balance_sat,
        outbound_balance_msat: c.outbound_balance_msat,
        inbound_balance_msat: c.inbound_balance_msat,
        asset_id: c.asset_id ?? null,
        asset_local_amount: c.asset_local_amount ?? null,
      }))

      const totalOutbound = channels.reduce(
        (s, c) => s + (c.outbound_balance_msat ?? 0),
        0
      )
      const totalInbound = channels.reduce(
        (s, c) => s + (c.inbound_balance_msat ?? 0),
        0
      )

      return text(
        JSON.stringify(
          {
            channel_count: channels.length,
            total_outbound_msat: totalOutbound,
            total_inbound_msat: totalInbound,
            channels: summary,
          },
          null,
          2
        )
      )
    }
  )

  // -----------------------------------------------------------------------
  // Tool: wdk_open_channel
  // -----------------------------------------------------------------------
  server.tool(
    'wdk_open_channel',
    'Open a new Lightning channel to a peer. Optionally allocate an RGB asset to the channel for off-chain asset transfers.',
    {
      peer_pubkey_and_addr: z
        .string()
        .describe("Peer connection string: '<pubkey>@<host>:<port>'"),
      capacity_sat: z
        .number()
        .int()
        .positive()
        .describe('Channel capacity in satoshis'),
      push_msat: z
        .number()
        .int()
        .optional()
        .describe('Millisatoshis to push to the remote side on open (default: 0)'),
      asset_id: z
        .string()
        .optional()
        .describe('RGB asset ID to allocate in this channel'),
      asset_amount: z
        .number()
        .positive()
        .optional()
        .describe('Amount of RGB asset to allocate'),
      is_public: z
        .boolean()
        .optional()
        .describe('Whether to announce the channel publicly (default: false)'),
    },
    async ({ peer_pubkey_and_addr, capacity_sat, push_msat, asset_id, asset_amount, is_public }) => {
      const result = await rln.openChannel({
        peerPubkeyAndAddr: peer_pubkey_and_addr,
        capacitySat: capacity_sat,
        pushMsat: push_msat,
        assetId: asset_id,
        assetAmount: asset_amount,
        isPublic: is_public,
      })
      return text(
        JSON.stringify(
          {
            temporary_channel_id: result.temporary_channel_id,
            status: 'Opening',
            note: 'Use wdk_list_channels to monitor until status becomes Opened',
          },
          null,
          2
        )
      )
    }
  )

  // -----------------------------------------------------------------------
  // Tool: wdk_list_payments
  // -----------------------------------------------------------------------
  server.tool(
    'wdk_list_payments',
    'List recent Lightning payments (sent and received). Useful for confirming that a swap deposit was sent successfully.',
    {
      limit: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('Maximum number of payments to return (default: 20)'),
      inbound_only: z.boolean().optional().describe('Show only received payments'),
      outbound_only: z.boolean().optional().describe('Show only sent payments'),
    },
    async ({ limit = 20, inbound_only, outbound_only }) => {
      const res = await rln.listPayments()
      let payments = res.payments ?? []

      if (inbound_only) payments = payments.filter((p) => p.inbound)
      if (outbound_only) payments = payments.filter((p) => !p.inbound)

      return text(JSON.stringify(payments.slice(0, limit), null, 2))
    }
  )

  // -----------------------------------------------------------------------
  // Tool: wdk_refresh_transfers
  // -----------------------------------------------------------------------
  server.tool(
    'wdk_refresh_transfers',
    'Refresh pending RGB asset transfers. Call this after a swap is reported FILLED to update on-chain asset balances.',
    {
      skip_sync: z
        .boolean()
        .optional()
        .describe('Skip blockchain sync (default: false)'),
    },
    async ({ skip_sync = false }) => {
      await rln.refreshTransfers(skip_sync)
      return text(
        JSON.stringify(
          { refreshed: true, note: 'Call wdk_get_asset_balance to check updated balance' },
          null,
          2
        )
      )
    }
  )

  // -----------------------------------------------------------------------
  // Tool: wdk_atomic_taker
  // -----------------------------------------------------------------------
  server.tool(
    'wdk_atomic_taker',
    'Step 2 of atomic swap: whitelist the incoming HTLC on the RLN node. Must be called with the swapstring from kaleidoswap_atomic_init BEFORE calling kaleidoswap_atomic_execute. This locks the HTLC on the node so it is ready to receive the atomic payment.',
    {
      swapstring: z.string().describe('Swapstring from kaleidoswap_atomic_init'),
    },
    async ({ swapstring }) => {
      await rln.atomicTaker(swapstring)
      return text(JSON.stringify({ success: true, note: 'HTLC whitelisted — now call wdk_get_node_info for pubkey, then kaleidoswap_atomic_execute' }, null, 2))
    }
  )

  // -----------------------------------------------------------------------
  // Tool: wdk_list_swaps
  // -----------------------------------------------------------------------
  server.tool(
    'wdk_list_swaps',
    'List all atomic swaps on the RLN node. Returns payment_hash, status, and direction for each swap. Useful for monitoring active and historical atomic swap activity.',
    {},
    async () => {
      const result = await rln.listSwaps()
      return text(JSON.stringify(result, null, 2))
    }
  )

  // -----------------------------------------------------------------------
  // Tool: wdk_get_swap
  // -----------------------------------------------------------------------
  server.tool(
    'wdk_get_swap',
    'Get atomic swap status by payment_hash from the RLN node. Use after kaleidoswap_atomic_execute to confirm the node-side swap state. Optionally filter by taker=true to check taker-side swaps.',
    {
      payment_hash: z.string().describe('Payment hash from kaleidoswap_atomic_init'),
      taker: z.boolean().optional().describe('Filter for taker-side swap (default: both)'),
    },
    async ({ payment_hash, taker }) => {
      const result = await rln.getSwap(payment_hash, taker)
      return text(JSON.stringify(result, null, 2))
    }
  )

  return server
}

// ---------------------------------------------------------------------------

function text(content: string) {
  return { content: [{ type: 'text' as const, text: content }] }
}

// Re-export WdkMcpServer type so callers don't need the raw MCP SDK
export type { WdkMcpServer }
