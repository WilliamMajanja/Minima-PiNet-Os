
import React, { useState, useEffect } from 'react';
import { ClusterNode } from '../../types';

interface SetupWizardProps {
  onComplete: (nodes: ClusterNode[]) => void;
}

const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [nodesFound, setNodesFound] = useState<ClusterNode[]>([
      { id: 'n1', name: 'Pi-Alpha (Local)', ip: '127.0.0.1', hat: 'SSD_NVME', status: 'online', metrics: { cpu: 12, ram: 2.1, temp: 45, iops: 12500 } }
  ]);

  const steps = [
    {
      title: "Welcome to PiNet Web3 OS",
      description: "The official Web3 distribution for Raspberry Pi by Minima. We'll help you configure your decentralized node.",
      icon: "🚀"
    },
    {
      title: "Initializing Minima Protocol",
      description: "Connecting to the global Minima network. Your node will be part of a purely decentralized ecosystem.",
      icon: "🌐"
    },
    {
      title: "Network Discovery",
      description: `Scanning local subnet for Raspberry Pi peers.`,
      icon: "📡"
    },
    {
      title: "Cluster Configuration",
      description: `Configuring ${nodesFound.length} Detected Node${nodesFound.length > 1 ? 's' : ''}. Assigning roles based on hardware Hats (NVMe, NPU, Sense).`,
      icon: "🔌"
    },
    {
      title: "Agentic Payments (M.402)",
      description: "Setting up the M.402 payment stream system for autonomous resource management.",
      icon: "💎"
    }
  ];

  // Simulated peer discovery
  const scanForPeers = () => {
      setLoading(true);
      setProgress(0);
      const interval = setInterval(() => {
        setProgress(p => {
          if (p >= 100) {
            clearInterval(interval);
            setLoading(false);
            // Simulate finding 2 more nodes
            setNodesFound([
                { id: 'n1', name: 'Pi-Alpha (NVMe Hub)', ip: '192.168.1.10', hat: 'SSD_NVME', status: 'online', metrics: { cpu: 12, ram: 2.1, temp: 45, iops: 12500 } },
                { id: 'n2', name: 'Pi-Beta (AI Hub)', ip: '192.168.1.11', hat: 'AI_NPU', status: 'online', metrics: { cpu: 8, ram: 1.4, temp: 42, npu: 15 } },
                { id: 'n3', name: 'Pi-Gamma (Sense)', ip: '192.168.1.12', hat: 'SENSE', status: 'online', metrics: { cpu: 15, ram: 3.2, temp: 48, env: { temp: 22.4, humidity: 45, pressure: 1012 } } },
            ]);
            return 100;
          }
          return p + 5;
        });
      }, 30);
  };

  const nextStep = () => {
    if (step === 2 && nodesFound.length === 1 && !loading) {
       // Allow user to choose to scan or proceed
       setStep(step + 1);
       return;
    }

    if (step < steps.length - 1) {
      setLoading(true);
      setProgress(0);
      const interval = setInterval(() => {
        setProgress(p => {
          if (p >= 100) {
            clearInterval(interval);
            setLoading(false);
            setStep(step + 1);
            return 100;
          }
          return p + 4; // speed
        });
      }, 40);
    } else {
      onComplete(nodesFound);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex items-center justify-center p-6 overflow-hidden">
      <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_50%_50%,rgba(197,26,74,0.15),rgba(0,0,0,0))]" />
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
      
      <div className="max-w-xl w-full glass-dark rounded-[2.5rem] border border-white/10 p-12 relative z-10 shadow-2xl flex flex-col gap-8 text-center">
        <div className="flex justify-center">
          <div className="w-24 h-24 rounded-3xl bg-[#C51A4A] flex items-center justify-center text-5xl shadow-2xl shadow-pink-500/20 animate-bounce">
            {steps[step].icon}
          </div>
        </div>

        <div className="space-y-4">
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase italic">{steps[step].title}</h1>
          <p className="text-slate-400 text-lg font-medium leading-relaxed">
            {step === 2 && nodesFound.length === 1 && !loading ? "We found 1 device (Local Host). Do you want to scan for cluster peers?" : steps[step].description}
          </p>
          {step === 2 && nodesFound.length > 1 && (
              <p className="text-emerald-400 font-bold animate-pulse">Successfully detected full cluster topology!</p>
          )}
        </div>

        {step === 2 && !loading ? (
             <div className="pt-6 flex gap-4 justify-center">
                {nodesFound.length === 1 && (
                    <button 
                        onClick={scanForPeers}
                        className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-md font-bold uppercase tracking-widest shadow-xl transition-all hover:scale-105 active:scale-95"
                    >
                        Scan Subnet
                    </button>
                )}
                <button 
                    onClick={() => setStep(step + 1)}
                    className="px-8 py-4 bg-pink-600 hover:bg-pink-500 text-white rounded-2xl text-md font-bold uppercase tracking-widest shadow-xl shadow-pink-900/40 transition-all hover:scale-105 active:scale-95"
                >
                    {nodesFound.length === 1 ? "Use Single Node" : "Continue"}
                </button>
             </div>
        ) : loading ? (
          <div className="space-y-4">
            <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/10">
              <div className="h-full bg-pink-600 transition-all duration-100" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-[10px] font-bold text-pink-500 uppercase tracking-[0.3em]">
                {step === 2 ? "Probing Network..." : "Deploying OS Components..."}
            </p>
          </div>
        ) : (
          <div className="pt-6">
            <button 
              onClick={nextStep}
              className="px-10 py-5 bg-pink-600 hover:bg-pink-500 text-white rounded-2xl text-lg font-black uppercase tracking-widest shadow-xl shadow-pink-900/40 transition-all hover:scale-105 active:scale-95"
            >
              {step === steps.length - 1 ? "Launch OS" : "Continue"}
            </button>
          </div>
        )}

        {/* Steps Indicator */}
        <div className="mt-8 flex justify-center gap-2">
            {steps.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i === step ? 'w-8 bg-pink-500' : 'w-2 bg-white/10'}`} />
            ))}
        </div>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          <svg className="w-4 h-4 text-[#C51A4A]" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z"/></svg>
          PiNet Web3 OS Core
        </div>
      </div>
    </div>
  );
};

export default SetupWizard;
