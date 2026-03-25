package agent

import (
	"context"
	"fmt"
	"log"

	"github.com/pinetos/pinetos-v2/internal/discovery"
	"github.com/pinetos/pinetos-v2/internal/rpic"
)

func InitCluster() {
	fmt.Println("Initializing PiNetOS Cluster Master Node...")
	ctx := context.Background()
	
	// Setup libp2p discovery
	host, peerChan, err := discovery.SetupDiscovery(ctx, 4001)
	if err != nil {
		log.Fatalf("Failed to setup discovery: %v", err)
	}
	defer host.Close()

	// Initialize Raspberry Pi Connect for remote management
	rpic.InitConnect()

	fmt.Println("Cluster initialized. Waiting for nodes...")
	for peer := range peerChan {
		fmt.Printf("Discovered new node: %s\n", peer.ID.String())
	}
}

func JoinCluster(token string) {
	fmt.Printf("Joining cluster with token %s...\n", token)
	ctx := context.Background()
	
	host, peerChan, err := discovery.SetupDiscovery(ctx, 4002)
	if err != nil {
		log.Fatalf("Failed to setup discovery: %v", err)
	}
	defer host.Close()

	rpic.InitConnect()

	fmt.Println("Searching for master node...")
	for peer := range peerChan {
		fmt.Printf("Found peer: %s. Attempting to join...\n", peer.ID.String())
		// Logic to authenticate and join
	}
}

func DeployService(service string) {
	fmt.Printf("Deploying service %s via scheduler...\n", service)
	// Call scheduler
}
