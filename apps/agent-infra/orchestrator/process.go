package orchestrator

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"sync"
	"time"
)

// InstanceStatus represents the lifecycle state of a running agent instance.
type InstanceStatus string

const (
	StatusSpawning   InstanceStatus = "SPAWNING"
	StatusHealthy    InstanceStatus = "HEALTHY"
	StatusUnhealthy  InstanceStatus = "UNHEALTHY"
	StatusTerminated InstanceStatus = "TERMINATED"
)

// AgentInstance represents a single running replica of an agent.
type AgentInstance struct {
	ID        string
	AgentName string
	Port      int
	NodeID    string         // Scheduled worker node ID
	Version   string         // Version of the running agent replica
	Status    InstanceStatus
	Cmd       *exec.Cmd
	LogBuffer *bytes.Buffer
	StartedAt time.Time
	UpdatedAt time.Time
	lock      sync.Mutex
}

// PortAllocator manages a thread-safe pool of available local ports.
type PortAllocator struct {
	startPort int
	endPort   int
	usedPorts map[int]bool
	lock      sync.Mutex
}

// NewPortAllocator creates a new port pool within the specified range.
func NewPortAllocator(startPort int, endPort int) *PortAllocator {
	return &PortAllocator{
		startPort: startPort,
		endPort:   endPort,
		usedPorts: make(map[int]bool),
	}
}

// Allocate reserves an available port from the pool.
func (pa *PortAllocator) Allocate() (int, error) {
	pa.lock.Lock()
	defer pa.lock.Unlock()

	for port := pa.startPort; port <= pa.endPort; port++ {
		if !pa.usedPorts[port] {
			// Check if the port is physically available at the OS level
			if isPortOSAvailable(port) {
				pa.usedPorts[port] = true
				return port, nil
			}
		}
	}
	return 0, fmt.Errorf("no available ports in the range %d-%d", pa.startPort, pa.endPort)
}

// isPortOSAvailable performs a brief TCP listen attempt to verify if a port is free on the host.
func isPortOSAvailable(port int) bool {
	listener, err := net.Listen("tcp", fmt.Sprintf(":%d", port))
	if err != nil {
		return false
	}
	listener.Close()
	return true
}

// Release returns a port back to the pool.
func (pa *PortAllocator) Release(port int) {
	pa.lock.Lock()
	defer pa.lock.Unlock()
	delete(pa.usedPorts, port)
}

// NewAgentInstance initializes a new representation of an agent replica.
func NewAgentInstance(id string, agentName string, port int) *AgentInstance {
	return &AgentInstance{
		ID:        id,
		AgentName: agentName,
		Port:      port,
		Status:    StatusSpawning,
		LogBuffer: new(bytes.Buffer),
		StartedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
}

// WriteLog appends data thread-safely to the instance's log buffer.
func (ai *AgentInstance) WriteLog(data []byte) {
	ai.lock.Lock()
	defer ai.lock.Unlock()
	ai.LogBuffer.Write(data)
}

// GetLogs retrieves the accumulated logs from the instance's console output.
func (ai *AgentInstance) GetLogs() string {
	ai.lock.Lock()
	defer ai.lock.Unlock()
	return ai.LogBuffer.String()
}

// Start launches the agent process, pipes its console output, and monitors its readiness.
func (ai *AgentInstance) Start(ctx context.Context, manifest *AgentManifest, portAllocator *PortAllocator, secretsManager *SecretsManager) error {
	ai.lock.Lock()
	ai.StartedAt = time.Now()
	ai.UpdatedAt = time.Now()
	ai.lock.Unlock()

	// Determine shell execution command depending on host operating system.
	var shellProgram string
	var shellArguments []string
	if runtime.GOOS == "windows" {
		shellProgram = "cmd"
		shellArguments = []string{"/C", manifest.Command}
	} else {
		shellProgram = "/bin/sh"
		shellArguments = []string{"-c", manifest.Command}
	}

	command := exec.CommandContext(ctx, shellProgram, shellArguments...)
	command.Dir = manifest.ResolvedDir

	// Setup environment variables, appending custom values, overriding PORT, and injecting secrets
	existingEnvironment := os.Environ()
	environmentOverrides := []string{
		fmt.Sprintf("PORT=%d", ai.Port),
		fmt.Sprintf("AGENT_VERSION=%s", ai.Version),
		fmt.Sprintf("NODE_ID=%s", ai.NodeID),
	}

	// 1. Inject custom env variables from manifest
	for _, envVariable := range manifest.Env {
		environmentOverrides = append(environmentOverrides, fmt.Sprintf("%s=%s", envVariable.Name, envVariable.Value))
	}

	// 2. Inject global secrets and namespace-specific secrets (which overwrite defaults)
	if secretsManager != nil {
		globalSecrets := secretsManager.GetSecrets("global")
		for key, val := range globalSecrets {
			environmentOverrides = append(environmentOverrides, fmt.Sprintf("%s=%s", key, val))
		}
		agentSecrets := secretsManager.GetSecrets(manifest.Name)
		for key, val := range agentSecrets {
			environmentOverrides = append(environmentOverrides, fmt.Sprintf("%s=%s", key, val))
		}
	}

	command.Env = append(existingEnvironment, environmentOverrides...)

	// Pipe output/error streams to our log buffer.
	stdoutPipe, err := command.StdoutPipe()
	if err != nil {
		return fmt.Errorf("failed to create stdout pipe: %w", err)
	}
	stderrPipe, err := command.StderrPipe()
	if err != nil {
		return fmt.Errorf("failed to create stderr pipe: %w", err)
	}

	ai.lock.Lock()
	ai.Cmd = command
	ai.lock.Unlock()

	fmt.Printf("[Orchestrator] Spawning agent %s (version %s) on Node %s (Port %d)...\n", ai.AgentName, ai.Version, ai.NodeID, ai.Port)
	if err := command.Start(); err != nil {
		portAllocator.Release(ai.Port)
		ai.lock.Lock()
		ai.Status = StatusTerminated
		ai.lock.Unlock()
		return fmt.Errorf("failed to start process: %w", err)
	}

	// Capture stdout and stderr in background goroutines.
	go ai.captureOutput(stdoutPipe)
	go ai.captureOutput(stderrPipe)

	// Start health checker loop to wait for readiness.
	go ai.checkReadiness(portAllocator)

	// Wait for process exit in a background goroutine to handle crashes/self-healing.
	go func() {
		err := command.Wait()
		portAllocator.Release(ai.Port)
		ai.lock.Lock()
		ai.Status = StatusTerminated
		ai.UpdatedAt = time.Now()
		ai.lock.Unlock()
		fmt.Printf("[Orchestrator] Process for agent %s (replica %s) exited. Error: %v\n", ai.AgentName, ai.ID, err)
	}()

	return nil
}

// captureOutput reads from the pipe and writes to the console and log buffer.
func (ai *AgentInstance) captureOutput(pipe io.ReadCloser) {
	defer pipe.Close()
	buffer := make([]byte, 1024)
	for {
		bytesRead, err := pipe.Read(buffer)
		if bytesRead > 0 {
			ai.WriteLog(buffer[:bytesRead])
			// Print to orchestrator stdout with a prefix
			fmt.Printf("[%s-replica-%s] %s", ai.AgentName, ai.ID[:8], string(buffer[:bytesRead]))
		}
		if err != nil {
			break
		}
	}
}

// checkReadiness polls the agent's `/health` endpoint until it succeeds or times out.
func (ai *AgentInstance) checkReadiness(portAllocator *PortAllocator) {
	healthCheckURL := fmt.Sprintf("http://localhost:%d/health", ai.Port)
	timeoutDuration := 20 * time.Second
	pollInterval := 500 * time.Millisecond
	deadline := time.Now().Add(timeoutDuration)

	httpClient := &http.Client{Timeout: 1 * time.Second}

	for time.Now().Before(deadline) {
		ai.lock.Lock()
		if ai.Status == StatusTerminated {
			ai.lock.Unlock()
			return
		}
		ai.lock.Unlock()

		response, err := httpClient.Get(healthCheckURL)
		if err == nil {
			response.Body.Close()
			if response.StatusCode == http.StatusOK {
				ai.lock.Lock()
				ai.Status = StatusHealthy
				ai.UpdatedAt = time.Now()
				ai.lock.Unlock()
				fmt.Printf("[Orchestrator] Agent %s (replica %s) is HEALTHY on port %d\n", ai.AgentName, ai.ID, ai.Port)
				return
			}
		}

		time.Sleep(pollInterval)
	}

	// If timeout is reached and not healthy
	ai.lock.Lock()
	if ai.Status != StatusTerminated {
		ai.Status = StatusUnhealthy
		ai.UpdatedAt = time.Now()
		ai.lock.Unlock()
		fmt.Printf("[Orchestrator] Health check timed out for agent %s (replica %s) on port %d. Terminating...\n", ai.AgentName, ai.ID, ai.Port)
		ai.Stop()
	} else {
		ai.lock.Unlock()
	}
}

// Stop terminates the agent process and handles OS-specific cleanup (e.g. killing child process trees on Windows).
func (ai *AgentInstance) Stop() {
	ai.lock.Lock()
	defer ai.lock.Unlock()

	if ai.Status == StatusTerminated {
		return
	}

	ai.Status = StatusTerminated
	ai.UpdatedAt = time.Now()

	if ai.Cmd != nil && ai.Cmd.Process != nil {
		if runtime.GOOS == "windows" {
			// On Windows, killing cmd.exe directly orphans the spawned node process.
			// We must forcefully terminate the process tree using taskkill.
			cmd := exec.Command("taskkill", "/F", "/T", "/PID", fmt.Sprintf("%d", ai.Cmd.Process.Pid))
			_ = cmd.Run()
		} else {
			_ = ai.Cmd.Process.Kill()
		}
	}
}

// Restart halts the current execution and respawns the process.
func (ai *AgentInstance) Restart(ctx context.Context, manifest *AgentManifest, portAllocator *PortAllocator, secretsManager *SecretsManager) error {
	ai.Stop()
	time.Sleep(500 * time.Millisecond) // Allow ports to clean up

	ai.lock.Lock()
	ai.Status = StatusSpawning
	ai.lock.Unlock()

	return ai.Start(ctx, manifest, portAllocator, secretsManager)
}

