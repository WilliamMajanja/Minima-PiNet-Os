
import { NodeStats } from '../types';
import { ExceptionFilter } from '../utils/core';

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

class MinimaServiceImpl {
  private listeners: Listener[] = [];
  private _balance = 1250.45;
  private _blockHeight = 1245091;
  private _transactions: MinimaTransaction[] = [];
  private _stats: NodeStats = {
    blockHeight: 1245091,
    peers: 14,
    status: 'Synced',
    uptime: '14d 05h 22m',
    version: '1.0.35'
  };

  constructor() {
    this.fetchUpdates();
    setInterval(() => this.fetchUpdates(), 5000);
  }

  private async fetchUpdates(): Promise<void> {
    try {
      const response = await fetch('/api/minima/status');
      if (response.ok) {
        const data = await response.json() as MinimaStatusResponse;
        this._balance = data.balance;
        this._blockHeight = data.blockHeight;
        this._transactions = data.transactions;
        this._stats = {
          ...this._stats,
          blockHeight: data.blockHeight,
          peers: data.peers,
          status: data.status
        };
        this.emit();
      } else {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (e) {
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

  async burn(amount: number, description: string): Promise<void> {
    try {
      const response = await fetch('/api/minima/cmd', {
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
      const response = await fetch('/api/minima/cmd', {
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
      const response = await fetch('/api/minima/cmd', {
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

  async sendMaximaMessage(to: string, application: string, data: any): Promise<boolean> {
    const jsonStr = JSON.stringify(data);
    const command = `maxima send to:${to} application:${application} data:${jsonStr}`;
    const result = await this.cmd(command);
    return result.status;
  }
}

export const minimaService = new MinimaServiceImpl();
export const MinimaService = minimaService;
