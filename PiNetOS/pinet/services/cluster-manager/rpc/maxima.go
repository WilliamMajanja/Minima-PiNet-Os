package rpc

import (
	"encoding/json"
	"fmt"
	"log"
)

// MaximaClient handles Maxima P2P messaging via the Minima RPC interface
type MaximaClient struct {
	minima      *MinimaClient
	application string
}

// MaximaContact represents a Maxima network contact
type MaximaContact struct {
	ID             int    `json:"id"`
	PublicKey      string `json:"publickey"`
	CurrentAddress string `json:"currentaddress"`
	MyAddress      string `json:"myaddress"`
	LastSeen       int64  `json:"lastseen"`
	SameChain      bool   `json:"samechain"`
}

// MaximaInfo represents our own Maxima identity
type MaximaInfo struct {
	PublicKey string `json:"publickey"`
	Address   string `json:"address"`
	Name      string `json:"name"`
}

// MaximaMessage represents an incoming Maxima message
type MaximaMessage struct {
	From        string `json:"from"`
	To          string `json:"to"`
	Application string `json:"application"`
	Data        string `json:"data"`
	TimeMilli   int64  `json:"timemilli"`
	MsgID       string `json:"msgid"`
}

// NewMaximaClient creates a new Maxima messaging client
func NewMaximaClient(minima *MinimaClient, application string) *MaximaClient {
	return &MaximaClient{
		minima:      minima,
		application: application,
	}
}

// GetInfo retrieves this node's Maxima identity
func (c *MaximaClient) GetInfo() (*MaximaInfo, error) {
	result, err := c.minima.Call("maxima")
	if err != nil {
		return nil, err
	}

	if !result.Status {
		return nil, fmt.Errorf("maxima info failed: %s", result.Error)
	}

	var info MaximaInfo
	if err := json.Unmarshal(result.Response, &info); err != nil {
		return nil, fmt.Errorf("failed to parse maxima info: %w", err)
	}

	return &info, nil
}

// GetContacts retrieves the list of Maxima contacts
func (c *MaximaClient) GetContacts() ([]MaximaContact, error) {
	result, err := c.minima.Call("maxima action:contacts")
	if err != nil {
		return nil, err
	}

	if !result.Status {
		return nil, fmt.Errorf("maxima contacts failed: %s", result.Error)
	}

	var contacts []MaximaContact
	if err := json.Unmarshal(result.Response, &contacts); err != nil {
		return nil, fmt.Errorf("failed to parse contacts: %w", err)
	}

	return contacts, nil
}

// Send sends a message to a Maxima contact
func (c *MaximaClient) Send(to string, data interface{}) error {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal message: %w", err)
	}

	command := fmt.Sprintf("maxima action:send to:%s application:%s data:%s", to, c.application, string(jsonData))
	result, err := c.minima.Call(command)
	if err != nil {
		return fmt.Errorf("maxima send failed: %w", err)
	}

	if !result.Status {
		return fmt.Errorf("maxima send rejected: %s", result.Error)
	}

	truncated := to
	if len(to) > 16 {
		truncated = to[:16] + "..."
	}
	log.Printf("[Maxima] Message sent to %s (app: %s)", truncated, c.application)
	return nil
}

// Poll checks for incoming Maxima messages
func (c *MaximaClient) Poll() ([]MaximaMessage, error) {
	result, err := c.minima.Call("maxima action:poll")
	if err != nil {
		return nil, err
	}

	if !result.Status {
		return nil, nil // No messages is not an error
	}

	var messages []MaximaMessage
	if err := json.Unmarshal(result.Response, &messages); err != nil {
		return nil, fmt.Errorf("failed to parse messages: %w", err)
	}

	// Filter for our application
	var filtered []MaximaMessage
	for _, msg := range messages {
		if msg.Application == c.application {
			filtered = append(filtered, msg)
		}
	}

	return filtered, nil
}
