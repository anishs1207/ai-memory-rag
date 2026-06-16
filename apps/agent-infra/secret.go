package main

import (
	"fmt"
	"sync"
)

// SecretsManager securely stores configuration keys, API tokens, and passwords in memory.
type SecretsManager struct {
	// Nested map mapping namespace (e.g. agent name, or "global") to keys and values
	secrets     map[string]map[string]string
	secretsLock sync.RWMutex
}

// NewSecretsManager initializes a thread-safe SecretsManager.
func NewSecretsManager() *SecretsManager {
	manager := &SecretsManager{
		secrets: make(map[string]map[string]string),
	}
	manager.seedDefaultSecrets()
	return manager
}

func (sm *SecretsManager) seedDefaultSecrets() {
	// Pre-populate global mock keys for testing
	sm.secrets["global"] = map[string]string{
		"ENVIRONMENT": "production",
	}
	// Pre-populate keys for the weather-agent
	sm.secrets["weather-agent"] = map[string]string{
		"OPENAI_API_KEY": "sk-mock-openai-key-for-weather-agent-123456",
		"STRIPE_API_KEY": "rk_live_mock_stripe_key_987654",
	}
}

// SetSecret registers or updates a secret key-value pair under a specific namespace.
func (sm *SecretsManager) SetSecret(namespace string, key string, value string) {
	sm.secretsLock.Lock()
	defer sm.secretsLock.Unlock()

	if _, ok := sm.secrets[namespace]; !ok {
		sm.secrets[namespace] = make(map[string]string)
	}

	sm.secrets[namespace][key] = value
	fmt.Printf("[Secrets Manager] Secret key '%s' set under namespace '%s'\n", key, namespace)
}

// GetSecrets retrieves all registered secrets for a namespace.
// It returns a copy of the key-value map to prevent concurrent map write/read access panics.
func (sm *SecretsManager) GetSecrets(namespace string) map[string]string {
	sm.secretsLock.RLock()
	defer sm.secretsLock.RUnlock()

	namespaceSecrets, exists := sm.secrets[namespace]
	if !exists {
		return make(map[string]string)
	}

	// Create a safe copy of the secrets map
	copiedSecrets := make(map[string]string)
	for key, value := range namespaceSecrets {
		copiedSecrets[key] = value
	}
	return copiedSecrets
}

// DeleteSecret removes a single secret from a namespace.
func (sm *SecretsManager) DeleteSecret(namespace string, key string) error {
	sm.secretsLock.Lock()
	defer sm.secretsLock.Unlock()

	namespaceSecrets, exists := sm.secrets[namespace]
	if !exists {
		return fmt.Errorf("secrets namespace '%s' not found", namespace)
	}

	if _, ok := namespaceSecrets[key]; !ok {
		return fmt.Errorf("secret key '%s' not found under namespace '%s'", key, namespace)
	}

	delete(namespaceSecrets, key)
	fmt.Printf("[Secrets Manager] Secret key '%s' deleted from namespace '%s'\n", key, namespace)
	return nil
}
