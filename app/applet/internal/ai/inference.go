package ai

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
)

type OllamaRequest struct {
	Model  string `json:"model"`
	Prompt string `json:"prompt"`
	Stream bool   `json:"stream"`
}

func RunModel(model string) {
	fmt.Printf("Starting AI inference worker for model: %s\n", model)
	
	reqBody := OllamaRequest{
		Model:  model,
		Prompt: "System check. Are you ready?",
		Stream: false,
	}
	
	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		fmt.Printf("Failed to marshal request: %v\n", err)
		return
	}
	
	resp, err := http.Post("http://localhost:11434/api/generate", "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		fmt.Printf("Failed to connect to Ollama: %v\n", err)
		return
	}
	defer resp.Body.Close()
	
	fmt.Println("Model inference executed successfully.")
}
