
import { ClusterNode } from '../types';

export const systemService = {
  async scanSubnet(subnet: string, onProgress: (log: string) => void, maxRetries: number = 2): Promise<ClusterNode[]> {
    let attempt = 0;
    
    while (attempt <= maxRetries) {
        attempt++;
        if (attempt > 1) {
             onProgress(`[NET] Packet loss detected. Retrying discovery (Attempt ${attempt}/${maxRetries + 1})...`);
             await new Promise(r => setTimeout(r, 1200));
        }

        const found: ClusterNode[] = [];
        const base = subnet.split('.').slice(0, 3).join('.');
        
        onProgress(`[ARP] Broadcasting on interface eth0 (${subnet}/24)`);
        await new Promise(r => setTimeout(r, 600));

        // Always find the local node (Gateway/Self)
        const localNode = { 
            ip: '10', 
            node: { 
                id: 'n1', 
                name: 'Pi-Alpha (NVMe Hub)', 
                hat: 'SSD_NVME', 
                metrics: { cpu: 12, ram: 2.1, temp: 45, iops: 12500 },
                status: 'online'
            }, 
            delay: 300 
        };
        
        // Simulate failure on first attempt if retries are enabled, to showcase the logic
        const shouldSimulateFailure = (maxRetries > 0 && attempt === 1);

        const scanSteps = [
            { ip: '1', status: 'Gateway', delay: 200 },
            localNode, // Always found
            // Only include peers if we are NOT simulating a failure
            // Nodes found in 'awaiting-os' state to represent PXE boot clients
            ...(shouldSimulateFailure ? [] : [
                { 
                    ip: '11', 
                    node: { 
                        id: 'n2', 
                        name: 'Pi-Beta (AI Hub)', 
                        hat: 'AI_NPU', 
                        metrics: { cpu: 1, ram: 0.2, temp: 32, npu: 0 },
                        status: 'awaiting-os' 
                    }, 
                    delay: 400 
                },
                { 
                    ip: '12', 
                    node: { 
                        id: 'n3', 
                        name: 'Pi-Gamma (Sense)', 
                        hat: 'SENSE', 
                        metrics: { cpu: 1, ram: 0.2, temp: 31, env: { temp: 0, humidity: 0, pressure: 0 } },
                        status: 'awaiting-os' 
                    }, 
                    delay: 300 
                }
            ]),
            { ip: '15', status: 'Unreachable', delay: 100 },
            { ip: '102', status: 'Unreachable', delay: 100 }
        ];

        for (const step of scanSteps) {
            const fullIp = `${base}.${step.ip}`;
            onProgress(`[ICMP] Pinging ${fullIp}...`);
            await new Promise(r => setTimeout(r, step.delay));
            
            if (step.node) {
                onProgress(`[ACK] Response from ${fullIp} [MAC: B8:27:EB:${Math.floor(Math.random()*99).toString(16).toUpperCase().padStart(2,'0')}:4F]`);
                await new Promise(r => setTimeout(r, 200));
                
                if (step.node.status === 'awaiting-os') {
                    onProgress(`[PXE] PXE Boot Request detected from ${step.node.name}`);
                } else {
                    onProgress(`[HSK] Handshake with Minima Protocol v1.0.35`);
                }
                
                found.push({ 
                    id: step.node.id, 
                    name: step.node.name, 
                    ip: fullIp, 
                    hat: step.node.hat as any, 
                    status: step.node.status as any, 
                    metrics: step.node.metrics 
                });
            }
        }
        
        // Success condition: Found more than just local node
        if (found.length > 1) {
            onProgress(`[SCAN] Subnet traversal complete. Found ${found.length} active peers.`);
            return found;
        } 
        
        onProgress(`[WARN] Scan incomplete. No other peers detected on ${subnet}.`);

        // If last attempt, return what we have (likely just local node)
        if (attempt > maxRetries) {
            onProgress(`[HINT] Check ethernet switch power or try rescanning.`);
            return found;
        }
    }
    return [];
  },

  async executeHypervisorSwitch(targetOS: 'pinet' | 'raspbian'): Promise<void> {
    // This mocks the low-level hypervisor call (e.g., Xen Dom0 command, kexec, or u-boot environment update + reboot)
    console.log(`[HV] Context Switch Initiated -> Target: ${targetOS}`);
    return new Promise(resolve => setTimeout(resolve, 5000));
  }
};
