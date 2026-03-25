package rpic

import (
	"fmt"
	"os/exec"
)

// InitConnect initializes Raspberry Pi Connect for remote management and hypervisor orchestration
func InitConnect() {
	fmt.Println("Initializing Raspberry Pi Connect (rpi-connect)...")
	
	// Check if rpi-connect is installed
	cmd := exec.Command("rpi-connect", "status")
	err := cmd.Run()
	if err != nil {
		fmt.Println("rpi-connect not found or not running. Please ensure it is installed and enabled.")
		fmt.Println("Run: systemctl --user start rpi-connect")
		return
	}
	
	fmt.Println("Raspberry Pi Connect is active. Cluster orchestration via remote hypervisor enabled.")
}
