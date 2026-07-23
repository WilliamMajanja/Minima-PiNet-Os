package rpc

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

// MinimaClient handles communication with the local Minima node via RPC
//
// Port layout: P2P=base (default 9001), MDS-file=base+2, MDS-cmd=base+3, RPC=base+4
// This client connects to the RPC port (default 9005) for all command communication.
type MinimaClient struct {
	BaseURL    string
	HTTPClient *http.Client
}

// MinimaResponse is the generic response from Minima RPC
type MinimaResponse struct {
	Status   bool            `json:"status"`
	Response json.RawMessage `json:"response,omitempty"`
	Error    string          `json:"error,omitempty"`
}

// MinimaStatus represents the Minima node status
type MinimaStatus struct {
	Chain struct {
		Block      int    `json:"block"`
		Time       string `json:"time"`
		Hash       string `json:"hash"`
		Speed      string `json:"speed"`
		Difficulty string `json:"difficulty"`
		Weight     int    `json:"weight"`
		Length     int    `json:"length"`
		Tip        string `json:"tip"`
	} `json:"chain"`
	Network struct {
		Connected  int    `json:"connected"`
		Connecting int    `json:"connecting"`
		Host       string `json:"host"`
		P2P        string `json:"p2p"`
		RPC        string `json:"rpc"`
	} `json:"network"`
	Node struct {
		Version string `json:"version"`
		Uptime  string `json:"uptime"`
	} `json:"node"`
	Version string `json:"version"`
	Uptime  string `json:"uptime"`
}

// NewMinimaClient creates a new Minima RPC client
func NewMinimaClient(baseURL string, timeout time.Duration) *MinimaClient {
	return &MinimaClient{
		BaseURL: baseURL,
		HTTPClient: &http.Client{
			Timeout: timeout,
		},
	}
}

// Call executes an arbitrary Minima command
func (c *MinimaClient) Call(command string) (*MinimaResponse, error) {
	reqURL := fmt.Sprintf("%s/%s", c.BaseURL, url.PathEscape(command))

	resp, err := c.HTTPClient.Get(reqURL)
	if err != nil {
		return nil, fmt.Errorf("minima RPC call failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var result MinimaResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &result, nil
}

// Status returns the current Minima node status
func (c *MinimaClient) Status() (*MinimaStatus, error) {
	result, err := c.Call("status")
	if err != nil {
		return nil, err
	}

	if !result.Status {
		return nil, fmt.Errorf("status call failed: %s", result.Error)
	}

	var status MinimaStatus
	if err := json.Unmarshal(result.Response, &status); err != nil {
		return nil, fmt.Errorf("failed to parse status: %w", err)
	}

	return &status, nil
}

// Burn creates a burn transaction with base64-encoded metadata
func (c *MinimaClient) Burn(amount string, data map[string]interface{}) (*MinimaResponse, error) {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal data: %w", err)
	}
	encoded := base64URLEncode(jsonData)
	command := fmt.Sprintf("burn amount:%s data:base64:%s", amount, encoded)
	return c.Call(command)
}

// HealthCheck returns true if the Minima node is reachable
func (c *MinimaClient) HealthCheck() bool {
	_, err := c.Status()
	return err == nil
}

// VerifyWorkload verifies a workload by txpowid
func (c *MinimaClient) VerifyWorkload(workloadID string) bool {
	result, err := c.Call(fmt.Sprintf("txpowinfo txpowid:%s", workloadID))
	if err != nil {
		return false
	}
	return result.Status
}

// Peers returns the list of connected peers
func (c *MinimaClient) Peers() (*MinimaResponse, error) {
	return c.Call("peers")
}

// Network returns the network status
func (c *MinimaClient) Network() (*MinimaResponse, error) {
	return c.Call("network")
}

// NewAddress generates a new wallet address
func (c *MinimaClient) NewAddress() (*MinimaResponse, error) {
	return c.Call("newaddress")
}

// Balance returns the token balance list
func (c *MinimaClient) Balance() (*MinimaResponse, error) {
	return c.Call("balance")
}

// base64URLEncode encodes bytes to a URL-safe base64 string
func base64URLEncode(data []byte) string {
	return url.QueryEscape(string(data))
}