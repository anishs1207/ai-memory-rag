package main

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

// AgentManifest defines the structural specification of an agent deployment.
// It maps directly to the YAML configuration file schema.
type AgentManifest struct {
	Name        string   `yaml:"name"`
	Dir         string   `yaml:"dir"`
	Command     string   `yaml:"command"`
	Replicas    int      `yaml:"replicas"`
	MinReplicas int      `yaml:"minReplicas"`
	MaxReplicas int      `yaml:"maxReplicas"`
	IdleTimeout string   `yaml:"idleTimeout"`
	Env         []EnvVar `yaml:"env"`
	// ResolvedDir is the fully resolved absolute path to the directory where the command should be executed.
	ResolvedDir string   `yaml:"-"`
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

	// Resolve the absolute directory path where the agent resides relative to the manifest file path.
	absoluteManifestPath, err := filepath.Abs(manifestFilePath)
	if err != nil {
		return nil, err
	}

	parentDirectoryOfManifest := filepath.Dir(absoluteManifestPath)
	parsedManifest.ResolvedDir = filepath.Clean(filepath.Join(parentDirectoryOfManifest, parsedManifest.Dir))

	return &parsedManifest, nil
}
