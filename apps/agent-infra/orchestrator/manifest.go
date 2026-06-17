package orchestrator

import (
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

// EnvVar represents a single environment variable key-value pair to inject into the agent process.
type EnvVar struct {
	Name  string `yaml:"name"`
	Value string `yaml:"value"`
}

// AutoscalePolicy defines the metric and target threshold configuration for dynamic scaling.
type AutoscalePolicy struct {
	Metric string  `yaml:"metric"` // Evaluated metrics: "cpu", "memory", "queue_depth", "rps", "token_usage"
	Target float64 `yaml:"target"` // Target numeric threshold for scaling up/down
}

// PlacementPolicy defines host node requirements where replicas of the agent should be scheduled.
type PlacementPolicy struct {
	Region string `yaml:"region"` // Preferred geographical deployment region (e.g., "us-east-1")
	GPU    bool   `yaml:"gpu"`    // Indicates if the host node must have GPU hardware enabled
	Memory string `yaml:"memory"` // Minimum memory requirements (e.g., "16Gi")
}

// CanaryPolicy specifies canary routing options including the canary version and traffic weight.
type CanaryPolicy struct {
	Version string  `yaml:"version"` // Tag of the target canary deployment version
	Weight  float64 `yaml:"weight"`  // Percent of request traffic routed to the canary (0 to 100)
}

// AgentManifest defines the structural specification of an agent deployment.
// It maps directly to the YAML configuration file schema.
type AgentManifest struct {
	Name        string           `yaml:"name"`
	Version     string           `yaml:"version"`
	Runtime     string           `yaml:"runtime"`
	Dir         string           `yaml:"dir"`
	Command     string           `yaml:"command"`
	Replicas    int              `yaml:"replicas"`
	MinReplicas int              `yaml:"minReplicas"`
	MaxReplicas int              `yaml:"maxReplicas"`
	IdleTimeout string           `yaml:"idleTimeout"`
	Env         []EnvVar         `yaml:"env"`
	Autoscaling *AutoscalePolicy `yaml:"autoscaling,omitempty"`
	Placement   *PlacementPolicy `yaml:"placement,omitempty"`
	Canary      *CanaryPolicy    `yaml:"canary,omitempty"`
	// ResolvedDir is the fully resolved absolute path to the directory where the command should be executed.
	ResolvedDir string           `yaml:"-"`
}

// ParseManifest reads and unmarshals an agent.yaml manifest configuration file.
// It also resolves the relative directory path to an absolute path for execution purposes.
func ParseManifest(manifestFilePath string) (*AgentManifest, error) {
	manifestData, err := os.ReadFile(manifestFilePath)
	if err != nil {
		return nil, err
	}

	var parsedManifest AgentManifest
	err = yaml.Unmarshal(manifestData, &parsedManifest)
	if err != nil {
		return nil, err
	}

	// Default values if missing
	if parsedManifest.Version == "" {
		parsedManifest.Version = "1.0.0"
	}
	if parsedManifest.Runtime == "" {
		parsedManifest.Runtime = "nodejs"
	}

	// Resolve the absolute directory path where the agent resides relative to the manifest file path.
	absoluteManifestPath, err := filepath.Abs(manifestFilePath)
	if err != nil {
		return nil, err
	}

	parentDirectoryOfManifest := filepath.Dir(absoluteManifestPath)
	parsedManifest.ResolvedDir = filepath.Clean(filepath.Join(parentDirectoryOfManifest, parsedManifest.Dir))

	return &parsedManifest, nil
}

