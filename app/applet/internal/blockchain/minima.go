package blockchain

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

// DefaultRPCPort is the standard Minima RPC port for PiNet-OS
const DefaultRPCPort = 9001

// GetRPCURL returns the Minima RPC URL from environment or default
func GetRPCURL() string {
	if url := os.Getenv("PINET_MINIMA_RPC_URL"); url != "" {
		return url
	}
	return fmt.Sprintf("http://127.0.0.1:%d", DefaultRPCPort)
}

// VerifyWorkload verifies a workload on the Minima blockchain via txpowid
func VerifyWorkload(workloadID string) bool {
	rpcURL := GetRPCURL()
	fmt.Printf("Verifying workload %s on Minima blockchain (%s)...\n", workloadID, rpcURL)

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(fmt.Sprintf("%s/txpowinfo%%20txpowid:%s", rpcURL, workloadID))
	if err != nil {
		fmt.Printf("Failed to connect to Minima node: %v\n", err)
		return false
	}
	defer resp.Body.Close()
	io.ReadAll(resp.Body) // drain body

	if resp.StatusCode == 200 {
		fmt.Println("Workload verified successfully.")
		return true
	}

	fmt.Println("Workload verification failed.")
	return false
}
