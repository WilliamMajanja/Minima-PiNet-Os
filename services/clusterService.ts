
import { ClusterNode } from '../types';
import { ExceptionFilter } from '../utils/core';

type Listener = () => void;

class ClusterServiceImpl {
  private listeners: Listener[] = [];
  private _nodes: ClusterNode[] = [];

  constructor() {
    this.fetchUpdates();
    setInterval(() => this.fetchUpdates(), 5000);
  }

  private async fetchUpdates(): Promise<void> {
    try {
      const response = await fetch('/api/cluster/nodes');
      if (response.ok) {
        this._nodes = await response.json() as ClusterNode[];
        this.emit();
      } else {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (e) {
      ExceptionFilter.handle(e, 'clusterService.fetchUpdates');
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  private emit(): void { this.listeners.forEach(l => l()); }

  get nodes(): ClusterNode[] { return this._nodes; }

  async provisionNode(id: string): Promise<void> {
    try {
      const response = await fetch('/api/cluster/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      this.fetchUpdates();
    } catch (e) {
      ExceptionFilter.handle(e, 'clusterService.provisionNode');
    }
  }
}

export const clusterService = new ClusterServiceImpl();
