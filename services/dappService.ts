/**
 * DApp Service — frontend state management for installed DApps.
 *
 * Fetches the installed DApp list from the backend, exposes install / uninstall
 * actions, and provides a subscription mechanism so React components re-render
 * when the list changes.
 */

import type { DAppManifest, InstalledDApp } from '../types/dapp';
import { getApiUrl } from '../utils/api';
import { ExceptionFilter } from '../utils/core';

type DAppSubscriber = () => void;

class DAppService {
  private _dapps: InstalledDApp[] = [];
  private _subscribers: DAppSubscriber[] = [];
  private _polling: ReturnType<typeof setInterval> | null = null;

  /** Current list of installed DApps (readonly snapshot). */
  get dapps(): readonly InstalledDApp[] {
    return this._dapps;
  }

  /** Start polling the backend for the DApp list. */
  start(): void {
    this.fetchDapps();
    if (!this._polling) {
      this._polling = setInterval(() => this.fetchDapps(), 10_000);
    }
  }

  /** Stop polling. */
  stop(): void {
    if (this._polling) {
      clearInterval(this._polling);
      this._polling = null;
    }
  }

  /** Subscribe to changes — returns an unsubscribe function. */
  subscribe(fn: DAppSubscriber): () => void {
    this._subscribers.push(fn);
    return () => {
      this._subscribers = this._subscribers.filter(s => s !== fn);
    };
  }

  /** Fetch the DApp list from the server. */
  async fetchDapps(): Promise<void> {
    try {
      const res = await fetch(getApiUrl('/api/dapps'));
      if (!res.ok) throw new Error(`GET /api/dapps failed: ${res.status}`);
      const data = await res.json() as { dapps: InstalledDApp[] };
      this._dapps = data.dapps;
      this.notify();
    } catch (err) {
      ExceptionFilter.handle(err, 'DAppService.fetchDapps');
    }
  }

  /** Install a DApp from a URL (zip / tar.gz / mds.zip). */
  async installFromUrl(url: string): Promise<InstalledDApp | null> {
    try {
      const res = await fetch(getApiUrl('/api/dapps/install'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error || `Install failed: ${res.status}`);
      }
      const installed = await res.json() as InstalledDApp;
      await this.fetchDapps();
      return installed;
    } catch (err) {
      ExceptionFilter.handle(err, 'DAppService.installFromUrl');
      return null;
    }
  }

  /** Install a DApp by uploading a manifest directly (sideload). */
  async installFromManifest(manifest: DAppManifest, entryUrl: string): Promise<InstalledDApp | null> {
    try {
      const res = await fetch(getApiUrl('/api/dapps/install'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manifest, url: entryUrl }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error || `Install failed: ${res.status}`);
      }
      const installed = await res.json() as InstalledDApp;
      await this.fetchDapps();
      return installed;
    } catch (err) {
      ExceptionFilter.handle(err, 'DAppService.installFromManifest');
      return null;
    }
  }

  /** Uninstall a DApp by its manifest id. */
  async uninstall(dappId: string): Promise<boolean> {
    try {
      const res = await fetch(getApiUrl(`/api/dapps/${encodeURIComponent(dappId)}/uninstall`), {
        method: 'POST',
      });
      if (!res.ok) throw new Error(`Uninstall failed: ${res.status}`);
      await this.fetchDapps();
      return true;
    } catch (err) {
      ExceptionFilter.handle(err, 'DAppService.uninstall');
      return false;
    }
  }

  /** Get a single DApp by id. */
  getDapp(id: string): InstalledDApp | undefined {
    return this._dapps.find(d => d.manifest.id === id);
  }

  /** Get the URL to load a DApp in an iframe. */
  getDappUrl(dappId: string): string {
    const dapp = this.getDapp(dappId);
    const entryPoint = dapp?.manifest.entryPoint || 'index.html';
    return getApiUrl(`/api/dapps/${encodeURIComponent(dappId)}/serve/${entryPoint}`);
  }

  private notify(): void {
    for (const fn of this._subscribers) {
      try { fn(); } catch { /* subscriber errors are swallowed */ }
    }
  }
}

export const dappService = new DAppService();
export { DAppService };
