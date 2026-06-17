package orchestrator

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"
)

// Event represents an event payload sent over the Event Bus.
type Event struct {
	ID        string                 `json:"id"`
	Topic     string                 `json:"topic"`
	Publisher string                 `json:"publisher"`
	Payload   map[string]interface{} `json:"payload"`
	Timestamp time.Time              `json:"timestamp"`
}

// Subscription represents an agent's interest in a specific event topic.
type Subscription struct {
	Topic     string `json:"topic"`
	AgentName string `json:"agent_name"`
	Endpoint  string `json:"endpoint"` // e.g., "/events" or "/webhook"
}

// EventBus coordinates async pub/sub messaging among deployed agents.
type EventBus struct {
	subscriptions map[string][]Subscription
	history       []Event
	busLock       sync.RWMutex
	scheduler     *Scheduler
}

// NewEventBus initializes a thread-safe Event Bus connected to the scheduler.
func NewEventBus(scheduler *Scheduler) *EventBus {
	return &EventBus{
		subscriptions: make(map[string][]Subscription),
		history:       make([]Event, 0),
		scheduler:     scheduler,
	}
}

// Subscribe registers an agent webhook callback endpoint to a topic.
func (eb *EventBus) Subscribe(topic, agentName, endpoint string) {
	eb.busLock.Lock()
	defer eb.busLock.Unlock()

	newSub := Subscription{
		Topic:     topic,
		AgentName: agentName,
		Endpoint:  endpoint,
	}

	eb.subscriptions[topic] = append(eb.subscriptions[topic], newSub)
	fmt.Printf("[Event Bus] Subscribed agent %s (endpoint: %s) to topic %s\n", agentName, endpoint, topic)
}

// Publish enqueues and dispatches an event to all registered topic subscribers.
func (eb *EventBus) Publish(topic string, publisher string, payload map[string]interface{}) string {
	eventID := uuid.New().String()
	event := Event{
		ID:        eventID,
		Topic:     topic,
		Publisher: publisher,
		Payload:   payload,
		Timestamp: time.Now(),
	}

	eb.busLock.Lock()
	eb.history = append(eb.history, event)
	
	// Keep event history capped at 100 entries
	if len(eb.history) > 100 {
		eb.history = eb.history[len(eb.history)-100:]
	}

	// Fetch matching subscribers under read lock
	subscribers, exists := eb.subscriptions[topic]
	eb.busLock.Unlock()

	if !exists || len(subscribers) == 0 {
		fmt.Printf("[Event Bus] Published Event %s on topic %s, but no subscribers found.\n", eventID, topic)
		return eventID
	}

	fmt.Printf("[Event Bus] Published Event %s on topic %s. Dispatching to %d subscribers...\n", eventID, topic, len(subscribers))

	// Deliver events asynchronously
	for _, sub := range subscribers {
		go eb.deliverEvent(event, sub)
	}

	return eventID
}

// GetHistory returns a list of previously published events.
func (eb *EventBus) GetHistory() []Event {
	eb.busLock.RLock()
	defer eb.busLock.RUnlock()

	copied := make([]Event, len(eb.history))
	copy(copied, eb.history)
	return copied
}

func (eb *EventBus) deliverEvent(event Event, sub Subscription) {
	fmt.Printf("[Event Bus] Attempting to deliver event %s to subscriber %s...\n", event.ID, sub.AgentName)

	// 1. Ensure the subscriber agent is booted and active
	err := eb.scheduler.EnsureActive(sub.AgentName)
	if err != nil {
		fmt.Printf("[Event Bus] Error: Failed to activate subscriber %s: %v\n", sub.AgentName, err)
		return
	}

	// 2. Fetch healthy instances
	deployment, ok := eb.scheduler.GetDeployment(sub.AgentName)
	if !ok {
		fmt.Printf("[Event Bus] Error: Subscriber %s deployment missing.\n", sub.AgentName)
		return
	}

	deployment.lock.RLock()
	var healthyInstances []*AgentInstance
	for _, inst := range deployment.Instances {
		inst.lock.Lock()
		if inst.Status == StatusHealthy {
			healthyInstances = append(healthyInstances, inst)
		}
		inst.lock.Unlock()
	}
	deployment.lock.RUnlock()

	if len(healthyInstances) == 0 {
		fmt.Printf("[Event Bus] Error: No healthy instances of subscriber %s found.\n", sub.AgentName)
		return
	}

	// Choose first replica to receive the webhook
	selectedInstance := healthyInstances[0]
	targetPort := selectedInstance.Port

	// Format final URL path: http://localhost:port/endpoint
	endpointPath := sub.Endpoint
	if !bytes.HasPrefix([]byte(endpointPath), []byte("/")) {
		endpointPath = "/" + endpointPath
	}
	targetURL := fmt.Sprintf("http://localhost:%d%s", targetPort, endpointPath)

	// Post event JSON to subscriber agent
	jsonData, err := json.Marshal(event)
	if err != nil {
		fmt.Printf("[Event Bus] Error marshalling event JSON: %v\n", err)
		return
	}

	client := &http.Client{Timeout: 10 * time.Second}
	request, err := http.NewRequest("POST", targetURL, bytes.NewBuffer(jsonData))
	if err != nil {
		fmt.Printf("[Event Bus] Error creating request for %s: %v\n", sub.AgentName, err)
		return
	}
	request.Header.Set("Content-Type", "application/json")

	response, err := client.Do(request)
	if err != nil {
		fmt.Printf("[Event Bus] Failed webhook post to %s (%s): %v\n", sub.AgentName, targetURL, err)
		return
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK && response.StatusCode != http.StatusAccepted {
		fmt.Printf("[Event Bus] Webhook delivery to %s returned non-OK status: %s\n", sub.AgentName, response.Status)
	} else {
		fmt.Printf("[Event Bus] Successfully delivered event %s to %s\n", event.ID, sub.AgentName)
	}
}
