/**
 * Minima Service
 *
 * Frontend service that manages Minima node state and provides
 * a reactive interface for UI components. Uses minimaRpcClient
 * for actual RPC communication.
 */

import { NodeStats } from '../types';
import { ExceptionFilter } from '../utils/core';
import { getApiUrl } from '../utils/api';
import { PINET_VERSION } from '../config/defaults';

type Listener = () => void;

export interface MinimaTransaction {
  id: number;
  type: string;
  amount: string;
  date: string;
  status: string;
}

export interface MinimaStatusResponse {
  balance: number;
  blockHeight: number;
  transactions: MinimaTransaction[];
  peers: number;
  status: string;
}

export type ConnectionState = 'connected' | 'disconnected' | 'reconnecting';

class MinimaServiceImpl {
  private listeners: Listener[] = [];
  private _balance = 0;
  private _blockHeight = 0;
  private _transactions: MinimaTransaction[] = [];
  private _connectionState: ConnectionState = 'disconnected';
  private _stats: NodeStats = {
    blockHeight: 0,
    peers: 0,
    status: 'Offline',
    uptime: '0s',
    version: PINET_VERSION
  };

  constructor() {
    this.fetchUpdates();
    setInterval(() => this.fetchUpdates(), 5000);
  }

  private async fetchUpdates(): Promise<void> {
    try {
      const response = await fetch(getApiUrl('/api/minima/status'));
      if (response.ok) {
        const data = await response.json() as MinimaStatusResponse;
        this._balance = data.balance;
        this._blockHeight = data.blockHeight;
        this._transactions = data.transactions;
        this._connectionState = 'connected';
        this._stats = {
          ...this._stats,
          blockHeight: data.blockHeight,
          peers: data.peers,
          status: data.status as "Synced" | "Syncing" | "Offline"
        };
        this.emit();
      } else {
        this._connectionState = 'reconnecting';
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (e) {
      this._connectionState = 'disconnected';
      ExceptionFilter.handle(e, 'minimaService.fetchUpdates');
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  private emit(): void { this.listeners.forEach(l => l()); }

  get balance(): number { return this._balance; }
  get transactions(): MinimaTransaction[] { return this._transactions; }
  get stats(): NodeStats { return this._stats; }
  get connectionState(): ConnectionState { return this._connectionState; }

  async burn(amount: number, description: string): Promise<void> {
    try {
      const response = await fetch(getApiUrl('/api/minima/cmd'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: `burn amount:${amount} desc:${description}` })
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      this.fetchUpdates();
    } catch (e) {
      ExceptionFilter.handle(e, 'minimaService.burn');
    }
  }

  async send(to: string, amount: number): Promise<boolean> {
    try {
      const response = await fetch(getApiUrl('/api/minima/cmd'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: `send to:${to} amount:${amount}` })
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const result = await response.json() as { status: boolean };
      this.fetchUpdates();
      return result.status;
    } catch (e) {
      ExceptionFilter.handle(e, 'minimaService.send');
      return false;
    }
  }

  async cmd(command: string): Promise<any> {
    try {
      const response = await fetch(getApiUrl('/api/minima/cmd'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (e) {
      ExceptionFilter.handle(e, 'minimaService.cmd');
      return { status: false, error: e };
    }
  }

  async initiateM402Stream(rate: number): Promise<string> {
    const sessionId = `M402-${Math.random().toString(36).substr(2, 9)}`;
    await this.cmd(`m402 create session:${sessionId} rate:${rate} target:cluster_pool`);
    return sessionId;
  }

  async stopM402Stream(sessionId: string): Promise<void> {
    await this.cmd(`m402 close session:${sessionId}`);
  }

  /** Send a Maxima message via the backend API */
  async sendMaximaMessage(to: string, application: string, data: any): Promise<boolean> {
    try {
      const response = await fetch(getApiUrl('/api/maxima/send'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, application, data })
      });
      if (response.ok) {
        const result = await response.json() as { status: boolean };
        return result.status;
      }
    } catch (e) {
      ExceptionFilter.handle(e, 'minimaService.sendMaximaMessage');
    }

    // Fallback to direct command
    const jsonStr = JSON.stringify(data);
    const command = `maxima send to:${to} application:${application} data:${jsonStr}`;
    const result = await this.cmd(command);
    return result.status;
  }

  /** Get Maxima contacts from the backend */
  async getMaximaContacts(): Promise<any[]> {
    try {
      const response = await fetch(getApiUrl('/api/maxima/contacts'));
      if (response.ok) {
        const data = await response.json() as { contacts: any[] };
        return data.contacts || [];
      }
    } catch (e) {
      ExceptionFilter.handle(e, 'minimaService.getMaximaContacts');
    }
    return [];
  }

  /** Get cluster provenance history */
  async getProvenanceHistory(): Promise<any[]> {
    try {
      const response = await fetch(getApiUrl('/api/cluster/provenance'));
      if (response.ok) {
        return await response.json() as any[];
      }
    } catch (e) {
      ExceptionFilter.handle(e, 'minimaService.getProvenanceHistory');
    }
    return [];
  }
}

export const minimaService = new MinimaServiceImpl();
export const MinimaService = minimaService;
