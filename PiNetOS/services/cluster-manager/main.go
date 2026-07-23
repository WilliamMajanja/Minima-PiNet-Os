package main

import (
	"fmt"
	"log"
	"net/http"
)

func main() {
	fmt.Println("PiNet Cluster Manager Starting...")
	
	http.HandleFunc("/status", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "Cluster Manager OK")
	})
	
	log.Fatal(http.ListenAndServe(":9090", nil))
}
