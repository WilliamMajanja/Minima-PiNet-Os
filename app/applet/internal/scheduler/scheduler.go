package scheduler

import (
	"fmt"
)

type NodeRole string

const (
	Controller NodeRole = "Controller"
	Compute    NodeRole = "Compute"
	Storage    NodeRole = "Storage"
	Gateway    NodeRole = "Gateway"
)

type Node struct {
	ID       string
	Role     NodeRole
	CPUUsage float64
	RAMUsage float64
}

type Workload struct {
	ID           string
	RequiredRole NodeRole
	Image        string
}

func Schedule(workload Workload, nodes []Node) error {
	fmt.Printf("Scheduling workload %s...\n", workload.ID)
	for _, node := range nodes {
		if node.Role == workload.RequiredRole && node.CPUUsage < 80.0 {
			fmt.Printf("Assigned workload %s to node %s\n", workload.ID, node.ID)
			return nil
		}
	}
	return fmt.Errorf("no suitable node found for workload %s", workload.ID)
}
