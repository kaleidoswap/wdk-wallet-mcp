/**
 * Minimal TypeScript fetch wrapper for the RLN (RGB Lightning Node) HTTP API.
 * Mirrors the surface used by the MCP tools — no extra dependencies.
 */

export interface NodeInfo {
  pubkey?: string
  num_channels?: number
  num_usable_channels?: number
  local_balance_sat?: number
  num_peers?: number
  account_xpub_vanilla?: string
  account_xpub_colored?: string
  network_nodes?: number
  network_channels?: number
  channel_capacity_min_sat?: number
  channel_capacity_max_sat?: number
}

export interface BtcBalance {
  settled?: number
  future?: number
  spendable?: number
}

export interface BtcBalanceResponse {
  vanilla?: BtcBalance
  colored?: BtcBalance
}

export interface AssetBalance {
  settled?: number
  future?: number
  spendable?: number
  offchain_outbound?: number
  offchain_inbound?: number
}

export interface RgbAsset {
  asset_id?: string
  name?: string
  ticker?: string
  precision?: number
}

export interface ListAssetsResponse {
  nia?: RgbAsset[]
  uda?: RgbAsset[]
  cfa?: RgbAsset[]
}

export interface RgbInvoice {
  recipient_id?: string
  invoice?: string
  expiration_timestamp?: number
  batch_transfer_idx?: number
}

export interface LnInvoice {
  invoice?: string
  payment_hash?: string
  expiry_sec?: number
}

export interface PaymentResult {
  payment_hash?: string
  payment_secret?: string
  status?: string
}

export interface Channel {
  channel_id?: string
  funding_txid?: string
  peer_pubkey?: string
  peer_alias?: string
  status?: string
  ready?: boolean
  capacity_sat?: number
  local_balance_sat?: number
  outbound_balance_msat?: number
  inbound_balance_msat?: number
  is_usable?: boolean
  public?: boolean
  asset_id?: string
  asset_local_amount?: number
  asset_remote_amount?: number
}

export interface Payment {
  payment_hash?: string
  payment_preimage?: string
  amount_msat?: number
  inbound?: boolean
  status?: string
  created_at?: number
}

export interface Swap {
  payment_hash?: string
  status?: string
  taker?: boolean
  [key: string]: unknown
}

export class RlnClient {
  private nodeUrl: string

  constructor(nodeUrl: string) {
    this.nodeUrl = nodeUrl.replace(/\/$/, '')
  }

  async getNodeInfo(): Promise<NodeInfo> {
    return this.request<NodeInfo>('GET', '/nodeinfo')
  }

  async getAddress(): Promise<{ address: string }> {
    return this.request<{ address: string }>('POST', '/address')
  }

  async getBtcBalance(skipSync = false): Promise<BtcBalanceResponse> {
    return this.request<BtcBalanceResponse>('POST', '/btcbalance', {
      skip_sync: skipSync,
    })
  }

  async getAssetBalance(assetId: string): Promise<AssetBalance> {
    return this.request<AssetBalance>('POST', '/assetbalance', { asset_id: assetId })
  }

  async listAssets(filterSchemas: string[] = []): Promise<ListAssetsResponse> {
    return this.request<ListAssetsResponse>('POST', '/listassets', {
      filter_asset_schemas: filterSchemas,
    })
  }

  async createRgbInvoice(params: {
    assetId?: string
    amount?: number
    durationSeconds?: number
    minConfirmations?: number
  }): Promise<RgbInvoice> {
    const body: Record<string, unknown> = {
      duration_seconds: params.durationSeconds ?? 86400,
      min_confirmations: params.minConfirmations ?? 1,
    }
    if (params.assetId) body.asset_id = params.assetId
    if (params.amount !== undefined) body.assignment = { amount: params.amount }
    return this.request<RgbInvoice>('POST', '/rgbinvoice', body)
  }

  async createLnInvoice(params: {
    amtMsat?: number
    description?: string
    expirySec?: number
  }): Promise<LnInvoice> {
    return this.request<LnInvoice>('POST', '/lninvoice', {
      amt_msat: params.amtMsat,
      description: params.description ?? '',
      expiry_sec: params.expirySec ?? 3600,
    })
  }

  async sendPayment(invoice: string): Promise<PaymentResult> {
    return this.request<PaymentResult>('POST', '/sendpayment', { invoice })
  }

  async sendBtc(address: string, amount: number, feeRate = 3): Promise<void> {
    await this.request('POST', '/sendbtc', { address, amount, fee_rate: feeRate })
  }

  async sendAsset(params: {
    assetId: string
    recipientId: string
    amount: number
    transportEndpoints?: string[]
    feeRate?: number
  }): Promise<{ txid?: string }> {
    return this.request<{ txid?: string }>('POST', '/sendrgb', {
      recipient_map: {
        [params.assetId]: [
          {
            recipient_id: params.recipientId,
            assignment: { amount: params.amount },
            transport_endpoints: params.transportEndpoints ?? [],
          },
        ],
      },
      fee_rate: params.feeRate,
    })
  }

  async listChannels(): Promise<{ channels: Channel[] }> {
    return this.request<{ channels: Channel[] }>('GET', '/listchannels')
  }

  async openChannel(params: {
    peerPubkeyAndAddr: string
    capacitySat: number
    pushMsat?: number
    assetId?: string
    assetAmount?: number
    isPublic?: boolean
  }): Promise<{ temporary_channel_id: string }> {
    return this.request('POST', '/openchannel', {
      peer_pubkey_and_opt_addr: params.peerPubkeyAndAddr,
      capacity_sat: params.capacitySat,
      push_msat: params.pushMsat ?? 0,
      asset_id: params.assetId,
      asset_amount: params.assetAmount,
      public: params.isPublic ?? false,
    })
  }

  async listPayments(): Promise<{ payments: Payment[] }> {
    return this.request<{ payments: Payment[] }>('GET', '/listpayments')
  }

  async refreshTransfers(skipSync = false): Promise<void> {
    await this.request('POST', '/refreshtransfers', { skip_sync: skipSync })
  }

  async estimateFee(blocks: number): Promise<{ fee_rate: number }> {
    return this.request<{ fee_rate: number }>('POST', '/estimatefee', { blocks })
  }

  async connectPeer(pubkeyAndAddr: string): Promise<void> {
    await this.request('POST', '/connectpeer', { peer_pubkey_and_addr: pubkeyAndAddr })
  }

  async atomicTaker(swapstring: string): Promise<void> {
    await this.request('POST', '/taker', { swapstring })
  }

  async listSwaps(): Promise<{ maker: Swap[]; taker: Swap[] }> {
    return this.request<{ maker: Swap[]; taker: Swap[] }>('GET', '/listswaps')
  }

  async getSwap(paymentHash: string, taker?: boolean): Promise<{ swap?: Swap }> {
    const body: Record<string, unknown> = { payment_hash: paymentHash }
    if (taker !== undefined) body.taker = taker
    return this.request<{ swap?: Swap }>('POST', '/getswap', body)
  }

  // ---------------------------------------------------------------------------

  private async request<T = void>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.nodeUrl}${path}`
    const opts: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
    }
    if (body !== undefined) opts.body = JSON.stringify(body)

    const res = await fetch(url, opts)

    if (!res.ok) {
      let message = `HTTP ${res.status}`
      try {
        const data = (await res.json()) as Record<string, string>
        message = data?.error ?? data?.detail ?? data?.message ?? message
      } catch {
        // ignore parse failure
      }
      throw new Error(`RLN node error: ${message}`)
    }

    const text = await res.text()
    return (text ? JSON.parse(text) : {}) as T
  }
}
