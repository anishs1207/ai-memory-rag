package main

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
)

// AgentDeployment manages the deployment state and operational statistics for an agent type.
type AgentDeployment struct {
	Manifest        *AgentManifest
	DesiredReplicas int
	Instances       []*AgentInstance
	PastInstances   []*AgentInstance // Sliding window of the last 5 terminated instances for post-mortem log retrieval
	LastTrafficTime time.Time
	lock            sync.RWMutex
}

// Scheduler handles the lifecycle, scaling, and reconciliation of all agent deployments.
type Scheduler struct {
	deployments   map[string]*AgentDeployment
	portAllocator *PortAllocator
	lock          sync.RWMutex
}

// NewScheduler creates a new scheduler instance associated with a port pool.
func NewScheduler(portAllocator *PortAllocator) *Scheduler {
	return &Scheduler{
		deployments:   make(map[string]*AgentDeployment),
		portAllocator: portAllocator,
	}
}

// Deploy registers or updates an agent deployment and immediately reconciles it.
func (s *Scheduler) Deploy(manifest *AgentManifest) error {
	s.lock.Lock()
	existingDeployment, ok := s.deployments[manifest.Name]
	if ok {
		// Update manifest and desired replicas
		existingDeployment.lock.Lock()
		existingDeployment.Manifest = manifest
		existingDeployment.DesiredReplicas = manifest.Replicas
		existingDeployment.LastTrafficTime = time.Now()
		existingDeployment.lock.Unlock()
		s.lock.Unlock()

		fmt.Printf("[Scheduler] Updating existing deployment for agent %s...\n", manifest.Name)
		s.Reconcile(manifest.Name)
		return nil
	}

	newDeployment := &AgentDeployment{
		Manifest:        manifest,
		DesiredReplicas: manifest.Replicas,
		Instances:       make([]*AgentInstance, 0),
		LastTrafficTime: time.Now(),
	}
	s.deployments[manifest.Name] = newDeployment
	s.lock.Unlock()

	fmt.Printf("[Scheduler] Registered new deployment for agent %s...\n", manifest.Name)
	s.Reconcile(manifest.Name)
	return nil
}

// Undeploy stops all instances of an agent and deletes the deployment specification.
func (s *Scheduler) Undeploy(agentName string) error {
	s.lock.Lock()
	deployment, ok := s.deployments[agentName]
	if !ok {
		s.lock.Unlock()
		return fmt.Errorf("deployment %s not found", agentName)
	}
	s.lock.Unlock()

	fmt.Printf("[Scheduler] Undeploying agent %s, terminating all replicas...\n", agentName)
	deployment.lock.Lock()
	deployment.DesiredReplicas = 0
	deployment.lock.Unlock()

	s.Reconcile(agentName)

	s.lock.Lock()
	delete(s.deployments, agentName)
	s.lock.Unlock()

	return nil
}

// GetDeployments lists all active deployment specifications and statuses.
func (s *Scheduler) GetDeployments() []*AgentDeployment {
	s.lock.RLock()
	defer s.lock.RUnlock()

	list := make([]*AgentDeployment, 0, len(s.deployments))
	for _, dep := range s.deployments {
		list = append(list, dep)
	}
	return list
}

// GetDeployment retrieves a single deployment status.
func (s *Scheduler) GetDeployment(agentName string) (*AgentDeployment, bool) {
	s.lock.RLock()
	defer s.lock.RUnlock()
	dep, ok := s.deployments[agentName]
	return dep, ok
}

// Reconcile reconciles the actual instance count of an agent to match its desired replica count.
func (s *Scheduler) Reconcile(agentName string) {
	s.lock.RLock()
	deployment, ok := s.deployments[agentName]
	s.lock.RUnlock()

	if !ok {
		return
	}

	deployment.lock.Lock()
	defer deployment.lock.Unlock()

	// 1. Clean up terminated/failed instances from the tracking list, saving them to history.
	activeInstances := make([]*AgentInstance, 0)
	var terminatedInstances []*AgentInstance
	for _, inst := range deployment.Instances {
		inst.lock.Lock()
		isTerminated := inst.Status == StatusTerminated
		inst.lock.Unlock()

		if !isTerminated {
			activeInstances = append(activeInstances, inst)
		} else {
			terminatedInstances = append(terminatedInstances, inst)
		}
	}
	deployment.Instances = activeInstances

	if len(terminatedInstances) > 0 {
		deployment.PastInstances = append(deployment.PastInstances, terminatedInstances...)
		// Keep a maximum of 5 terminated instances in history to manage memory.
		if len(deployment.PastInstances) > 5 {
			deployment.PastInstances = deployment.PastInstances[len(deployment.PastInstances)-5:]
		}
	}

	actualCount := len(deployment.Instances)
	desiredCount := deployment.DesiredReplicas

	fmt.Printf("[Scheduler] Reconciling %s: desired=%d, actual=%d\n", agentName, desiredCount, actualCount)

	// 2. Scale up if actual count is less than desired.
	if actualCount < desiredCount {
		neededCount := desiredCount - actualCount
		for i := 0; i < neededCount; i++ {
			port, err := s.portAllocator.Allocate()
			if err != nil {
				fmt.Printf("[Scheduler] Error: Failed to allocate port for %s: %v\n", agentName, err)
				break
			}

			replicaID := uuid.New().String()
			instance := NewAgentInstance(replicaID, agentName, port)
			deployment.Instances = append(deployment.Instances, instance)

			// Spawn process in background context.
			ctx := context.Background()
			if err := instance.Start(ctx, deployment.Manifest, s.portAllocator); err != nil {
				fmt.Printf("[Scheduler] Error starting instance %s: %v\n", replicaID, err)
			}
		}
	}

	// 3. Scale down if actual count exceeds desired count.
	if actualCount > desiredCount {
		excessCount := actualCount - desiredCount
		for i := 0; i < excessCount; i++ {
			// Stop the last instance in the list.
			indexToStop := len(deployment.Instances) - 1 - i
			instanceToStop := deployment.Instances[indexToStop]
			fmt.Printf("[Scheduler] Scaling down: Stopping instance %s of agent %s\n", instanceToStop.ID, agentName)
			instanceToStop.Stop()
		}

		// Keep only the non-excess instances.
		deployment.Instances = deployment.Instances[:desiredCount]
	}
}

// EnsureActive ensures that the agent has at least one active, healthy replica.
// If the agent is scaled to 0, this function scales it to 1 and blocks until the instance is ready.
func (s *Scheduler) EnsureActive(agentName string) error {
	s.lock.RLock()
	deployment, ok := s.deployments[agentName]
	s.lock.RUnlock()

	if !ok {
		return fmt.Errorf("agent %s is not deployed", agentName)
	}

	deployment.lock.Lock()
	deployment.LastTrafficTime = time.Now()

	// If currently scaled to zero, trigger scale up to 1 desired replica.
	if deployment.DesiredReplicas == 0 {
		fmt.Printf("[Scheduler] Autoscaling: Traffic received for %s. Scaling up from 0 to 1 replica...\n", agentName)
		deployment.DesiredReplicas = 1
		deployment.lock.Unlock()
		s.Reconcile(agentName)
	} else {
		deployment.lock.Unlock()
	}

	// Poll until at least one instance transitions to healthy status.
	timeout := time.After(30 * time.Second)
	ticker := time.NewTicker(250 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-timeout:
			return fmt.Errorf("timeout waiting for healthy instance of agent %s", agentName)
		case <-ticker.C:
			deployment.lock.RLock()
			hasHealthyInstance := false
			for _, inst := range deployment.Instances {
				inst.lock.Lock()
				if inst.Status == StatusHealthy {
					hasHealthyInstance = true
					inst.lock.Unlock()
					break
				}
				inst.lock.Unlock()
			}
			deployment.lock.RUnlock()

			if hasHealthyInstance {
				return nil
			}
		}
	}
}

// StartScaleToZeroMonitor spawns a periodic checker loop that monitors agent idleness.
// If an agent is configured with minReplicas=0 and has been idle beyond its idleTimeout, it scales down to 0.
func (s *Scheduler) StartScaleToZeroMonitor(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Second)
	go func() {
		for {
			select {
			case <-ctx.Done():
				ticker.Stop()
				return
			case <-ticker.C:
				s.checkIdleDeployments()
			}
		}
	}()
}

// checkIdleDeployments iterates through deployments and evaluates idleness against manifest configurations.
func (s *Scheduler) checkIdleDeployments() {
	s.lock.RLock()
	// Create a list of names to avoid holding the scheduler lock while reconciling.
	deploymentNames := make([]string, 0, len(s.deployments))
	for name := range s.deployments {
		deploymentNames = append(deploymentNames, name)
	}
	s.lock.RUnlock()

	for _, name := range deploymentNames {
		s.lock.RLock()
		dep, ok := s.deployments[name]
		s.lock.RUnlock()
		if !ok {
			continue
		}

		dep.lock.Lock()
		// Scale-to-zero is only applicable if minReplicas is 0 and it currently has replicas.
		if dep.Manifest.MinReplicas != 0 || dep.DesiredReplicas == 0 {
			dep.lock.Unlock()
			continue
		}

		// Parse idle timeout configuration, defaulting to 30 seconds if omitted or invalid.
		idleTimeout := 30 * time.Second
		if dep.Manifest.IdleTimeout != "" {
			parsed, err := time.ParseDuration(dep.Manifest.IdleTimeout)
			if err == nil {
				idleTimeout = parsed
			}
		}

		timeSinceLastTraffic := time.Since(dep.LastTrafficTime)
		if timeSinceLastTraffic > idleTimeout {
			fmt.Printf("[Scheduler] Autoscaling: Agent %s has been idle for %v. Scaling down to 0 replicas...\n", name, timeSinceLastTraffic)
			dep.DesiredReplicas = 0
			dep.lock.Unlock()
			s.Reconcile(name)
		} else {
			dep.lock.Unlock()
		}
	}
}

// StartQueueAutoscaler spawns a periodic checker loop that monitors queue depth for each agent
// and scales replicas up if the task load is high, up to maxReplicas.
func (s *Scheduler) StartQueueAutoscaler(ctx context.Context, jobQueue *JobQueue) {
	ticker := time.NewTicker(2 * time.Second)
	go func() {
		for {
			select {
			case <-ctx.Done():
				ticker.Stop()
				return
			case <-ticker.C:
				s.checkQueueAutoscaling(jobQueue)
			}
		}
	}()
}

// checkQueueAutoscaling queries pending queue depths and triggers replica scaling up to the configured maxReplicas.
func (s *Scheduler) checkQueueAutoscaling(jobQueue *JobQueue) {
	s.lock.RLock()
	deploymentNames := make([]string, 0, len(s.deployments))
	for name := range s.deployments {
		deploymentNames = append(deploymentNames, name)
	}
	s.lock.RUnlock()

	for _, name := range deploymentNames {
		s.lock.RLock()
		dep, ok := s.deployments[name]
		s.lock.RUnlock()
		if !ok {
			continue
		}

		dep.lock.Lock()
		pendingJobsCount := jobQueue.GetPendingJobsCount(name)

		// HPA scaling logic: if there are pending tasks, scale replicas up.
		// We allocate 1 replica per 2 pending jobs (e.g. 1 job -> 1 replica, 3 jobs -> 2 replicas).
		if pendingJobsCount > 0 && dep.DesiredReplicas < dep.Manifest.MaxReplicas {
			calculatedReplicas := (pendingJobsCount + 1) / 2
			if calculatedReplicas > dep.Manifest.MaxReplicas {
				calculatedReplicas = dep.Manifest.MaxReplicas
			}

			// Only scale up if the calculated replica requirement exceeds the current level.
			if calculatedReplicas > dep.DesiredReplicas {
				fmt.Printf("[Scheduler] Autoscaling: Queue depth for %s is %d. Scaling up to %d replicas...\n", name, pendingJobsCount, calculatedReplicas)
				dep.DesiredReplicas = calculatedReplicas
				dep.lock.Unlock()
				s.Reconcile(name)
				continue
			}
		}
		dep.lock.Unlock()
	}
}

// StopAll terminates all instances across all deployments. Used for clean orchestrator shutdown.
func (s *Scheduler) StopAll() {
	s.lock.Lock()
	defer s.lock.Unlock()

	fmt.Println("[Scheduler] Shutting down, terminating all agent processes...")
	var waitGroup sync.WaitGroup
	for _, dep := range s.deployments {
		dep.lock.Lock()
		dep.DesiredReplicas = 0
		for _, inst := range dep.Instances {
			waitGroup.Add(1)
			go func(instance *AgentInstance) {
				defer waitGroup.Done()
				instance.Stop()
			}(inst)
		}
		dep.lock.Unlock()
	}
	waitGroup.Wait()
}
