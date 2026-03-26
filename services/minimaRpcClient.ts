/**
 * Minima RPC Client
 *
 * Pure RPC client that connects to the local Minima node.
 * Handles connection retries, timeouts, and typed responses.
 * All Minima interaction should go through this client.
 */

import { MINIMA_RPC_URL, MINIMA_RPC_TIMEOUT } from '../config/defaults';
import type {
  MinimaRpcStatusResponse,
  MinimaRpcBalanceResponse,
  MinimaRpcTxPowResponse,
  MinimaRpcMaximaContactsResponse,
  MinimaRpcMaximaSendResponse,
  MinimaRpcResponse,
  MaximaIncomingMessage,
} from '../types/minima-rpc';

// ─── Connection State ────────────────────────────────────────────────────────

export type ConnectionState = 'connected' | 'disconnected' | 'reconnecting';
type ConnectionListener = (state: ConnectionState) => void;

class MinimaRpcClientImpl {
  private rpcUrl: string;
  private timeout: number;
  private connectionState: ConnectionState = 'disconnected';
  private connectionListeners: ConnectionListener[] = [];
  private retryCount = 0;
  private maxRetries = 5;

  constructor(rpcUrl?: string, timeout?: number) {
    this.rpcUrl = rpcUrl || MINIMA_RPC_URL;
    this.timeout = timeout || MINIMA_RPC_TIMEOUT;
  }

  // ─── Connection Management ───────────────────────────────────────────────

  onConnectionChange(listener: ConnectionListener): () => void {
    this.connectionListeners.push(listener);
    return () => {
      this.connectionListeners = this.connectionListeners.filter(l => l !== listener);
    };
  }

  private setConnectionState(state: ConnectionState): void {
    if (this.connectionState !== state) {
      this.connectionState = state;
      this.connectionListeners.forEach(l => l(state));
    }
  }

  get isConnected(): boolean {
    return this.connectionState === 'connected';
  }

  // ─── Core RPC Call ───────────────────────────────────────────────────────

  async call<T = unknown>(command: string): Promise<MinimaRpcResponse<T>> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const url = `${this.rpcUrl}/${encodeURIComponent(command)}`;
      const response = await fetch(url, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as MinimaRpcResponse<T>;
      this.setConnectionState('connected');
      this.retryCount = 0;
      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        this.setConnectionState('reconnecting');
      } else {
        this.setConnectionState('disconnected');
      }

      const message = error instanceof Error ? error.message : String(error);
      return { status: false, error: `RPC call failed: ${message}` };
    }
  }

  // ─── Typed Command Wrappers ──────────────────────────────────────────────

  /** Get node status including chain info, network, version, uptime */
  async status(): Promise<MinimaRpcStatusResponse> {
    const result = await this.call<MinimaRpcStatusResponse['response']>('status');
    return result as MinimaRpcStatusResponse;
  }

  /** Get token balances */
  async balance(): Promise<MinimaRpcBalanceResponse> {
    const result = await this.call<MinimaRpcBalanceResponse['response']>('balance');
    return result as MinimaRpcBalanceResponse;
  }

  /** Send Minima tokens */
  async send(to: string, amount: number): Promise<MinimaRpcResponse> {
    return this.call(`send to:${to} amount:${amount}`);
  }

  /** Create a burn transaction with metadata for provenance */
  async burn(amount: string, data: Record<string, unknown>): Promise<MinimaRpcResponse> {
    const jsonStr = JSON.stringify(data).replace(/ /g, '_');
    return this.call(`burn amount:${amount} data:${jsonStr}`);
  }

  /** Get transaction/block info by txpowid */
  async txpowinfo(txpowid: string): Promise<MinimaRpcTxPowResponse> {
    const result = await this.call<MinimaRpcTxPowResponse['response']>(`txpowinfo txpowid:${txpowid}`);
    return result as MinimaRpcTxPowResponse;
  }

  // ─── Maxima Commands ─────────────────────────────────────────────────────

  /** Get list of Maxima contacts */
  async maximaContacts(): Promise<MinimaRpcMaximaContactsResponse> {
    const result = await this.call<MinimaRpcMaximaContactsResponse['response']>('maxima action:contacts');
    return result as MinimaRpcMaximaContactsResponse;
  }

  /** Send a Maxima message to a contact */
  async maximaSend(to: string, application: string, data: unknown): Promise<MinimaRpcMaximaSendResponse> {
    const jsonStr = JSON.stringify(data).replace(/ /g, '_');
    const result = await this.call<MinimaRpcMaximaSendResponse['response']>(
      `maxima action:send to:${to} application:${application} data:${jsonStr}`
    );
    return result as MinimaRpcMaximaSendResponse;
  }

  /** Poll for incoming Maxima messages */
  async maximaPoll(): Promise<MinimaRpcResponse<MaximaIncomingMessage[]>> {
    return this.call<MaximaIncomingMessage[]>('maxima action:poll');
  }

  /** Get this node's Maxima identity/address */
  async maximaInfo(): Promise<MinimaRpcResponse<{ publickey: string; address: string; name: string }>> {
    return this.call('maxima');
  }

  // ─── Utility ─────────────────────────────────────────────────────────────

  /** Execute an arbitrary Minima command */
  async cmd(command: string): Promise<MinimaRpcResponse> {
    return this.call(command);
  }

  /** Health check — returns true if node is reachable */
  async healthCheck(): Promise<boolean> {
    const result = await this.status();
    return result.status === true;
  }

  /** Update the RPC URL (for reconfiguration) */
  setRpcUrl(url: string): void {
    this.rpcUrl = url;
    this.retryCount = 0;
    this.setConnectionState('disconnected');
  }
}

// ─── Singleton Export ────────────────────────────────────────────────────────

export const minimaRpcClient = new MinimaRpcClientImpl();
export const MinimaRpcClient = minimaRpcClient;
