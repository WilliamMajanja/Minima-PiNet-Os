/**
 * Minima RPC Type Definitions
 * Typed interfaces for Minima node RPC responses
 */

// ─── Status Response ─────────────────────────────────────────────────────────

export interface MinimaRpcStatusResponse {
  status: boolean;
  response: {
    chain: {
      block: number;
      time: string;
      hash: string;
      speed: string;
      difficulty: string;
      weight: number;
      length: number;
    };
    network: {
      connected: number;
      connecting: number;
      host: string;
      hostSet: boolean;
      p2p: string;
      rpc: string;
    };
    version: string;
    uptime: string;
    memory: {
      ram: string;
      disk: string;
    };
  };
}

// ─── Balance Response ────────────────────────────────────────────────────────

export interface MinimaRpcBalanceResponse {
  status: boolean;
  response: Array<{
    token: string;
    tokenid: string;
    confirmed: string;
    unconfirmed: string;
    sendable: string;
    total: string;
  }>;
}

// ─── TxPow Info Response ─────────────────────────────────────────────────────

export interface MinimaRpcTxPowResponse {
  status: boolean;
  response: {
    txpowid: string;
    isblock: boolean;
    istransaction: boolean;
    superblock: number;
    body: {
      txnlist: Array<{
        inputs: Array<{ coinid: string; amount: string }>;
        outputs: Array<{ coinid: string; amount: string; address: string }>;
      }>;
      burnlist: Array<{
        amount: string;
        data: string;
      }>;
    };
  };
}

// ─── Maxima Contacts Response ────────────────────────────────────────────────

export interface MaximaContactInfo {
  id: number;
  publickey: string;
  currentaddress: string;
  myaddress: string;
  lastseen: number;
  samechain: boolean;
  extradata: {
    name?: string;
    minimaaddress?: string;
    topblock?: number;
    checkblock?: number;
    checkhash?: string;
  };
}

export interface MinimaRpcMaximaContactsResponse {
  status: boolean;
  response: MaximaContactInfo[];
}

// ─── Maxima Send Response ────────────────────────────────────────────────────

export interface MinimaRpcMaximaSendResponse {
  status: boolean;
  response?: {
    delivered: boolean;
    to: string;
    application: string;
  };
  error?: string;
}

// ─── Maxima Message (received via polling) ───────────────────────────────────

export interface MaximaIncomingMessage {
  from: string;
  to: string;
  application: string;
  data: string; // JSON string
  timemilli: number;
  msgid: string;
}

// ─── Burn Transaction ────────────────────────────────────────────────────────

export interface BurnTransactionRequest {
  amount: string;
  data: Record<string, unknown>;
}

// ─── Generic RPC Response ────────────────────────────────────────────────────

export interface MinimaRpcResponse<T = unknown> {
  status: boolean;
  response?: T;
  error?: string;
  pending?: boolean;
}
