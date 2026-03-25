package main

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
	"github.com/pinetos/pinetos-v2/internal/agent"
	"github.com/pinetos/pinetos-v2/internal/ai"
	"github.com/pinetos/pinetos-v2/internal/storage"
)

var rootCmd = &cobra.Command{
	Use:   "pinet",
	Short: "PiNetOS - Decentralized Edge Cloud OS",
}

var clusterCmd = &cobra.Command{
	Use:   "cluster",
	Short: "Manage PiNet cluster",
}

var clusterInitCmd = &cobra.Command{
	Use:   "init",
	Short: "Initialize a new PiNet cluster",
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println("Initializing PiNet cluster...")
		agent.InitCluster()
	},
}

var clusterJoinCmd = &cobra.Command{
	Use:   "join [token]",
	Short: "Join an existing PiNet cluster",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Printf("Joining cluster with token: %s\n", args[0])
		agent.JoinCluster(args[0])
	},
}

var deployCmd = &cobra.Command{
	Use:   "deploy [service]",
	Short: "Deploy a service to the cluster",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Printf("Deploying service: %s\n", args[0])
		agent.DeployService(args[0])
	},
}

var storageCmd = &cobra.Command{
	Use:   "storage",
	Short: "Manage decentralized storage",
}

var storageUploadCmd = &cobra.Command{
	Use:   "upload [file]",
	Short: "Upload a file to IPFS",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Printf("Uploading file to IPFS: %s\n", args[0])
		storage.UploadFile(args[0])
	},
}

var aiCmd = &cobra.Command{
	Use:   "ai",
	Short: "Manage AI inference",
}

var aiRunCmd = &cobra.Command{
	Use:   "run [model]",
	Short: "Run an AI model",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Printf("Running AI model: %s\n", args[0])
		ai.RunModel(args[0])
	},
}

func init() {
	clusterCmd.AddCommand(clusterInitCmd, clusterJoinCmd)
	storageCmd.AddCommand(storageUploadCmd)
	aiCmd.AddCommand(aiRunCmd)
	
	rootCmd.AddCommand(clusterCmd, deployCmd, storageCmd, aiCmd)
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
