package cluster

import (
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/WilliamMajanja/Minima-PiNet-Os/PiNetOS/pinet/services/cluster-manager/config"
	"github.com/WilliamMajanja/Minima-PiNet-Os/PiNetOS/pinet/services/cluster-manager/metrics"
	"github.com/WilliamMajanja/Minima-PiNet-Os/PiNetOS/pinet/services/cluster-manager/rpc"
)

// NodeStatus represents the health state of a node
type NodeStatus string

const (
	StatusActive  NodeStatus = "active"
	StatusStale   NodeStatus = "stale"
	StatusOffline NodeStatus = "offline"
	StatusPending NodeStatus = "pending"
)

// NodeInfo represents a node in the cluster
type NodeInfo struct {
	NodeID         string            `json:"nodeId"`
	MaximaAddress  string            `json:"maximaAddress"`
	Hostname       string            `json:"hostname"`
	Role           string            `json:"role"`
	Status         NodeStatus        `json:"status"`
	LastHeartbeat  int64             `json:"lastHeartbeat"`
	JoinedAt       int64             `json:"joinedAt"`
	Metrics        metrics.NodeStats `json:"metrics"`
	Capabilities   []string          `json:"capabilities"`
	Version        string            `json:"version"`
}

// ClusterState represents the full cluster topology
type ClusterState struct {
	ClusterID     string     `json:"clusterId"`
	Version       int        `json:"version"`
	MasterNodeID  string     `json:"masterNodeId"`
	MasterAddress string     `json:"masterAddress"`
	Nodes         []NodeInfo `json:"nodes"`
	CreatedAt     int64      `json:"createdAt"`
	LastUpdated   int64      `json:"lastUpdated"`
}

// ClusterMessage is the envelope for all cluster protocol messages
type ClusterMessage struct {
	Type          string          `json:"type"`
	Sender        string          `json:"sender"`
	SenderAddress string          `json:"senderAddress"`
	Timestamp     int64           `json:"timestamp"`
	Nonce         string          `json:"nonce"`
	ClusterID     string          `json:"clusterId"`
	Payload       json.RawMessage `json:"payload"`
}

// Manager orchestrates cluster state and communication
type Manager struct {
	config    *config.Config
	minima    *rpc.MinimaClient
	maxima    *rpc.MaximaClient
	metrics   *metrics.Collector
	state     *ClusterState
	mu        sync.RWMutex
	stopChan  chan struct{}
	localAddr string
}

// NewManager creates a new cluster manager
func NewManager(cfg *config.Config, minima *rpc.MinimaClient, maxima *rpc.MaximaClient, mc *metrics.Collector) *Manager {
	return &Manager{
		config:   cfg,
		minima:   minima,
		maxima:   maxima,
		metrics:  mc,
		stopChan: make(chan struct{}),
	}
}

// Start begins the cluster manager event loops
func (m *Manager) Start() {
	// Get our Maxima address
	info, err := m.maxima.GetInfo()
	if err != nil {
		log.Printf("[Cluster] Warning: Could not get Maxima info: %v", err)
		m.localAddr = ""
	} else {
		m.localAddr = info.Address
		log.Printf("[Cluster] Local Maxima address: %s", m.localAddr[:min(32, len(m.localAddr))])
	}

	// Initialize cluster state
	if m.config.Role == "master" {
		m.initMasterState()
	}

	// Start event loops
	go m.heartbeatLoop()
	go m.messagePollLoop()

	if m.config.Role == "master" {
		go m.healthCheckLoop()
	}
}

// Stop gracefully shuts down the cluster manager
func (m *Manager) Stop() {
	close(m.stopChan)
	log.Println("[Cluster] Manager stopped")
}

// GetState returns a copy of the current cluster state
func (m *Manager) GetState() *ClusterState {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if m.state == nil {
		return nil
	}
	// Return a copy
	stateCopy := *m.state
	nodesCopy := make([]NodeInfo, len(m.state.Nodes))
	copy(nodesCopy, m.state.Nodes)
	stateCopy.Nodes = nodesCopy
	return &stateCopy
}

// ─── Internal ────────────────────────────────────────────────────────────────

func (m *Manager) initMasterState() {
	m.mu.Lock()
	defer m.mu.Unlock()

	clusterID := m.config.ClusterID
	if clusterID == "" {
		clusterID = fmt.Sprintf("cluster-%d", time.Now().UnixMilli())
	}

	m.state = &ClusterState{
		ClusterID:     clusterID,
		Version:       1,
		MasterNodeID:  m.config.NodeID,
		MasterAddress: m.localAddr,
		Nodes: []NodeInfo{{
			NodeID:        m.config.NodeID,
			MaximaAddress: m.localAddr,
			Hostname:      m.config.NodeID,
			Role:          "master",
			Status:        StatusActive,
			LastHeartbeat: time.Now().UnixMilli(),
			JoinedAt:      time.Now().UnixMilli(),
			Metrics:       m.metrics.GetStats(),
			Capabilities:  []string{},
			Version:       "3.0.0",
		}},
		CreatedAt:   time.Now().UnixMilli(),
		LastUpdated: time.Now().UnixMilli(),
	}

	log.Printf("[Cluster] Initialized as master: %s", clusterID)
}

func (m *Manager) heartbeatLoop() {
	ticker := time.NewTicker(m.config.HeartbeatInterval)
	defer ticker.Stop()

	for {
		select {
		case <-m.stopChan:
			return
		case <-ticker.C:
			m.sendHeartbeat()
		}
	}
}

func (m *Manager) sendHeartbeat() {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if m.state == nil {
		return
	}

	stats := m.metrics.GetStats()

	// Update own metrics in state
	for i := range m.state.Nodes {
		if m.state.Nodes[i].NodeID == m.config.NodeID {
			m.state.Nodes[i].LastHeartbeat = time.Now().UnixMilli()
			m.state.Nodes[i].Metrics = stats
			break
		}
	}

	log.Printf("[Heartbeat] CPU=%.1f%% RAM=%.1f%% Temp=%.1f°C", stats.CPU, stats.RAM, stats.Temp)
}

func (m *Manager) messagePollLoop() {
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-m.stopChan:
			return
		case <-ticker.C:
			m.pollMessages()
		}
	}
}

func (m *Manager) pollMessages() {
	messages, err := m.maxima.Poll()
	if err != nil {
		return
	}

	for _, msg := range messages {
		var clusterMsg ClusterMessage
		if err := json.Unmarshal([]byte(msg.Data), &clusterMsg); err != nil {
			log.Printf("[Cluster] Failed to parse message: %v", err)
			continue
		}

		m.handleMessage(&clusterMsg)
	}
}

func (m *Manager) handleMessage(msg *ClusterMessage) {
	switch msg.Type {
	case "CLUSTER_JOIN_REQUEST":
		m.handleJoinRequest(msg)
	case "CLUSTER_HEARTBEAT":
		m.handleHeartbeat(msg)
	case "NODE_DEREGISTER":
		m.handleDeregister(msg)
	default:
		log.Printf("[Cluster] Unknown message type: %s", msg.Type)
	}
}

func (m *Manager) handleJoinRequest(msg *ClusterMessage) {
	if m.config.Role != "master" || m.state == nil {
		return
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	var payload struct {
		NodeID       string   `json:"nodeId"`
		Hostname     string   `json:"hostname"`
		Version      string   `json:"version"`
		Capabilities []string `json:"capabilities"`
	}
	if err := json.Unmarshal(msg.Payload, &payload); err != nil {
		log.Printf("[Cluster] Failed to parse join request: %v", err)
		return
	}

	// Add the node
	newNode := NodeInfo{
		NodeID:        payload.NodeID,
		MaximaAddress: msg.SenderAddress,
		Hostname:      payload.Hostname,
		Role:          "worker",
		Status:        StatusActive,
		LastHeartbeat: time.Now().UnixMilli(),
		JoinedAt:      time.Now().UnixMilli(),
		Capabilities:  payload.Capabilities,
		Version:       payload.Version,
	}

	m.state.Nodes = append(m.state.Nodes, newNode)
	m.state.Version++
	m.state.LastUpdated = time.Now().UnixMilli()

	log.Printf("[Cluster] Node joined: %s (%s)", payload.NodeID, payload.Hostname)
}

func (m *Manager) handleHeartbeat(msg *ClusterMessage) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.state == nil {
		return
	}

	var payload struct {
		NodeID  string            `json:"nodeId"`
		Metrics metrics.NodeStats `json:"metrics"`
	}
	if err := json.Unmarshal(msg.Payload, &payload); err != nil {
		return
	}

	for i := range m.state.Nodes {
		if m.state.Nodes[i].NodeID == payload.NodeID {
			m.state.Nodes[i].LastHeartbeat = time.Now().UnixMilli()
			m.state.Nodes[i].Metrics = payload.Metrics
			m.state.Nodes[i].Status = StatusActive
			break
		}
	}
}

func (m *Manager) handleDeregister(msg *ClusterMessage) {
	if m.config.Role != "master" || m.state == nil {
		return
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	var payload struct {
		NodeID string `json:"nodeId"`
		Reason string `json:"reason"`
	}
	if err := json.Unmarshal(msg.Payload, &payload); err != nil {
		return
	}

	// Remove node
	filtered := make([]NodeInfo, 0, len(m.state.Nodes))
	for _, node := range m.state.Nodes {
		if node.NodeID != payload.NodeID {
			filtered = append(filtered, node)
		}
	}
	m.state.Nodes = filtered
	m.state.Version++
	m.state.LastUpdated = time.Now().UnixMilli()

	log.Printf("[Cluster] Node deregistered: %s (reason: %s)", payload.NodeID, payload.Reason)
}

func (m *Manager) healthCheckLoop() {
	ticker := time.NewTicker(m.config.HeartbeatInterval)
	defer ticker.Stop()

	for {
		select {
		case <-m.stopChan:
			return
		case <-ticker.C:
			m.checkNodeHealth()
		}
	}
}

func (m *Manager) checkNodeHealth() {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.state == nil {
		return
	}

	now := time.Now().UnixMilli()

	for i := range m.state.Nodes {
		if m.state.Nodes[i].NodeID == m.config.NodeID {
			continue
		}

		elapsed := time.Duration(now-m.state.Nodes[i].LastHeartbeat) * time.Millisecond

		if elapsed > m.config.NodeOfflineTimeout {
			if m.state.Nodes[i].Status != StatusOffline {
				m.state.Nodes[i].Status = StatusOffline
				log.Printf("[Health] Node %s is OFFLINE (no heartbeat for %v)", m.state.Nodes[i].NodeID, elapsed)
			}
		} else if elapsed > m.config.HeartbeatTimeout {
			if m.state.Nodes[i].Status != StatusStale {
				m.state.Nodes[i].Status = StatusStale
				log.Printf("[Health] Node %s is STALE (no heartbeat for %v)", m.state.Nodes[i].NodeID, elapsed)
			}
		}
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
