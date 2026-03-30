
import React, { useEffect, useRef } from 'react';
import type { DAppManifest } from '../../types/dapp';
import { DAppBridge } from '../../services/dappBridge';
import { dappService } from '../../services/dappService';

interface DAppHostFrameProps {
  manifest: DAppManifest;
}

/**
 * DAppHostFrame — renders an installed DApp inside a sandboxed iframe
 * and sets up the PostMessage bridge so the DApp can call PiNet APIs.
 *
 * React Dashboard DApps receive relaxed sandbox settings (allow-same-origin)
 * so that they can use their own routing and state management.
 */
const DAppHostFrame: React.FC<DAppHostFrameProps> = ({ manifest }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bridgeRef = useRef<DAppBridge | null>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const bridge = new DAppBridge(iframe, manifest, {
      onNotify: (title, body) => {
        // Simple notification — a future enhancement could use a toast system
        console.log(`[DApp ${manifest.name}] ${title}: ${body}`);
      },
    });
    bridgeRef.current = bridge;

    return () => {
      bridge.destroy();
      bridgeRef.current = null;
    };
  }, [manifest]);

  const src = manifest.kind === 'react-dashboard'
    ? manifest.entryPoint   // React dashboards use their entry point URL directly
    : dappService.getDappUrl(manifest.id);

  // React dashboards and TypeScript DApps need allow-same-origin for proper SPA routing
  const sandboxFlags = manifest.kind === 'react-dashboard'
    ? 'allow-scripts allow-forms allow-popups allow-same-origin allow-modals'
    : manifest.kind === 'minidapp'
      ? 'allow-scripts allow-forms allow-popups allow-same-origin'
      : 'allow-scripts allow-forms allow-popups allow-same-origin';

  return (
    <div className="w-full h-full bg-white">
      <iframe
        ref={iframeRef}
        src={src}
        title={manifest.name}
        className="w-full h-full border-0"
        sandbox={sandboxFlags}
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
};

export default DAppHostFrame;
