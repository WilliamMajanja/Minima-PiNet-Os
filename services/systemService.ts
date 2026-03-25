
import { ClusterNode, HatType, OSMode } from '../types';
import { ExceptionFilter } from '../utils/core';
import { getApiUrl } from '../utils/api';

export const systemService = {
  async scanSubnet(subnet: string, onProgress: (log: string) => void, maxRetries: number = 0): Promise<ClusterNode[]> {
    onProgress(`[ARP] Broadcasting on interface eth0 (${subnet}/24)`);
    
    try {
      const response = await fetch(getApiUrl(`/api/system/scan-subnet?subnet=${encodeURIComponent(subnet)}`));
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json() as { nodes: ClusterNode[] };
      
      onProgress(`[SCAN] Subnet traversal complete. Found ${data.nodes.length} active peers.`);
      return data.nodes;
    } catch (error) {
      ExceptionFilter.handle(error, 'systemService.scanSubnet');
      onProgress(`[ERROR] Subnet scan failed.`);
      return [];
    }
  },

  async executeHypervisorSwitch(targetOS: OSMode, nodeId?: string): Promise<void> {
    console.log(`[HV] Context Switch Initiated -> Target: ${targetOS} on ${nodeId || 'localhost'}`);
    try {
      const response = await fetch(getApiUrl('/api/system/switch-os'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetOS, nodeId })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      console.log(`[HV] Switch complete:`, result);
    } catch (error) {
      ExceptionFilter.handle(error, 'systemService.executeHypervisorSwitch');
      // Fallback to delay if network fails
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
};
