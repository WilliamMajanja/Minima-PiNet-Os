package main

import (
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/WilliamMajanja/Minima-PiNet-Os/PiNetOS/pinet/services/cluster-manager/api"
	"github.com/WilliamMajanja/Minima-PiNet-Os/PiNetOS/pinet/services/cluster-manager/cluster"
	"github.com/WilliamMajanja/Minima-PiNet-Os/PiNetOS/pinet/services/cluster-manager/config"
	"github.com/WilliamMajanja/Minima-PiNet-Os/PiNetOS/pinet/services/cluster-manager/metrics"
	"github.com/WilliamMajanja/Minima-PiNet-Os/PiNetOS/pinet/services/cluster-manager/rpc"
)

func main() {
	log.Println("╔══════════════════════════════════════════════╗")
	log.Println("║     PiNet-OS Cluster Manager v3.0.0          ║")
	log.Println("║     Enterprise Edge Infrastructure            ║")
	log.Println("╚══════════════════════════════════════════════╝")

	// Load configuration
	cfg := config.Load()
	log.Printf("[Config] NodeID=%s Role=%s MinimaRPC=%s", cfg.NodeID, cfg.Role, cfg.MinimaRPCURL)

	// Initialize Minima RPC client
	minimaClient := rpc.NewMinimaClient(cfg.MinimaRPCURL, cfg.RPCTimeout)
	log.Println("[Minima] RPC client initialized")

	// Initialize Maxima messaging client
	maximaClient := rpc.NewMaximaClient(minimaClient, cfg.MaximaApplication)
	log.Println("[Maxima] Messaging client initialized")

	// Initialize metrics collector
	metricsCollector := metrics.NewCollector(cfg.MetricsInterval)
	go metricsCollector.Start()
	log.Println("[Metrics] Collector started")

	// Initialize cluster state manager
	clusterMgr := cluster.NewManager(cfg, minimaClient, maximaClient, metricsCollector)
	go clusterMgr.Start()
	log.Println("[Cluster] State manager started")

	// Start local HTTP API for web desktop integration
	apiServer := api.NewServer(cfg.APIPort, clusterMgr, metricsCollector)
	go apiServer.Start()
	log.Printf("[API] Server listening on :%d", cfg.APIPort)

	// Wait for shutdown signal
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	sig := <-sigChan

	fmt.Printf("\n[Shutdown] Received signal: %v\n", sig)

	// Graceful shutdown
	clusterMgr.Stop()
	metricsCollector.Stop()
	apiServer.Stop()

	log.Println("[Shutdown] PiNet Cluster Manager stopped.")
}
