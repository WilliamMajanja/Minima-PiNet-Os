/**
 * PiNet-OS DApp Type Definitions
 *
 * Supports two DApp categories:
 *  1. Next-gen TypeScript DApps — full-featured web apps that run in a
 *     sandboxed iframe and communicate with PiNet via a PostMessage bridge.
 *  2. Classic Minima MiniDapps — traditional HTML/JS MiniDapps served from
 *     a .mds.zip archive (the standard Minima format).
 */

// ─── DApp Manifest ───────────────────────────────────────────────────────────

/** The two kinds of DApp the platform supports. */
export type DAppKind = 'typescript' | 'minidapp';

/** Permissions a DApp may request from the PiNet bridge. */
export type DAppPermission =
  | 'wallet.read'
  | 'wallet.send'
  | 'minima.rpc'
  | 'maxima.send'
  | 'maxima.read'
  | 'cluster.read'
  | 'system.read'
  | 'files.read'
  | 'files.write'
  | 'notifications';

/**
 * The manifest every DApp must provide (or have auto-generated for
 * classic MiniDapps).
 */
export interface DAppManifest {
  /** Unique identifier, e.g. "com.example.my-dapp" */
  id: string;
  /** Human-readable name */
  name: string;
  /** Short description shown in the store / desktop */
  description: string;
  /** Semver version string */
  version: string;
  /** Author / publisher name */
  author: string;
  /** Categorisation */
  kind: DAppKind;
  /** URL to a square icon (data-uri, relative path, or absolute URL) */
  icon?: string;
  /** Hex colour used as accent, e.g. "#3B82F6" */
  color?: string;
  /**
   * Entry point relative to the DApp root.
   * For TypeScript DApps this is the bundled index.html.
   * For MiniDapps this is usually "index.html" inside the extracted archive.
   */
  entryPoint: string;
  /** Permissions the DApp requests */
  permissions: DAppPermission[];
  /** Optional homepage / repository link */
  homepage?: string;
  /** Minimum PiNet-OS version required */
  minPinetVersion?: string;
}

// ─── Installed DApp Record ───────────────────────────────────────────────────

export type DAppStatus = 'installed' | 'running' | 'stopped' | 'error';

/** Persisted record of an installed DApp. */
export interface InstalledDApp {
  manifest: DAppManifest;
  /** Absolute directory on disk where the DApp files are extracted */
  installPath: string;
  /** ISO-8601 timestamp of installation */
  installedAt: string;
  /** ISO-8601 timestamp of last update */
  updatedAt: string;
  /** Current lifecycle status */
  status: DAppStatus;
}

// ─── DApp Bridge Messages ────────────────────────────────────────────────────

/** Outgoing requests the DApp iframe sends to the host. */
export interface DAppBridgeRequest {
  type: 'pinet-bridge-request';
  /** Unique id so the host can correlate the response */
  requestId: string;
  /** Which API the DApp is calling */
  method:
    | 'wallet.getBalance'
    | 'wallet.send'
    | 'minima.cmd'
    | 'maxima.send'
    | 'maxima.getContacts'
    | 'cluster.getState'
    | 'system.getStats'
    | 'notify';
  /** Method-specific payload */
  params: Record<string, unknown>;
}

/** Responses the host sends back to the DApp iframe. */
export interface DAppBridgeResponse {
  type: 'pinet-bridge-response';
  requestId: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

/** Events the host pushes to the DApp iframe without a prior request. */
export interface DAppBridgeEvent {
  type: 'pinet-bridge-event';
  event:
    | 'block'
    | 'balance'
    | 'maxima.message'
    | 'cluster.update';
  data: unknown;
}

// ─── API Payloads ────────────────────────────────────────────────────────────

/** Body for POST /api/dapps/install */
export interface DAppInstallPayload {
  /** For TypeScript DApps: URL to a .tar.gz or .zip bundle */
  /** For MiniDapps: URL to a .mds.zip archive */
  url?: string;
  /** Alternatively the manifest can be supplied directly (sideload) */
  manifest?: DAppManifest;
}

/** Body for POST /api/dapps/:id/uninstall */
export type DAppUninstallPayload = Record<string, never>;

/** Response from GET /api/dapps */
export interface DAppListResponse {
  dapps: InstalledDApp[];
}
