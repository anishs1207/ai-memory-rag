package main

import (
	"fmt"
	"strconv"
	"strings"
	"sync"
)

// Node represents a simulated host machine within the AgentOS cluster fleet.
type Node struct {
	ID                   string          `json:"id"`
	Name                 string          `json:"name"`
	Region               string          `json:"region"`
	HasGPU               bool            `json:"has_gpu"`
	TotalMemoryBytes     int64           `json:"total_memory_bytes"`
	MemoryAllocatedBytes int64           `json:"memory_allocated_bytes"`
	CPUUsagePercentage   float64         `json:"cpu_usage_percentage"` // Simulated dynamic load
	BaselineCPU          float64         `json:"baseline_cpu"`         // Baseline load when idle
	ActiveInstances      map[string]bool `json:"active_instances"`     // Set of instance IDs scheduled here
	nodeLock             sync.Mutex
}

// NodeManager handles registration, status querying, and placement scheduling across nodes.
type NodeManager struct {
	nodes    map[string]*Node
	nodeLock sync.RWMutex
}

// NewNodeManager initializes the cluster manager with three default seeded nodes.
func NewNodeManager() *NodeManager {
	manager := &NodeManager{
		nodes: make(map[string]*Node),
	}
	manager.seedDefaultNodes()
	return manager
}

func (nm *NodeManager) seedDefaultNodes() {
	// Node A: High load baseline in us-east-1 with GPU
	nm.nodes["node-a"] = &Node{
		ID:                   "node-a",
		Name:                 "Node-A (High Load)",
		Region:               "us-east-1",
		HasGPU:               true,
		TotalMemoryBytes:     34359738368, // 32 GiB
		MemoryAllocatedBytes: 0,
		BaselineCPU:          80.0,
		CPUUsagePercentage:   80.0,
		ActiveInstances:      make(map[string]bool),
	}

	// Node B: Low load baseline in us-east-1 with GPU
	nm.nodes["node-b"] = &Node{
		ID:                   "node-b",
		Name:                 "Node-B (Low Load)",
		Region:               "us-east-1",
		HasGPU:               true,
		TotalMemoryBytes:     34359738368, // 32 GiB
		MemoryAllocatedBytes: 0,
		BaselineCPU:          20.0,
		CPUUsagePercentage:   20.0,
		ActiveInstances:      make(map[string]bool),
	}

	// Node C: Low load baseline in us-west-2, CPU-only
	nm.nodes["node-c"] = &Node{
		ID:                   "node-c",
		Name:                 "Node-C (Edge)",
		Region:               "us-west-2",
		HasGPU:               false,
		TotalMemoryBytes:     17179869184, // 16 GiB
		MemoryAllocatedBytes: 0,
		BaselineCPU:          10.0,
		CPUUsagePercentage:   10.0,
		ActiveInstances:      make(map[string]bool),
	}
}

// GetNodes returns list of all nodes.
func (nm *NodeManager) GetNodes() []*Node {
	nm.nodeLock.RLock()
	defer nm.nodeLock.RUnlock()

	nodeList := make([]*Node, 0, len(nm.nodes))
	for _, node := range nm.nodes {
		nodeList = append(nodeList, node)
	}
	return nodeList
}

// ScheduleInstance determines the most suitable Node for a replica based on the placement policy.
func (nm *NodeManager) ScheduleInstance(manifest *AgentManifest) (string, error) {
	nm.nodeLock.RLock()
	defer nm.nodeLock.RUnlock()

	var selectedNode *Node
	var minimumCPULoad float64 = 101.0 // Higher than 100%

	for _, node := range nm.nodes {
		node.nodeLock.Lock()
		
		// 1. Filter by Region if specified
		if manifest.Placement != nil && manifest.Placement.Region != "" {
			if node.Region != manifest.Placement.Region {
				node.nodeLock.Unlock()
				continue
			}
		}

		// 2. Filter by GPU capability if requested
		if manifest.Placement != nil && manifest.Placement.GPU {
			if !node.HasGPU {
				node.nodeLock.Unlock()
				continue
			}
		}

		// 3. Filter by Memory requirements
		if manifest.Placement != nil && manifest.Placement.Memory != "" {
			requiredBytes, err := parseMemoryString(manifest.Placement.Memory)
			if err == nil {
				availableBytes := node.TotalMemoryBytes - node.MemoryAllocatedBytes
				if availableBytes < requiredBytes {
					node.nodeLock.Unlock()
					continue
				}
			}
		}

		// 4. Choose the node with the lowest current CPU load
		if node.CPUUsagePercentage < minimumCPULoad {
			minimumCPULoad = node.CPUUsagePercentage
			selectedNode = node
		}

		node.nodeLock.Unlock()
	}

	if selectedNode == nil {
		return "", fmt.Errorf("no nodes available satisfying placement policies for agent %s", manifest.Name)
	}

	return selectedNode.ID, nil
}

// AllocateResources assigns resources on the chosen node.
func (nm *NodeManager) AllocateResources(nodeID string, instanceID string, memoryRequirement string) {
	nm.nodeLock.Lock()
	node, exists := nm.nodes[nodeID]
	nm.nodeLock.Unlock()

	if !exists {
		return
	}

	node.nodeLock.Lock()
	defer node.nodeLock.Unlock()

	node.ActiveInstances[instanceID] = true

	// Simulate memory allocation
	bytesAllocated, err := parseMemoryString(memoryRequirement)
	if err == nil && bytesAllocated > 0 {
		node.MemoryAllocatedBytes += bytesAllocated
	} else {
		// Default memory consumption per replica (e.g. 512MiB)
		node.MemoryAllocatedBytes += 512 * 1024 * 1024
	}

	// Dynamic CPU load impact (e.g., +5% per running agent instance)
	node.CPUUsagePercentage = node.BaselineCPU + float64(len(node.ActiveInstances))*5.0
	if node.CPUUsagePercentage > 100.0 {
		node.CPUUsagePercentage = 100.0
	}
	fmt.Printf("[Scheduler Placement] Allocated instance %s on Node %s. CPU Load is now %.1f%%\n", instanceID, nodeID, node.CPUUsagePercentage)
}

// ReleaseResources frees up capacity when an instance stops.
func (nm *NodeManager) ReleaseResources(nodeID string, instanceID string) {
	nm.nodeLock.Lock()
	node, exists := nm.nodes[nodeID]
	nm.nodeLock.Unlock()

	if !exists {
		return
	}

	node.nodeLock.Lock()
	defer node.nodeLock.Unlock()

	if _, ok := node.ActiveInstances[instanceID]; ok {
		delete(node.ActiveInstances, instanceID)
		
		// For simplicity, release default allocation size
		node.MemoryAllocatedBytes -= 512 * 1024 * 1024
		if node.MemoryAllocatedBytes < 0 {
			node.MemoryAllocatedBytes = 0
		}

		node.CPUUsagePercentage = node.BaselineCPU + float64(len(node.ActiveInstances))*5.0
		if node.CPUUsagePercentage > 100.0 {
			node.CPUUsagePercentage = 100.0
		}
		if node.CPUUsagePercentage < node.BaselineCPU {
			node.CPUUsagePercentage = node.BaselineCPU
		}
		fmt.Printf("[Scheduler Placement] Released instance %s from Node %s. CPU Load is now %.1f%%\n", instanceID, nodeID, node.CPUUsagePercentage)
	}
}

// Helper to convert strings like "16Gi", "512Mi" to byte counts.
func parseMemoryString(memoryString string) (int64, error) {
	if memoryString == "" {
		return 0, nil
	}
	trimmed := strings.TrimSpace(memoryString)
	if strings.HasSuffix(trimmed, "Gi") {
		numStr := strings.TrimSuffix(trimmed, "Gi")
		val, err := strconv.ParseInt(numStr, 10, 64)
		if err != nil {
			return 0, err
		}
		return val * 1024 * 1024 * 1024, nil
	}
	if strings.HasSuffix(trimmed, "Mi") {
		numStr := strings.TrimSuffix(trimmed, "Mi")
		val, err := strconv.ParseInt(numStr, 10, 64)
		if err != nil {
			return 0, err
		}
		return val * 1024 * 1024, nil
	}
	// Raw byte fallback
	val, err := strconv.ParseInt(trimmed, 10, 64)
	return val, err
}
