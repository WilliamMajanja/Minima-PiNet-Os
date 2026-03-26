package config

import (
	"os"
	"strconv"
	"time"
)

// Config holds the cluster manager configuration
type Config struct {
	NodeID             string
	Role               string // "master" or "worker"
	MasterAddress      string
	MinimaRPCURL       string
	RPCTimeout         time.Duration
	MaximaApplication  string
	APIPort            int
	HeartbeatInterval  time.Duration
	HeartbeatTimeout   time.Duration
	NodeOfflineTimeout time.Duration
	MetricsInterval    time.Duration
	ClusterID          string
}

// Load reads configuration from environment variables with defaults
func Load() *Config {
	return &Config{
		NodeID:             getEnv("PINET_NODE_ID", generateNodeID()),
		Role:               getEnv("PINET_ROLE", "worker"),
		MasterAddress:      getEnv("PINET_MASTER_ADDRESS", ""),
		MinimaRPCURL:       getEnv("PINET_MINIMA_RPC_URL", "http://127.0.0.1:9001"),
		RPCTimeout:         getDurationEnv("PINET_RPC_TIMEOUT", 5*time.Second),
		MaximaApplication:  getEnv("PINET_MAXIMA_APP", "pinet-cluster"),
		APIPort:            getIntEnv("PINET_CLUSTER_API_PORT", 9090),
		HeartbeatInterval:  getDurationEnv("PINET_HEARTBEAT_INTERVAL", 10*time.Second),
		HeartbeatTimeout:   getDurationEnv("PINET_HEARTBEAT_TIMEOUT", 30*time.Second),
		NodeOfflineTimeout: getDurationEnv("PINET_NODE_OFFLINE_TIMEOUT", 60*time.Second),
		MetricsInterval:    getDurationEnv("PINET_METRICS_INTERVAL", 5*time.Second),
		ClusterID:          getEnv("PINET_CLUSTER_ID", ""),
	}
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

func getIntEnv(key string, defaultVal int) int {
	if val := os.Getenv(key); val != "" {
		if i, err := strconv.Atoi(val); err == nil {
			return i
		}
	}
	return defaultVal
}

func getDurationEnv(key string, defaultVal time.Duration) time.Duration {
	if val := os.Getenv(key); val != "" {
		if d, err := time.ParseDuration(val); err == nil {
			return d
		}
	}
	return defaultVal
}

func generateNodeID() string {
	hostname, err := os.Hostname()
	if err != nil {
		hostname = "pinet-node"
	}
	return "pinet-" + hostname
}
