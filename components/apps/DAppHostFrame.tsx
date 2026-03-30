
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

  const src = dappService.getDappUrl(manifest.id);

  return (
    <div className="w-full h-full bg-white">
      <iframe
        ref={iframeRef}
        src={src}
        title={manifest.name}
        className="w-full h-full border-0"
        sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
};

export default DAppHostFrame;
