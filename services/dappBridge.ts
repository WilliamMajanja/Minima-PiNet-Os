/**
 * DApp Bridge — PostMessage-based communication channel between an
 * embedded DApp iframe and the PiNet OS host.
 *
 * The bridge listens for `pinet-bridge-request` messages from the iframe,
 * dispatches them to the appropriate PiNet service, and sends back
 * `pinet-bridge-response` messages.
 *
 * Usage (host side):
 *   const bridge = new DAppBridge(iframeElement, manifest, callbacks);
 *   // ... when done:
 *   bridge.destroy();
 */

import type {
  DAppBridgeRequest,
  DAppBridgeResponse,
  DAppBridgeEvent,
  DAppManifest,
  DAppPermission,
} from '../types/dapp';
import { getApiUrl } from '../utils/api';
import { ExceptionFilter } from '../utils/core';

export interface DAppBridgeCallbacks {
  /** Called when the DApp requests a toast / notification */
  onNotify?: (title: string, body: string) => void;
}

export class DAppBridge {
  private iframe: HTMLIFrameElement;
  private manifest: DAppManifest;
  private callbacks: DAppBridgeCallbacks;
  private boundOnMessage: (e: MessageEvent) => void;
  private iframeOrigin: string;

  constructor(
    iframe: HTMLIFrameElement,
    manifest: DAppManifest,
    callbacks: DAppBridgeCallbacks = {},
  ) {
    this.iframe = iframe;
    this.manifest = manifest;
    this.callbacks = callbacks;
    this.boundOnMessage = this.onMessage.bind(this);
    // Derive the iframe origin from its src for safe postMessage targeting
    try {
      this.iframeOrigin = new URL(iframe.src, window.location.href).origin;
    } catch {
      this.iframeOrigin = window.location.origin;
    }
    window.addEventListener('message', this.boundOnMessage);
  }

  /** Remove the listener — call when the DApp window closes. */
  destroy(): void {
    window.removeEventListener('message', this.boundOnMessage);
  }

  /** Push an event into the DApp iframe. */
  pushEvent(event: DAppBridgeEvent): void {
    this.iframe.contentWindow?.postMessage(event, this.iframeOrigin);
  }

  // ─── Internal ────────────────────────────────────────────────────────

  private hasPermission(required: DAppPermission): boolean {
    return this.manifest.permissions.includes(required);
  }

  private async onMessage(event: MessageEvent): Promise<void> {
    // Only handle messages from the DApp iframe
    if (event.source !== this.iframe.contentWindow) return;

    const data = event.data as DAppBridgeRequest | undefined;
    if (!data || data.type !== 'pinet-bridge-request') return;

    let response: DAppBridgeResponse;
    try {
      const result = await this.dispatch(data);
      response = {
        type: 'pinet-bridge-response',
        requestId: data.requestId,
        success: true,
        data: result,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      response = {
        type: 'pinet-bridge-response',
        requestId: data.requestId,
        success: false,
        error: message,
      };
      ExceptionFilter.handle(err, `DAppBridge.${data.method}`);
    }

    this.iframe.contentWindow?.postMessage(response, this.iframeOrigin);
  }

  private async dispatch(req: DAppBridgeRequest): Promise<unknown> {
    switch (req.method) {
      // ── Wallet ──────────────────────────────────────────────────────
      case 'wallet.getBalance': {
        this.requirePermission('wallet.read');
        const res = await fetch(getApiUrl('/api/minima/status'));
        if (!res.ok) throw new Error('Failed to fetch wallet balance');
        return res.json();
      }

      case 'wallet.send': {
        this.requirePermission('wallet.send');
        const res = await fetch(getApiUrl('/api/minima/cmd'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: `send amount:${req.params.amount} address:${req.params.address}` }),
        });
        if (!res.ok) throw new Error('Transaction failed');
        return res.json();
      }

      // ── Minima RPC ─────────────────────────────────────────────────
      case 'minima.cmd': {
        this.requirePermission('minima.rpc');
        const res = await fetch(getApiUrl('/api/minima/cmd'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: req.params.command }),
        });
        if (!res.ok) throw new Error('Minima RPC failed');
        return res.json();
      }

      // ── Maxima ─────────────────────────────────────────────────────
      case 'maxima.getContacts': {
        this.requirePermission('maxima.read');
        const res = await fetch(getApiUrl('/api/maxima/contacts'));
        if (!res.ok) throw new Error('Failed to fetch contacts');
        return res.json();
      }

      case 'maxima.send': {
        this.requirePermission('maxima.send');
        const res = await fetch(getApiUrl('/api/maxima/send'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(req.params),
        });
        if (!res.ok) throw new Error('Maxima send failed');
        return res.json();
      }

      // ── Cluster ────────────────────────────────────────────────────
      case 'cluster.getState': {
        this.requirePermission('cluster.read');
        const res = await fetch(getApiUrl('/api/cluster/state'));
        if (!res.ok) throw new Error('Failed to fetch cluster state');
        return res.json();
      }

      // ── System ─────────────────────────────────────────────────────
      case 'system.getStats': {
        this.requirePermission('system.read');
        const res = await fetch(getApiUrl('/api/system-stats'));
        if (!res.ok) throw new Error('Failed to fetch system stats');
        return res.json();
      }

      // ── Notifications ──────────────────────────────────────────────
      case 'notify': {
        this.requirePermission('notifications');
        const title = String(req.params.title ?? 'DApp');
        const body = String(req.params.body ?? '');
        this.callbacks.onNotify?.(title, body);
        return { delivered: true };
      }

      // ── Files ───────────────────────────────────────────────────────
      case 'files.list': {
        this.requirePermission('files.read');
        const dirPath = String(req.params.path ?? '/');
        const res = await fetch(getApiUrl(`/api/files/list?path=${encodeURIComponent(dirPath)}`));
        if (!res.ok) throw new Error('Failed to list files');
        return res.json();
      }

      case 'files.read': {
        this.requirePermission('files.read');
        const filePath = String(req.params.path ?? '');
        const res = await fetch(getApiUrl(`/api/files/read?path=${encodeURIComponent(filePath)}`));
        if (!res.ok) throw new Error('Failed to read file');
        return res.json();
      }

      default:
        throw new Error(`Unknown bridge method: ${req.method}`);
    }
  }

  private requirePermission(perm: DAppPermission): void {
    if (!this.hasPermission(perm)) {
      throw new Error(`Permission denied: ${perm} — DApp "${this.manifest.name}" has not been granted this permission`);
    }
  }
}
