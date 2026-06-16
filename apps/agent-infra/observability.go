package main

import (
	"fmt"
	"strings"
	"sync"
	"time"
)

// MetricRecord contains telemetry stats collected on a single agent request execution.
type MetricRecord struct {
	AgentName      string        `json:"agent_name"`
	Version        string        `json:"version"`
	Timestamp      time.Time     `json:"timestamp"`
	Latency        time.Duration `json:"latency"`
	TokensInput    int           `json:"tokens_input"`
	TokensOutput   int           `json:"tokens_output"`
	Success        bool          `json:"success"`
	CostUSD        float64       `json:"cost_usd"`
	TenantID       string        `json:"tenant_id"`       // Used for multi-tenant billing isolation
	WorkspaceID    string        `json:"workspace_id"`    // Sub-tenant identifier
	OrganizationID string        `json:"organization_id"` // Enterprise scope
}

// ObservabilityManager aggregates, filters, and formats telemetry records.
type ObservabilityManager struct {
	records []MetricRecord
	lock    sync.RWMutex
}

// NewObservabilityManager creates a new thread-safe telemetry recorder.
func NewObservabilityManager() *ObservabilityManager {
	return &ObservabilityManager{
		records: make([]MetricRecord, 0),
	}
}

// Record appends a telemetry record to the in-memory window buffer.
func (om *ObservabilityManager) Record(record MetricRecord) {
	om.lock.Lock()
	defer om.lock.Unlock()

	// Calculate cost if not already specified:
	// Pricing model:
	// - $0.0015 per 1,000 input tokens ($1.50 / M)
	// - $0.0020 per 1,000 output tokens ($2.00 / M)
	// - $0.0001 flat base infrastructure cost per execution
	if record.CostUSD == 0 {
		inputCost := (float64(record.TokensInput) / 1000.0) * 0.0015
		outputCost := (float64(record.TokensOutput) / 1000.0) * 0.0020
		record.CostUSD = inputCost + outputCost + 0.0001
	}

	om.records = append(om.records, record)
	fmt.Printf("[Observability] Recorded metric: agent=%s, success=%t, latency=%v, tokens=%d, cost=$%.6f\n",
		record.AgentName, record.Success, record.Latency, record.TokensInput+record.TokensOutput, record.CostUSD)
}

// GetMetrics aggregates metrics for a specific agent.
func (om *ObservabilityManager) GetMetrics(agentName string) map[string]interface{} {
	om.lock.RLock()
	defer om.lock.RUnlock()

	var totalInvocations int
	var successfulInvocations int
	var failedInvocations int
	var totalLatency time.Duration
	var totalInputTokens int
	var totalOutputTokens int
	var totalCostUSD float64

	for _, rec := range om.records {
		if agentName == "" || rec.AgentName == agentName {
			totalInvocations++
			if rec.Success {
				successfulInvocations++
			} else {
				failedInvocations++
			}
			totalLatency += rec.Latency
			totalInputTokens += rec.TokensInput
			totalOutputTokens += rec.TokensOutput
			totalCostUSD += rec.CostUSD
		}
	}

	averageLatencyMs := 0.0
	if totalInvocations > 0 {
		averageLatencyMs = float64(totalLatency.Milliseconds()) / float64(totalInvocations)
	}

	return map[string]interface{}{
		"agent_name":             agentName,
		"total_invocations":      totalInvocations,
		"successful_invocations": successfulInvocations,
		"failed_invocations":     failedInvocations,
		"average_latency_ms":     averageLatencyMs,
		"total_input_tokens":     totalInputTokens,
		"total_output_tokens":    totalOutputTokens,
		"total_tokens":           totalInputTokens + totalOutputTokens,
		"total_cost_usd":         totalCostUSD,
	}
}

// GetCostsSummary aggregates costs per agent, tenant, workspace, and organization.
func (om *ObservabilityManager) GetCostsSummary() map[string]interface{} {
	om.lock.RLock()
	defer om.lock.RUnlock()

	agentCosts := make(map[string]float64)
	tenantCosts := make(map[string]float64)
	workspaceCosts := make(map[string]float64)
	organizationCosts := make(map[string]float64)
	var totalClusterCostUSD float64

	for _, rec := range om.records {
		agentCosts[rec.AgentName] += rec.CostUSD
		totalClusterCostUSD += rec.CostUSD

		if rec.TenantID != "" {
			tenantCosts[rec.TenantID] += rec.CostUSD
		} else {
			tenantCosts["default_tenant"] += rec.CostUSD
		}

		if rec.WorkspaceID != "" {
			workspaceCosts[rec.WorkspaceID] += rec.CostUSD
		} else {
			workspaceCosts["default_workspace"] += rec.CostUSD
		}

		if rec.OrganizationID != "" {
			organizationCosts[rec.OrganizationID] += rec.CostUSD
		} else {
			organizationCosts["default_org"] += rec.CostUSD
		}
	}

	return map[string]interface{}{
		"total_cluster_cost_usd": totalClusterCostUSD,
		"by_agent":               agentCosts,
		"by_tenant":              tenantCosts,
		"by_workspace":           workspaceCosts,
		"by_organization":        organizationCosts,
	}
}

// GetPrometheusMetrics exports metrics in a raw text format readable by Prometheus.
func (om *ObservabilityManager) GetPrometheusMetrics() string {
	om.lock.RLock()
	defer om.lock.RUnlock()

	var sb strings.Builder

	// Aggregate metrics in-memory
	agentInvocations := make(map[string]int)
	agentFailures := make(map[string]int)
	agentLatencySum := make(map[string]float64)
	agentTokensSum := make(map[string]int)
	agentCostSum := make(map[string]float64)

	for _, rec := range om.records {
		key := fmt.Sprintf("agent=\"%s\",version=\"%s\"", rec.AgentName, rec.Version)
		agentInvocations[key]++
		if !rec.Success {
			agentFailures[key]++
		}
		agentLatencySum[key] += float64(rec.Latency.Milliseconds())
		agentTokensSum[key] += rec.TokensInput + rec.TokensOutput
		agentCostSum[key] += rec.CostUSD
	}

	sb.WriteString("# HELP agent_invocations_total Total number of agent invocations.\n")
	sb.WriteString("# TYPE agent_invocations_total counter\n")
	for labels, val := range agentInvocations {
		sb.WriteString(fmt.Sprintf("agent_invocations_total{%s} %d\n", labels, val))
	}

	sb.WriteString("\n# HELP agent_failures_total Total number of failed agent invocations.\n")
	sb.WriteString("# TYPE agent_failures_total counter\n")
	for labels, val := range agentFailures {
		sb.WriteString(fmt.Sprintf("agent_failures_total{%s} %d\n", labels, val))
	}

	sb.WriteString("\n# HELP agent_latency_milliseconds_sum Cumulative latency of invocations in milliseconds.\n")
	sb.WriteString("# TYPE agent_latency_milliseconds_sum counter\n")
	for labels, val := range agentLatencySum {
		sb.WriteString(fmt.Sprintf("agent_latency_milliseconds_sum{%s} %.2f\n", labels, val))
	}

	sb.WriteString("\n# HELP agent_tokens_consumed_total Cumulative token usage count.\n")
	sb.WriteString("# TYPE agent_tokens_consumed_total counter\n")
	for labels, val := range agentTokensSum {
		sb.WriteString(fmt.Sprintf("agent_tokens_consumed_total{%s} %d\n", labels, val))
	}

	sb.WriteString("\n# HELP agent_cost_usd_total Accumulated execution cost in USD.\n")
	sb.WriteString("# TYPE agent_cost_usd_total counter\n")
	for labels, val := range agentCostSum {
		sb.WriteString(fmt.Sprintf("agent_cost_usd_total{%s} %.6f\n", labels, val))
	}

	return sb.String()
}
