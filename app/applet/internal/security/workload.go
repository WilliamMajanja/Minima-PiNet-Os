package security

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
)

func SignWorkload(data string, privateKey string) string {
	// Simplified signing for demonstration
	hash := sha256.Sum256([]byte(data + privateKey))
	signature := hex.EncodeToString(hash[:])
	fmt.Printf("Workload signed: %s\n", signature)
	return signature
}

func VerifySignature(data string, signature string, publicKey string) bool {
	hash := sha256.Sum256([]byte(data + publicKey))
	expected := hex.EncodeToString(hash[:])
	return signature == expected
}
