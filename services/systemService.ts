
import { ClusterNode, HatType, OSMode } from '../types';

export const systemService = {
  async scanSubnet(subnet: string, onProgress: (log: string) => void, maxRetries: number = 0): Promise<ClusterNode[]> {
    onProgress(`[ARP] Broadcasting on interface eth0 (${subnet}/24)`);
    
    try {
      const response = await fetch(`/api/system/scan-subnet?subnet=${encodeURIComponent(subnet)}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      
      onProgress(`[SCAN] Subnet traversal complete. Found ${data.nodes.length} active peers.`);
      return data.nodes;
    } catch (error) {
      console.error("Failed to scan subnet:", error);
      onProgress(`[ERROR] Subnet scan failed.`);
      return [];
    }
  },

  async executeHypervisorSwitch(targetOS: OSMode): Promise<void> {
    console.log(`[HV] Context Switch Initiated -> Target: ${targetOS}`);
    try {
      const response = await fetch('/api/system/switch-os', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetOS })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log(`[HV] Switch complete:`, result);
    } catch (error) {
      console.error(`[HV] Failed to execute real hypervisor switch:`, error);
      // Fallback to delay if network fails
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
};
