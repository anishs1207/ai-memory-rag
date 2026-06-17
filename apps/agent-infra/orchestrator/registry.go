package orchestrator

import (
	"fmt"
	"sync"
)

// RegistryAgentInfo represents a simple versioned record of a registered agent.
type RegistryAgentInfo struct {
	Name    string `json:"name"`
	Version string `json:"version"`
	Runtime string `json:"runtime"`
}

// AgentRegistry maintains the metadata definitions of all registered agents and their historical versions.
type AgentRegistry struct {
	// Nested map architecture: agentName -> (versionString -> AgentManifest)
	registeredManifests map[string]map[string]*AgentManifest
	registryLock        sync.RWMutex
}

// NewAgentRegistry initializes a thread-safe registry.
func NewAgentRegistry() *AgentRegistry {
	return &AgentRegistry{
		registeredManifests: make(map[string]map[string]*AgentManifest),
	}
}

// Register adds or updates an agent specification version in the registry.
func (ar *AgentRegistry) Register(manifest *AgentManifest) error {
	if manifest.Name == "" {
		return fmt.Errorf("agent name cannot be empty")
	}
	if manifest.Version == "" {
		manifest.Version = "1.0.0"
	}

	ar.registryLock.Lock()
	defer ar.registryLock.Unlock()

	versionMap, exists := ar.registeredManifests[manifest.Name]
	if !exists {
		versionMap = make(map[string]*AgentManifest)
		ar.registeredManifests[manifest.Name] = versionMap
	}

	versionMap[manifest.Version] = manifest
	fmt.Printf("[Agent Registry] Registered agent: %s, version: %s\n", manifest.Name, manifest.Version)
	return nil
}

// Get retrieves a specific version of an agent's manifest.
func (ar *AgentRegistry) Get(agentName, version string) (*AgentManifest, bool) {
	ar.registryLock.RLock()
	defer ar.registryLock.RUnlock()

	versionMap, exists := ar.registeredManifests[agentName]
	if !exists {
		return nil, false
	}

	manifest, hasVersion := versionMap[version]
	return manifest, hasVersion
}

// GetLatest retrieves the latest version (or fallback default) of a registered agent.
func (ar *AgentRegistry) GetLatest(agentName string) (*AgentManifest, bool) {
	ar.registryLock.RLock()
	defer ar.registryLock.RUnlock()

	versionMap, exists := ar.registeredManifests[agentName]
	if !exists || len(versionMap) == 0 {
		return nil, false
	}

	// For simplicity, we choose the first available version or look for typical "latest" tag.
	// In production, we'd parse semver and compare. Let's find the lexicographically highest or "latest" key.
	var latestManifest *AgentManifest
	var highestVersion string

	for currentVersion, manifest := range versionMap {
		if currentVersion == "latest" {
			return manifest, true
		}
		if latestManifest == nil || currentVersion > highestVersion {
			highestVersion = currentVersion
			latestManifest = manifest
		}
	}

	return latestManifest, latestManifest != nil
}

// List returns a consolidated list of all registered agent configurations.
func (ar *AgentRegistry) List() []*AgentManifest {
	ar.registryLock.RLock()
	defer ar.registryLock.RUnlock()

	allManifests := make([]*AgentManifest, 0)
	for _, versionMap := range ar.registeredManifests {
		for _, manifest := range versionMap {
			allManifests = append(allManifests, manifest)
		}
	}
	return allManifests
}

// Delete removes a specific version from the registry.
func (ar *AgentRegistry) Delete(agentName, version string) error {
	ar.registryLock.Lock()
	defer ar.registryLock.Unlock()

	versionMap, exists := ar.registeredManifests[agentName]
	if !exists {
		return fmt.Errorf("agent %s not found in registry", agentName)
	}

	if _, hasVersion := versionMap[version]; !hasVersion {
		return fmt.Errorf("version %s for agent %s not found", version, agentName)
	}

	delete(versionMap, version)
	if len(versionMap) == 0 {
		delete(ar.registeredManifests, agentName)
	}

	fmt.Printf("[Agent Registry] Removed agent: %s, version: %s\n", agentName, version)
	return nil
}

// MarketplaceAgent represents a template agent in the marketplace ready to install.
type MarketplaceAgent struct {
	Name        string            `json:"name"`
	Description string            `json:"description"`
	Version     string            `json:"version"`
	Runtime     string            `json:"runtime"`
	DefaultYaml string            `json:"default_yaml"`
}

// AgentMarketplace simulates an app store for prepackaged AI agent services.
type AgentMarketplace struct {
	catalog map[string]*MarketplaceAgent
}

// NewAgentMarketplace initializes the marketplace with seed templates.
func NewAgentMarketplace() *AgentMarketplace {
	m := &AgentMarketplace{
		catalog: make(map[string]*MarketplaceAgent),
	}
	m.seedCatalog()
	return m
}

func (am *AgentMarketplace) seedCatalog() {
	am.catalog["summarizer-agent"] = &MarketplaceAgent{
		Name:        "summarizer-agent",
		Description: "A specialized agent that processes text payloads and produces formatted summaries.",
		Version:     "1.0.0",
		Runtime:     "nodejs",
		DefaultYaml: `name: summarizer-agent
version: 1.0.0
runtime: nodejs
dir: .
command: node dist/index.js
replicas: 1
minReplicas: 0
maxReplicas: 2
idleTimeout: 30s
env:
  - name: SUMMARIZE_LENGTH
    value: "short"`,
	}

	am.catalog["vision-agent"] = &MarketplaceAgent{
		Name:        "vision-agent",
		Description: "A heavy-duty vision agent running on Python with GPU requirements.",
		Version:     "2.1.0",
		Runtime:     "python",
		DefaultYaml: `name: vision-agent
version: 2.1.0
runtime: python
dir: .
command: python main.py
replicas: 1
minReplicas: 1
maxReplicas: 4
idleTimeout: 60s
placement:
  region: us-east-1
  gpu: true
  memory: 16Gi
env:
  - name: MODEL_NAME
    value: "vit-huge"`,
	}
}

// List returns all agents available for installation.
func (am *AgentMarketplace) List() []*MarketplaceAgent {
	list := make([]*MarketplaceAgent, 0, len(am.catalog))
	for _, agent := range am.catalog {
		list = append(list, agent)
	}
	return list
}

// Get retrieves a specific template from the marketplace.
func (am *AgentMarketplace) Get(name string) (*MarketplaceAgent, bool) {
	agent, exists := am.catalog[name]
	return agent, exists
}
