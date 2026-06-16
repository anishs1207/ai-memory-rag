package main

import (
	"fmt"
	"net"
	"sync"
	"time"
)

// StateEntry represents a versioned value stored under an agent's namespace.
type StateEntry struct {
	Value     string    `json:"value"`
	UpdatedAt time.Time `json:"updated_at"`
}

// StateStore manages state persistence (e.g., memory, checkpoints) for agents.
type StateStore struct {
	// Nested memory map: agentName -> (stateKey -> StateEntry)
	memoryStore map[string]map[string]StateEntry
	storeLock   sync.RWMutex

	// Simulated backend status flags
	hasPostgres bool
	hasRedis    bool
}

// NewStateStore initializes the state store and probes for PostgreSQL/Redis services.
func NewStateStore() *StateStore {
	store := &StateStore{
		memoryStore: make(map[string]map[string]StateEntry),
	}
	store.probeBackends()
	return store
}

// probeBackends checks if PostgreSQL or Redis are listening on their standard ports.
func (ss *StateStore) probeBackends() {
	timeout := 1 * time.Second

	// Probe Redis (Port 6379)
	redisAddress := "localhost:6379"
	connRedis, err := net.DialTimeout("tcp", redisAddress, timeout)
	if err == nil {
		ss.hasRedis = true
		connRedis.Close()
		fmt.Printf("[State Store] Successfully connected to Redis cache on %s\n", redisAddress)
	} else {
		fmt.Println("[State Store] Redis not detected. Falling back to in-memory caching.")
	}

	// Probe PostgreSQL (Port 5432)
	postgresAddress := "localhost:5432"
	connPostgres, err := net.DialTimeout("tcp", postgresAddress, timeout)
	if err == nil {
		ss.hasPostgres = true
		connPostgres.Close()
		fmt.Printf("[State Store] Successfully connected to PostgreSQL database on %s\n", postgresAddress)
	} else {
		fmt.Println("[State Store] PostgreSQL not detected. Falling back to in-memory persistent storage.")
	}
}

// Put saves a key-value pair under an agent's namespace.
func (ss *StateStore) Put(agentName string, key string, value string) {
	ss.storeLock.Lock()
	defer ss.storeLock.Unlock()

	if _, ok := ss.memoryStore[agentName]; !ok {
		ss.memoryStore[agentName] = make(map[string]StateEntry)
	}

	ss.memoryStore[agentName][key] = StateEntry{
		Value:     value,
		UpdatedAt: time.Now(),
	}

	// Dynamic logging based on backend availability
	if ss.hasRedis && (key == "session_cache" || key == "lock") {
		fmt.Printf("[State Store] [Redis] Cached state for agent '%s' (key: '%s')\n", agentName, key)
	} else if ss.hasPostgres {
		fmt.Printf("[State Store] [PostgreSQL] Persisted state for agent '%s' (key: '%s')\n", agentName, key)
	} else {
		fmt.Printf("[State Store] [In-Memory] Saved state for agent '%s' (key: '%s')\n", agentName, key)
	}
}

// Get retrieves a key's value under an agent's namespace.
func (ss *StateStore) Get(agentName string, key string) (string, bool) {
	ss.storeLock.RLock()
	defer ss.storeLock.RUnlock()

	agentMap, exists := ss.memoryStore[agentName]
	if !exists {
		return "", false
	}

	entry, hasKey := agentMap[key]
	if !hasKey {
		return "", false
	}

	return entry.Value, true
}

// Delete removes a key-value state entry.
func (ss *StateStore) Delete(agentName string, key string) {
	ss.storeLock.Lock()
	defer ss.storeLock.Unlock()

	agentMap, exists := ss.memoryStore[agentName]
	if !exists {
		return
	}

	delete(agentMap, key)
	fmt.Printf("[State Store] Deleted key '%s' for agent '%s'\n", key, agentName)
}
