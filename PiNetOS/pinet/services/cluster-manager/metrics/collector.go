package metrics

import (
	"log"
	"os"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"
)

// NodeStats holds current system metrics
type NodeStats struct {
	CPU        float64 `json:"cpu"`
	RAM        float64 `json:"ram"`
	Temp       float64 `json:"temp"`
	Disk       float64 `json:"disk"`
	NetworkIn  float64 `json:"networkIn"`
	NetworkOut float64 `json:"networkOut"`
}

// Collector periodically gathers system metrics
type Collector struct {
	interval time.Duration
	stats    NodeStats
	mu       sync.RWMutex
	stopChan chan struct{}
}

// NewCollector creates a new metrics collector
func NewCollector(interval time.Duration) *Collector {
	return &Collector{
		interval: interval,
		stopChan: make(chan struct{}),
	}
}

// Start begins collecting metrics
func (c *Collector) Start() {
	ticker := time.NewTicker(c.interval)
	defer ticker.Stop()

	// Initial collection
	c.collect()

	for {
		select {
		case <-c.stopChan:
			return
		case <-ticker.C:
			c.collect()
		}
	}
}

// Stop halts the metrics collector
func (c *Collector) Stop() {
	close(c.stopChan)
}

// GetStats returns a snapshot of current metrics
func (c *Collector) GetStats() NodeStats {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.stats
}

func (c *Collector) collect() {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.stats.CPU = getCPUUsage()
	c.stats.RAM = getRAMUsage()
	c.stats.Temp = getCPUTemperature()
	c.stats.Disk = getDiskUsage()
}

func getCPUUsage() float64 {
	// Read from /proc/stat for real CPU usage
	data, err := os.ReadFile("/proc/stat")
	if err != nil {
		return 0
	}

	lines := strings.Split(string(data), "\n")
	if len(lines) == 0 {
		return 0
	}

	fields := strings.Fields(lines[0])
	if len(fields) < 5 {
		return 0
	}

	var total, idle float64
	for i := 1; i < len(fields); i++ {
		val, _ := strconv.ParseFloat(fields[i], 64)
		total += val
		if i == 4 {
			idle = val
		}
	}

	if total == 0 {
		return 0
	}

	return ((total - idle) / total) * 100
}

func getRAMUsage() float64 {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	// Try /proc/meminfo for system-wide
	data, err := os.ReadFile("/proc/meminfo")
	if err != nil {
		return float64(m.Alloc) / float64(m.Sys) * 100
	}

	var total, available float64
	for _, line := range strings.Split(string(data), "\n") {
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}
		val, _ := strconv.ParseFloat(fields[1], 64)
		switch fields[0] {
		case "MemTotal:":
			total = val
		case "MemAvailable:":
			available = val
		}
	}

	if total == 0 {
		return 0
	}

	return ((total - available) / total) * 100
}

func getCPUTemperature() float64 {
	// Read from Raspberry Pi thermal zone
	data, err := os.ReadFile("/sys/class/thermal/thermal_zone0/temp")
	if err != nil {
		return 0
	}

	tempStr := strings.TrimSpace(string(data))
	temp, err := strconv.ParseFloat(tempStr, 64)
	if err != nil {
		return 0
	}

	// Value is in millidegrees
	if temp > 1000 {
		temp /= 1000
	}

	return temp
}

func getDiskUsage() float64 {
	// Read from /proc/mounts and use syscall for disk usage
	data, err := os.ReadFile("/proc/mounts")
	if err != nil {
		return 0
	}

	// Find root filesystem
	for _, line := range strings.Split(string(data), "\n") {
		fields := strings.Fields(line)
		if len(fields) >= 2 && fields[1] == "/" {
			// Found root mount — return placeholder until syscall.Statfs is added
			// TODO: Implement with syscall.Statfs for real disk usage
			return 15.0
		}
	}

	return 0
}
