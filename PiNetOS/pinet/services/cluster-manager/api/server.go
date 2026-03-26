package api

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"fmt"
	"time"

	"github.com/WilliamMajanja/Minima-PiNet-Os/PiNetOS/pinet/services/cluster-manager/cluster"
	"github.com/WilliamMajanja/Minima-PiNet-Os/PiNetOS/pinet/services/cluster-manager/metrics"
)

// Server provides a local HTTP API for the web desktop to query cluster state
type Server struct {
	port       int
	cluster    *cluster.Manager
	metrics    *metrics.Collector
	httpServer *http.Server
}

// NewServer creates a new API server
func NewServer(port int, clusterMgr *cluster.Manager, metricsCol *metrics.Collector) *Server {
	return &Server{
		port:    port,
		cluster: clusterMgr,
		metrics: metricsCol,
	}
}

// Start begins serving the HTTP API
func (s *Server) Start() {
	mux := http.NewServeMux()

	// CORS middleware
	handler := corsMiddleware(mux)

	// Routes
	mux.HandleFunc("/health", s.handleHealth)
	mux.HandleFunc("/cluster/state", s.handleClusterState)
	mux.HandleFunc("/cluster/nodes", s.handleClusterNodes)
	mux.HandleFunc("/metrics", s.handleMetrics)

	s.httpServer = &http.Server{
		Addr:    fmt.Sprintf(":%d", s.port),
		Handler: handler,
	}

	if err := s.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Printf("[API] Server error: %v", err)
	}
}

// Stop gracefully shuts down the API server
func (s *Server) Stop() {
	if s.httpServer != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		s.httpServer.Shutdown(ctx)
	}
}

// ─── Handlers ────────────────────────────────────────────────────────────────

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, map[string]interface{}{
		"status":  "ok",
		"service": "pinet-cluster-manager",
		"version": "3.0.0",
	})
}

func (s *Server) handleClusterState(w http.ResponseWriter, r *http.Request) {
	state := s.cluster.GetState()
	if state == nil {
		writeJSON(w, map[string]interface{}{
			"clusterId": "",
			"version":   0,
			"nodes":     []interface{}{},
			"message":   "No cluster initialized",
		})
		return
	}
	writeJSON(w, state)
}

func (s *Server) handleClusterNodes(w http.ResponseWriter, r *http.Request) {
	state := s.cluster.GetState()
	if state == nil {
		writeJSON(w, []interface{}{})
		return
	}
	writeJSON(w, state.Nodes)
}

func (s *Server) handleMetrics(w http.ResponseWriter, r *http.Request) {
	stats := s.metrics.GetStats()
	writeJSON(w, stats)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

func writeJSON(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}
