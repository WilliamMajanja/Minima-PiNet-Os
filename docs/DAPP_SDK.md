# PiNet-OS DApp SDK

> **Create next-generation TypeScript DApps and integrate classic Minima MiniDapps into PiNet OS.**

PiNet OS supports two categories of decentralized applications (DApps):

| Category | Description | Archive Format |
|---|---|---|
| **TypeScript DApp** | Modern web apps built with TypeScript/Vue/Svelte/etc. (any static frontend stack) | `.zip` or `.tar.gz` |
| **Classic MiniDapp** | Traditional Minima MiniDapps | `.mds.zip` |

Both run inside a sandboxed `<iframe>` on the PiNet desktop and communicate with
the host OS via a **PostMessage bridge**.

---

## Quick Start — TypeScript DApp

### 1. Create Your DApp

```bash
mkdir my-dapp && cd my-dapp
npm init -y
npm install typescript vite --save-dev
```

Create `index.html` and your app entry point. Your DApp is a standard web app — use any framework you like.

### 2. Add a `dapp.json` Manifest

```json
{
  "id": "com.example.my-dapp",
  "name": "My Cool DApp",
  "description": "A demo DApp for PiNet OS",
  "version": "1.0.0",
  "author": "Your Name",
  "kind": "typescript",
  "entryPoint": "index.html",
  "icon": "icon.png",
  "color": "#3B82F6",
  "permissions": [
    "wallet.read",
    "minima.rpc",
    "notifications"
  ]
}
```

### 3. Build and Bundle

```bash
npm run build   # Produces a dist/ folder
cd dist && zip -r ../my-dapp.zip .
```

### 4. Install on PiNet OS

Open the **DApp Store** on the PiNet desktop and either:

- **Install from URL** — paste a URL to the `.zip` archive.
- **Sideload** — manually enter the manifest fields and the URL where the DApp is hosted.

---

## Manifest Reference

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | ✅ | Unique identifier (e.g. `com.example.my-dapp`). Alphanumerics, dots, hyphens. |
| `name` | `string` | ✅ | Human-readable name. |
| `description` | `string` | ✅ | Short description. |
| `version` | `string` | ✅ | Semver version (e.g. `1.0.0`). |
| `author` | `string` | ✅ | Author or publisher. |
| `kind` | `"typescript"` or `"minidapp"` | ✅ | DApp category. |
| `entryPoint` | `string` | ✅ | Relative path to the entry HTML file. |
| `icon` | `string` | | URL or data-URI for a square icon. |
| `color` | `string` | | Hex accent colour (e.g. `#3B82F6`). |
| `permissions` | `string[]` | ✅ | Permissions requested (see below). |
| `homepage` | `string` | | Repository or homepage URL. |
| `minPinetVersion` | `string` | | Minimum PiNet-OS version required. |

---

## Permissions

| Permission | Description |
|---|---|
| `wallet.read` | Read wallet balance and transaction history. |
| `wallet.send` | Send Minima tokens. |
| `minima.rpc` | Execute arbitrary Minima RPC commands. |
| `maxima.send` | Send messages via Maxima. |
| `maxima.read` | Read Maxima contacts and messages. |
| `cluster.read` | Read cluster state and node info. |
| `system.read` | Read system metrics (CPU, RAM, temp). |
| `files.read` | Read files from the file system. |
| `files.write` | Write files to the file system. |
| `notifications` | Show notifications on the PiNet desktop. |

---

## Bridge API

Your DApp communicates with PiNet OS via `window.postMessage()`.

### Sending a Request

```typescript
// Generate a unique request ID
const requestId = crypto.randomUUID();

// Send a request to the PiNet host
window.parent.postMessage({
  type: 'pinet-bridge-request',
  requestId,
  method: 'wallet.getBalance',
  params: {}
}, '*');
```

### Receiving a Response

```typescript
window.addEventListener('message', (event) => {
  const data = event.data;

  if (data.type === 'pinet-bridge-response') {
    if (data.requestId === requestId) {
      if (data.success) {
        console.log('Balance:', data.data);
      } else {
        console.error('Error:', data.error);
      }
    }
  }
});
```

### Available Bridge Methods

| Method | Params | Permission Required | Description |
|---|---|---|---|
| `wallet.getBalance` | `{}` | `wallet.read` | Get wallet balance and node status. |
| `wallet.send` | `{ address, amount }` | `wallet.send` | Send Minima tokens. |
| `minima.cmd` | `{ command }` | `minima.rpc` | Execute a Minima RPC command. |
| `maxima.getContacts` | `{}` | `maxima.read` | List Maxima contacts. |
| `maxima.send` | `{ to, application, data }` | `maxima.send` | Send a Maxima message. |
| `cluster.getState` | `{}` | `cluster.read` | Get the full cluster state. |
| `system.getStats` | `{}` | `system.read` | Get system metrics. |
| `notify` | `{ title, body }` | `notifications` | Show a notification. |

### Receiving Events (Push)

PiNet OS can push events to your DApp without a prior request:

```typescript
window.addEventListener('message', (event) => {
  const data = event.data;

  if (data.type === 'pinet-bridge-event') {
    switch (data.event) {
      case 'block':
        console.log('New block:', data.data);
        break;
      case 'balance':
        console.log('Balance updated:', data.data);
        break;
      case 'maxima.message':
        console.log('Maxima message received:', data.data);
        break;
      case 'cluster.update':
        console.log('Cluster state changed:', data.data);
        break;
    }
  }
});
```

---

## Helper Library

For convenience, you can include a small helper in your DApp:

```typescript
// pinet-sdk.ts — drop this into your DApp

export function callPiNet(
  method: string,
  params: Record<string, unknown> = {}
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();

    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (
        data?.type === 'pinet-bridge-response' &&
        data.requestId === requestId
      ) {
        window.removeEventListener('message', handler);
        if (data.success) resolve(data.data);
        else reject(new Error(data.error || 'Bridge call failed'));
      }
    };

    window.addEventListener('message', handler);

    window.parent.postMessage(
      {
        type: 'pinet-bridge-request',
        requestId,
        method,
        params,
      },
      '*'
    );

    // Timeout after 30 seconds
    setTimeout(() => {
      window.removeEventListener('message', handler);
      reject(new Error('Bridge call timed out'));
    }, 30_000);
  });
}

// Usage:
// const balance = await callPiNet('wallet.getBalance');
// await callPiNet('notify', { title: 'Hello', body: 'World' });
```

---

## Classic Minima MiniDapps

Classic Minima MiniDapps (`.mds.zip` archives) are also supported. They are extracted
and served by PiNet OS just like TypeScript DApps.

### Installing a Classic MiniDapp

1. Open the **DApp Store**.
2. Enter the URL to the `.mds.zip` file.
3. Click **Install**.

PiNet OS detects the `.mds.zip` extension and registers the DApp as a classic MiniDapp.

### MiniDapp Bridge Access

Classic MiniDapps can also use the PiNet bridge API via `window.parent.postMessage()`.
This gives MiniDapps access to cluster state, system metrics, and other PiNet-specific
features beyond what the standard Minima MDS provides.

---

## REST API Endpoints

The DApp platform exposes the following server endpoints:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/dapps` | List all installed DApps. |
| `GET` | `/api/dapps/:id` | Get a single DApp record. |
| `POST` | `/api/dapps/install` | Install a DApp (body: `{ url }` or `{ manifest, url }`). |
| `POST` | `/api/dapps/:id/uninstall` | Uninstall a DApp. |
| `GET` | `/api/dapps/:id/serve/*` | Serve static files from an installed DApp. |

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                PiNet OS Desktop                  │
│  ┌───────────┐  ┌───────────┐  ┌─────────────┐  │
│  │ Built-in  │  │ DApp      │  │ DApp Host   │  │
│  │ Apps      │  │ Store     │  │ Frame       │  │
│  └───────────┘  └───────────┘  └──────┬──────┘  │
│                                       │          │
│                          PostMessage Bridge      │
│                                       │          │
│  ┌────────────────────────────────────┴───────┐  │
│  │              DApp (iframe)                  │  │
│  │  ┌─────────────────────────────────────┐   │  │
│  │  │ TypeScript DApp / Classic MiniDapp  │   │  │
│  │  │ (sandboxed, isolated origin)        │   │  │
│  │  └─────────────────────────────────────┘   │  │
│  └────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
         │
    Express Server
         │
    ┌────┴────┐
    │ /api/   │  DApp CRUD, serving, Minima RPC,
    │ dapps   │  Maxima, Cluster, System
    └─────────┘
```

---

## Security

- DApps run in a sandboxed `<iframe>` with `sandbox="allow-scripts allow-forms allow-same-origin allow-popups"`.
- The PostMessage bridge enforces **permission checks** — DApps can only call methods they declared in their manifest.
- DApp files are served from a dedicated directory; path traversal is prevented server-side.
- DApp IDs are validated to only contain safe characters.
- **CPIP Security Provider**: DApp storage is encrypted at rest with CoffeeCipher v5 (AES-256-GCM). API requests pass through CPIP ITF Defense (probe blocking, IP blacklisting).
