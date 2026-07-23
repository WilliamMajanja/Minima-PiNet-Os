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

// MaximaContactsResponse represents the response from maxcontacts action:list
type MaximaContactsResponse struct {
	AllowAllContacts bool            `json:"allowallcontacts"`
	Contacts         []MaximaContact `json:"contacts"`
}

// MaximaContact represents a Maxima network contact
type MaximaContact struct {
	ID             int             `json:"id"`
	PublicKey      string          `json:"publickey"`
	CurrentAddress string          `json:"currentaddress"`
	MyAddress      string          `json:"myaddress"`
	LastSeen       int64           `json:"lastseen"`
	SameChain      bool            `json:"samechain"`
	ExtraData      json.RawMessage `json:"extradata,omitempty"`
}

// MaximaInfo represents our own Maxima identity
type MaximaInfo struct {
	PublicKey    string `json:"publickey"`
	MxPublicKey  string `json:"mxpublickey"`
	Address      string `json:"address"`
	Name         string `json:"name"`
	StaticMLS    bool   `json:"staticmls"`
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
// Uses the correct "maxcontacts action:list" command (not "maxima action:contacts")
func (c *MaximaClient) GetContacts() ([]MaximaContact, error) {
	result, err := c.minima.Call("maxcontacts action:list")
	if err != nil {
		return nil, err
	}

	if !result.Status {
		return nil, fmt.Errorf("maxcontacts failed: %s", result.Error)
	}

	var contactsResp MaximaContactsResponse
	if err := json.Unmarshal(result.Response, &contactsResp); err != nil {
		// Fallback: try parsing as a plain list for compatibility
		var contacts []MaximaContact
		if err2 := json.Unmarshal(result.Response, &contacts); err2 != nil {
			return nil, fmt.Errorf("failed to parse contacts: %w", err)
		}
		return contacts, nil
	}

	return contactsResp.Contacts, nil
}

// Send sends a message to a Maxima contact
// Uses base64 encoding for the data payload to avoid URL-encoding issues
func (c *MaximaClient) Send(to string, data interface{}) error {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return fmt.Errorf("failed to marshal message: %w", err)
	}

	// Base64-encode the JSON payload for safe URL embedding
	encoded := base64URLEncode(jsonData)
	command := fmt.Sprintf("maxima action:send to:%s application:%s data:base64:%s", to, c.application, encoded)
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
		return nil, nil
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