package blockchain

import (
	"fmt"
	"net/http"
)

func VerifyWorkload(workloadID string) bool {
	fmt.Printf("Verifying workload %s on Minima blockchain...\n", workloadID)
	
	// Call Minima node RPC
	resp, err := http.Get(fmt.Sprintf("http://127.0.0.1:9002/txpowinfo?txpowid=%s", workloadID))
	if err != nil {
		fmt.Printf("Failed to connect to Minima node: %v\n", err)
		return false
	}
	defer resp.Body.Close()
	
	if resp.StatusCode == 200 {
		fmt.Println("Workload verified successfully.")
		return true
	}
	
	fmt.Println("Workload verification failed.")
	return false
}
