package orchestrator

import (
	"context"
	"fmt"
	"math"
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

// Scheduler handles the lifecycle, scheduling, and reconciliation of all agent deployments.
type Scheduler struct {
	deployments    map[string]*AgentDeployment
	portAllocator  *PortAllocator
	nodeManager    *NodeManager
	secretsManager *SecretsManager
	lock           sync.RWMutex
}

// NewScheduler creates a new scheduler instance associated with a port pool and node/secret managers.
func NewScheduler(portAllocator *PortAllocator, nodeManager *NodeManager, secretsManager *SecretsManager) *Scheduler {
	return &Scheduler{
		deployments:    make(map[string]*AgentDeployment),
		portAllocator:  portAllocator,
		nodeManager:    nodeManager,
		secretsManager: secretsManager,
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
			// Release resources on the node
			s.nodeManager.ReleaseResources(inst.NodeID, inst.ID)
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

			// Schedule instance to a Node based on Placement Policy
			nodeID, err := s.nodeManager.ScheduleInstance(deployment.Manifest)
			if err != nil {
				fmt.Printf("[Scheduler] Placement Error: Failed to place %s: %v\n", agentName, err)
				s.portAllocator.Release(port)
				break
			}

			replicaID := uuid.New().String()
			instance := NewAgentInstance(replicaID, agentName, port)
			instance.NodeID = nodeID
			instance.Version = deployment.Manifest.Version
			
			deployment.Instances = append(deployment.Instances, instance)

			// Allocate resources on the scheduled node
			var memoryReq string
			if deployment.Manifest.Placement != nil {
				memoryReq = deployment.Manifest.Placement.Memory
			}
			s.nodeManager.AllocateResources(nodeID, replicaID, memoryReq)

			// Spawn process in background context.
			ctx := context.Background()
			if err := instance.Start(ctx, deployment.Manifest, s.portAllocator, s.secretsManager); err != nil {
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
			
			// Release resources on the node
			s.nodeManager.ReleaseResources(instanceToStop.NodeID, instanceToStop.ID)
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
//@ basically checks eevery 5 seconds for idle agents to swapm down (if they have not been used for > idleTimout & have minReplicas set to 0)
// the configure it to 0 (and keep this loo)
func (s *Scheduler) StartScaleToZeroMonitor(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Second)
	go func() {
		// starst a new go routine, which runs in the background and contiue immdeialty
		// 
		for {
			// for {} => means inifite loop running for ever
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
// acquire read lock for reading the data here (use of shared data here)
func (s *Scheduler) checkIdleDeployments() {
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

// StartMetricsAutoscaler runs a periodic checks loop monitoring metrics and adjusting replica scales.
// runs every 2 sedonds here as go routine here with infiite loop 
func (s *Scheduler) StartMetricsAutoscaler(ctx context.Context, observability *ObservabilityManager, jobQueue *JobQueue) {
	ticker := time.NewTicker(2 * time.Second)
	go func() {
		for {
			select {
			case <-ctx.Done():
				ticker.Stop()
				return
			case <-ticker.C:
				// runs this metrics auto scaling here
				s.checkMetricsAutoscaling(observability, jobQueue)
			}
		}
	}()
}

func (s *Scheduler) checkMetricsAutoscaling(observability *ObservabilityManager, jobQueue *JobQueue) {
	s.lock.RLock()
	
	deploymentNames := make([]string, 0, len(s.deployments))
	
	for name := range s.deployments {
		deploymentNames = append(deploymentNames, name)
	}
	
	s.lock.RUnlock()

	// for for _,name := 
	for _, name := range deploymentNames {
		// since _ (it gives us an index also here)
		s.lock.RLock()
		// ok since required key may not be present
		dep, ok := s.deployments[name]
		s.lock.RUnlock()
		if !ok {
			continue
		}

		dep.lock.Lock()
		manifest := dep.Manifest

		// 1. Determine scaling rules. Default to queue depth scaling if not specified
		metricName := "queue_depth"
		var targetValue float64 = 2.0 // 1 replica per 2 pending items
		if manifest.Autoscaling != nil {
			metricName = manifest.Autoscaling.Metric
			targetValue = manifest.Autoscaling.Target
		}

		var currentMetricValue float64
		switch metricName {
		case "queue_depth":
			pendingJobs := jobQueue.GetPendingJobsCount(name)
			currentMetricValue = float64(pendingJobs)

		case "cpu":
			// Read simulated CPU usage from scheduled nodes
			var totalCPU float64
			var nodeCount float64
			for _, inst := range dep.Instances {
				s.nodeManager.nodeLock.RLock()
				if node, exists := s.nodeManager.nodes[inst.NodeID]; exists {
					totalCPU += node.CPUUsagePercentage
					nodeCount++
				}
				s.nodeManager.nodeLock.RUnlock()
			}
			if nodeCount > 0 {
				currentMetricValue = totalCPU / nodeCount
			} else {
				currentMetricValue = 0.0
			}

		case "memory":
			// Read average memory usage percentage
			var totalMemoryUsage float64
			var count float64
			for _, inst := range dep.Instances {
				s.nodeManager.nodeLock.RLock()
				if node, exists := s.nodeManager.nodes[inst.NodeID]; exists {
					if node.TotalMemoryBytes > 0 {
						totalMemoryUsage += (float64(node.MemoryAllocatedBytes) / float64(node.TotalMemoryBytes)) * 100.0
					}
					count++
				}
				s.nodeManager.nodeLock.RUnlock()
			}
			if count > 0 {
				currentMetricValue = totalMemoryUsage / count
			}

		case "rps":
			// Calculate Requests Per Second in the last 10s from metrics history
			observability.lock.RLock()
			var requestsInLast10s int
			for _, rec := range observability.records {
				if rec.AgentName == name && time.Since(rec.Timestamp) <= 10*time.Second {
					requestsInLast10s++
				}
			}
			observability.lock.RUnlock()
			currentMetricValue = float64(requestsInLast10s) / 10.0

		case "token_usage":
			// Calculate total tokens consumed per second in the last 10s
			observability.lock.RLock()
			var tokensInLast10s int
			for _, rec := range observability.records {
				if rec.AgentName == name && time.Since(rec.Timestamp) <= 10*time.Second {
					tokensInLast10s += rec.TokensInput + rec.TokensOutput
				}
			}
			observability.lock.RUnlock()
			currentMetricValue = float64(tokensInLast10s) / 10.0
		}

		// Calculate desired replicas
		if targetValue <= 0 {
			targetValue = 1.0 // Prevent division by zero
		}

		var calculatedReplicas int
		if metricName == "queue_depth" {
			// Specific formula for jobs: 1 replica per targetValue pending jobs
			if currentMetricValue > 0 {
				calculatedReplicas = int(math.Ceil(currentMetricValue / targetValue))
			} else {
				calculatedReplicas = dep.DesiredReplicas // Keep existing if queue is empty
			}
		} else {
			// Target tracking: scale relative to target threshold
			if currentMetricValue > targetValue {
				// Scale up proportionately
				currentReplicas := len(dep.Instances)
				if currentReplicas == 0 {
					currentReplicas = 1
				}
				calculatedReplicas = int(math.Ceil((currentMetricValue / targetValue) * float64(currentReplicas)))
			} else {
				calculatedReplicas = dep.DesiredReplicas // Keep existing or scale down on idle (handled by scale-to-zero)
			}
		}

		// Enforce boundaries
		if calculatedReplicas > manifest.MaxReplicas {
			calculatedReplicas = manifest.MaxReplicas
		}
		if calculatedReplicas < manifest.MinReplicas {
			calculatedReplicas = manifest.MinReplicas
		}

		// Adjust replicas if requirements changed
		if calculatedReplicas > dep.DesiredReplicas {
			fmt.Printf("[Scheduler] Autoscaling: Metric %s for %s is %.2f (target %.2f). Scaling up to %d replicas...\n",
				metricName, name, currentMetricValue, targetValue, calculatedReplicas)
			dep.DesiredReplicas = calculatedReplicas
			dep.lock.Unlock()
			s.Reconcile(name)
			continue
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
				s.nodeManager.ReleaseResources(instance.NodeID, instance.ID)
			}(inst)
		}
		dep.lock.Unlock()
	}
	waitGroup.Wait()
}

// SetNodeStatusAndReconcile updates node status and evicts replicas if status is DRAINING or OFFLINE.
func (s *Scheduler) SetNodeStatusAndReconcile(nodeID string, status NodeStatus) error {
	// 1. Update status in NodeManager
	err := s.nodeManager.SetNodeStatus(nodeID, status)
	if err != nil {
		return err
	}

	// 2. If status is DRAINING or OFFLINE, evict and reschedule instances
	if status == NodeStatusDraining || status == NodeStatusOffline {
		fmt.Printf("[Scheduler] Node %s is %s. Evicting scheduled agent replicas...\n", nodeID, status)
		
		s.lock.RLock()
		// Identify which deployments are affected
		affectedDeployments := make(map[string]bool)
		for name, dep := range s.deployments {
			dep.lock.Lock()
			var remainingInstances []*AgentInstance
			for _, inst := range dep.Instances {
				if inst.NodeID == nodeID {
					fmt.Printf("[Scheduler] Evicting instance %s of agent %s from node %s\n", inst.ID, name, nodeID)
					inst.Stop()
					s.nodeManager.ReleaseResources(nodeID, inst.ID)
					affectedDeployments[name] = true
				} else {
					remainingInstances = append(remainingInstances, inst)
				}
			}
			dep.Instances = remainingInstances
			dep.lock.Unlock()
		}
		s.lock.RUnlock()

		// Reconcile each affected deployment to trigger rescheduling on other nodes
		for name := range affectedDeployments {
			fmt.Printf("[Scheduler] Triggering reconcile for agent %s after node eviction\n", name)
			s.Reconcile(name)
		}
	}

	return nil
}

// StartReconcilerLoop spawns a periodic checker loop that reconciles all deployments.
// This is critical for self-healing: if an agent process crashes or is killed externally,
// the scheduler automatically detects the loss and launches a new healthy replacement replica.
func (s *Scheduler) StartReconcilerLoop(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Second)
	go func() {
		fmt.Println("[Scheduler] Background self-healing Reconciler Loop initialized")
		for {
			select {
			case <-ctx.Done():
				ticker.Stop()
				fmt.Println("[Scheduler] Background self-healing Reconciler Loop stopped")
				return
			case <-ticker.C:
				s.reconcileAllDeployments()
			}
		}
	}()
}

// reconcileAllDeployments scans all registered deployment names and runs individual Reconcile operations.
func (s *Scheduler) reconcileAllDeployments() {
	s.lock.RLock()
	// Copy deployment names under a read-lock to avoid holding the lock while running Reconcile
	deploymentNames := make([]string, 0, len(s.deployments))
	for name := range s.deployments {
		deploymentNames = append(deploymentNames, name)
	}
	s.lock.RUnlock()

	for _, deploymentName := range deploymentNames {
		s.Reconcile(deploymentName)
	}
}



