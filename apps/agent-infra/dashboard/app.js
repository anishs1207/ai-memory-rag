/* ==========================================================================
   AGENTOS CLIENT MONITOR & CONTROLLER LOGIC
   Date: 2026-06-16
   ========================================================================== */

// Host Configuration
const API_BASE_URL = window.location.origin; // Same host since we serve static files from Go

// Global Application State variables
let activeAgentForLogs = null;
let activeAgentForTesting = null;
let activeTestMode = 'sync'; // 'sync' or 'async'
let activeJobPollingIntervalId = null;
let cachedDeploymentsList = [];
let cachedMarketplaceTemplates = [];
let logsPollingTimerId = null;

// Initialization on DOM Content Loaded
document.addEventListener('DOMContentLoaded', () => {
    // Start background polling routines
    initializeBackgroundPolling();

    // Bind event handlers for forms
    setupFormListeners();

    // Fetch initial templates & logs
    fetchMarketplaceTemplates();
    
    console.log("[AgentOS Console] Subsystem client controllers initialized successfully.");
});

// Setup Form Submission Handlers
function setupFormListeners() {
    // Deploy Manifest form
    const deployForm = document.getElementById('deploy-form');
    if (deployForm) {
        deployForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const manifestPathInput = document.getElementById('manifest-path');
            if (manifestPathInput) {
                deployNewAgent(manifestPathInput.value.trim());
            }
        });
    }

    // Secret Injector form
    const secretForm = document.getElementById('secret-form');
    if (secretForm) {
        secretForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const namespaceSelect = document.getElementById('secret-namespace');
            const secretKeyInput = document.getElementById('secret-key');
            const secretValueInput = document.getElementById('secret-val');
            
            if (namespaceSelect && secretKeyInput && secretValueInput) {
                injectRegistrySecret(
                    namespaceSelect.value, 
                    secretKeyInput.value.trim(), 
                    secretValueInput.value
                );
                // Clear fields
                secretKeyInput.value = '';
                secretValueInput.value = '';
            }
        });
    }

    // Clear log console button
    const clearLogButton = document.getElementById('btn-clear-logs');
    if (clearLogButton) {
        clearLogButton.addEventListener('click', () => {
            const terminalBody = document.getElementById('log-terminal-body');
            if (terminalBody) {
                terminalBody.innerHTML = '<div class="log-line system-line">[SYSTEM] Console buffer cleared.</div>';
            }
        });
    }
}

// Background Polling Coordination
function initializeBackgroundPolling() {
    // Fetch deployments immediately and poll every 3 seconds
    refreshDeployments();
    setInterval(refreshDeployments, 3000);

    // Fetch nodes immediately and poll every 5 seconds
    refreshClusterNodes();
    setInterval(refreshClusterNodes, 5000);

    // Fetch system costs immediately and poll every 5 seconds
    refreshSystemStats();
    setInterval(refreshSystemStats, 5000);

    // Setup active log polling routine
    setInterval(streamActiveLogs, 2500);
}

/* ==========================================================================
   API ACTION METHODS
   ========================================================================== */

// 1. Fetch active deployments
async function refreshDeployments() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/agents`);
        if (!response.ok) {
            throw new Error(`Orchestrator returned HTTP status ${response.status}`);
        }
        const deployments = await response.json();
        cachedDeploymentsList = deployments;
        
        // Update metric headers
        document.getElementById('server-status-text').textContent = 'ONLINE';
        document.getElementById('server-status-text').className = 'metric-value text-healthy';
        document.getElementById('server-status-dot').className = 'status-indicator blinking';

        document.getElementById('count-deployments').textContent = deployments.length;

        let totalReplicasCount = 0;
        deployments.forEach(deployment => {
            if (deployment.instances) {
                totalReplicasCount += deployment.instances.length;
            }
        });
        document.getElementById('count-replicas').textContent = totalReplicasCount;

        // Render cards
        renderDeploymentsFleet(deployments);
    } catch (error) {
        console.error("[AgentOS Console] Deployments fetch failure:", error);
        document.getElementById('server-status-text').textContent = 'OFFLINE';
        document.getElementById('server-status-text').className = 'metric-value text-error';
        document.getElementById('server-status-dot').className = 'status-indicator disconnected';
    }
}

// 2. Deploy a new agent
async function deployNewAgent(manifestPath) {
    const deployButton = document.getElementById('btn-deploy');
    const previousLabel = deployButton.textContent;
    deployButton.disabled = true;
    deployButton.textContent = 'DEPLOYING...';

    try {
        const response = await fetch(`${API_BASE_URL}/api/deploy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: manifestPath })
        });
        const result = await response.json();

        if (response.ok) {
            alert(`Deployment Triggered: ${result.message || 'Success'}`);
            refreshDeployments();
        } else {
            alert(`Deployment Failed: ${result.error || 'Server error'}`);
        }
    } catch (error) {
        alert(`Network error deploying agent: ${error.message}`);
    } finally {
        deployButton.disabled = false;
        deployButton.textContent = previousLabel;
    }
}

// 3. Undeploy an active agent
async function undeployAgent(agentName) {
    if (!confirm(`Are you sure you want to terminate and delete deployment '${agentName}'?`)) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/deploy/${agentName}`, {
            method: 'DELETE'
        });
        const result = await response.json();

        if (response.ok) {
            if (activeAgentForLogs === agentName) {
                activeAgentForLogs = null;
                document.getElementById('current-log-agent').textContent = 'NONE';
            }
            refreshDeployments();
        } else {
            alert(`Failed to undeploy agent: ${result.error || 'Server error'}`);
        }
    } catch (error) {
        alert(`Network error undeploying: ${error.message}`);
    }
}

// 4. Manually Scale Agent Replicas count
async function scaleAgentReplicas(agentName, desiredReplicas) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/agents/${agentName}/scale`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ replicas: parseInt(desiredReplicas, 10) })
        });
        const result = await response.json();

        if (response.ok) {
            refreshDeployments();
        } else {
            alert(`Scaling Failed: ${result.error || 'Server error'}`);
        }
    } catch (error) {
        alert(`Network error adjusting replicas: ${error.message}`);
    }
}

// 5. Inject registry secrets
async function injectRegistrySecret(namespace, key, value) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/secrets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ namespace, key, value })
        });
        const result = await response.json();

        if (response.ok) {
            alert(`Secret '${key}' successfully injected into namespace '${namespace}'.`);
        } else {
            alert(`Secrets injection failed: ${result.error || 'Server error'}`);
        }
    } catch (error) {
        alert(`Network error configuring secret: ${error.message}`);
    }
}

// 6. Fetch Marketplace Templates Catalog list
async function fetchMarketplaceTemplates() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/marketplace`);
        if (response.ok) {
            const templates = await response.json();
            cachedMarketplaceTemplates = templates;
            renderMarketplaceCatalog(templates);
        }
    } catch (error) {
        console.error("[AgentOS Console] Template marketplace fetch failure:", error);
    }
}

// 7. Install from Marketplace Catalog
async function installMarketplaceTemplate(templateName) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/marketplace/install`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: templateName })
        });
        const result = await response.json();

        if (response.ok) {
            alert(`Template ${templateName} registered successfully! Note: You can now deploy it from your workspace config path.`);
        } else {
            alert(`Failed installing template: ${result.error || 'Server error'}`);
        }
    } catch (error) {
        alert(`Network error during template install: ${error.message}`);
    }
}

// 8. Fetch Cluster Nodes status
async function refreshClusterNodes() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/nodes`);
        if (response.ok) {
            const nodes = await response.json();
            renderClusterNodesFleet(nodes);
        }
    } catch (error) {
        console.error("[AgentOS Console] Nodes fetch failure:", error);
    }
}

// 9. Fetch System Cost tracking stats and Observability CPU metrics
async function refreshSystemStats() {
    try {
        // Fetch costs
        const costResponse = await fetch(`${API_BASE_URL}/api/costs`);
        if (costResponse.ok) {
            const costData = await costResponse.json();
            const totalAccumulatedCost = costData.total_cost || 0;
            document.getElementById('system-costs').textContent = `$${totalAccumulatedCost.toFixed(5)}`;
        }
    } catch (error) {
        console.error("[AgentOS Console] Uptime/Stats fetch failure:", error);
    }
}

// 10. Fetch Logs and output to terminal console
async function fetchAndRenderLogs(agentName) {
    if (!agentName) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/agents/${agentName}/logs`);
        if (!response.ok) {
            throw new Error(`Orchestrator returned status ${response.status}`);
        }
        const logsPayload = await response.json();
        
        // Render logs in terminal
        const terminalBody = document.getElementById('log-terminal-body');
        if (!terminalBody) return;

        // Clear terminal first on agent switch
        if (activeAgentForLogs !== agentName) {
            activeAgentForLogs = agentName;
            document.getElementById('current-log-agent').textContent = agentName.toUpperCase();
            terminalBody.innerHTML = '';
        }

        let logLinesHTML = '';

        // Combine logs
        const activeInstances = logsPayload.active_instances || [];
        const pastInstances = logsPayload.history_instances || [];

        // Renders helper
        const addLogs = (instancesList, isPast) => {
            instancesList.forEach(inst => {
                const prefix = `[Instance ${inst.instance_id.substring(0, 8)}:${inst.port}]`;
                const logsText = inst.logs || '';
                
                if (logsText.trim() === '') {
                    logLinesHTML += `<div class="log-line system-line ${isPast ? 'past-line' : ''}">${prefix} -- Instance initialized, awaiting outputs --</div>`;
                    return;
                }

                // Split logs by newline
                const splitLines = logsText.split('\n');
                splitLines.forEach(line => {
                    if (line.trim() === '') return;

                    let lineClass = 'stdout-line';
                    if (line.includes('[stderr]') || line.toLowerCase().includes('error') || line.toLowerCase().includes('exception')) {
                        lineClass = 'stderr-line';
                    }
                    if (isPast) {
                        lineClass += ' past-line';
                    }

                    // Simple HTML sanitization
                    const cleanLine = line
                        .replace(/&/g, "&amp;")
                        .replace(/</g, "&lt;")
                        .replace(/>/g, "&gt;");

                    logLinesHTML += `<div class="log-line ${lineClass}">${prefix} ${cleanLine}</div>`;
                });
            });
        };

        addLogs(activeInstances, false);
        addLogs(pastInstances, true);

        if (logLinesHTML === '') {
            logLinesHTML = `<div class="log-line system-line">-- No replica outputs recorded for ${agentName} --</div>`;
        }

        terminalBody.innerHTML = logLinesHTML;

        // Auto Scroll
        const autoScrollCheck = document.getElementById('log-auto-scroll');
        if (autoScrollCheck && autoScrollCheck.checked) {
            terminalBody.scrollTop = terminalBody.scrollHeight;
        }

    } catch (error) {
        console.error("[AgentOS Console] Log streaming failure:", error);
    }
}

// Wrapper for periodic log polling
function streamActiveLogs() {
    const autoRefreshCheck = document.getElementById('log-auto-refresh');
    if (activeAgentForLogs && autoRefreshCheck && autoRefreshCheck.checked) {
        fetchAndRenderLogs(activeAgentForLogs);
    }
}

// Initialize logs streaming manually
function selectAgentLogs(agentName) {
    activeAgentForLogs = agentName;
    document.getElementById('current-log-agent').textContent = agentName.toUpperCase();
    const terminalBody = document.getElementById('log-terminal-body');
    if (terminalBody) {
        terminalBody.innerHTML = `<div class="log-line system-line">[SYSTEM] Fetching logs buffer for ${agentName}...</div>`;
    }
    fetchAndRenderLogs(agentName);
}


/* ==========================================================================
   UI RENDERING HELPERS
   ========================================================================= */

// Render Deployments Fleet cards list
function renderDeploymentsFleet(deployments) {
    const container = document.getElementById('deployments-container');
    if (!container) return;

    if (deployments.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No active deployments registered in the scheduler.</p>
                <p class="panel-description">Use the deployment console on the left to spin up your weather or calculator agents.</p>
            </div>
        `;
        return;
    }

    let html = '';
    deployments.forEach(agent => {
        const name = agent.name;
        const desired = agent.desired_replicas;
        const actual = agent.instances ? agent.instances.length : 0;
        const min = agent.min_replicas;
        const max = agent.max_replicas;
        const timeout = agent.idle_timeout || '30s';
        
        // Status Badge Logic
        let statusClass = 'text-healthy';
        let statusText = 'ACTIVE';

        if (desired === 0 && actual === 0) {
            statusClass = 'text-secondary';
            statusText = 'SCALED_TO_ZERO';
        } else if (actual < desired) {
            statusClass = 'text-warn';
            statusText = 'SCALING_UP';
        }

        html += `
            <div class="agent-card">
                <!-- Card Header -->
                <div class="agent-card-header">
                    <div class="agent-info">
                        <span class="agent-name">${name}</span>
                        <span class="agent-cmd">CMD: ${agent.command}</span>
                    </div>
                    <span class="agent-status-badge ${statusClass}">${statusText}</span>
                </div>
                
                <!-- Card Body -->
                <div class="agent-card-body">
                    <!-- Resource spec indicators -->
                    <div class="agent-meta-specs">
                        <div class="spec-item">
                            <span class="spec-label">Replicas</span>
                            <span class="spec-value text-accent">${actual} / ${desired}</span>
                        </div>
                        <div class="spec-item">
                            <span class="spec-label">Scale Boundaries</span>
                            <span class="spec-value">${min} min / ${max} max</span>
                        </div>
                        <div class="spec-item">
                            <span class="spec-label">Scale-to-Zero Timeout</span>
                            <span class="spec-value">${timeout}</span>
                        </div>
                    </div>

                    <!-- Replica details list -->
                    <div class="instances-section">
                        <span class="instances-title">Running Fleet Replicas</span>
                        <div class="instances-list">
        `;

        if (agent.instances && agent.instances.length > 0) {
            agent.instances.forEach(instance => {
                const formattedTime = new Date(instance.started_at).toLocaleTimeString();
                html += `
                    <div class="instance-row">
                        <span class="inst-id">ID: ${instance.id.substring(0, 8)}...</span>
                        <span class="inst-port">Port: ${instance.port}</span>
                        <span class="inst-time">Started: ${formattedTime}</span>
                        <span class="inst-status ${instance.status}">${instance.status}</span>
                    </div>
                `;
            });
        } else {
            html += `<div class="empty-state" style="min-height: 40px; font-size: 0.75rem;">No active running containers.</div>`;
        }

        html += `
                        </div>
                    </div>

                    <!-- Interactions & Scale Control Buttons -->
                    <div class="agent-card-actions">
                        <div class="scale-input-group">
                            <button onclick="changeReplicaInput('${name}', -1)">-</button>
                            <input type="text" id="scale-input-${name}" value="${desired}" readonly>
                            <button onclick="changeReplicaInput('${name}', 1)">+</button>
                        </div>
                        <button class="btn btn-secondary btn-sm" onclick="scaleAgentReplicas('${name}', document.getElementById('scale-input-${name}').value)">SCALE</button>
                        <button class="btn btn-secondary btn-sm" onclick="selectAgentLogs('${name}')">VIEW LOGS</button>
                        <button class="btn btn-primary btn-sm" onclick="openTestRunner('${name}')">TEST AGENT</button>
                        <button class="btn btn-danger btn-sm" onclick="undeployAgent('${name}')" style="margin-left: auto;">UNDEPLOY</button>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// Adjust local replica slider value
function changeReplicaInput(agentName, delta) {
    const input = document.getElementById(`scale-input-${agentName}`);
    if (input) {
        let val = parseInt(input.value, 10) || 0;
        val = Math.max(0, val + delta); // Avoid negative
        input.value = val;
    }
}

// Render Cluster Nodes list
function renderClusterNodesFleet(nodes) {
    const container = document.getElementById('nodes-container');
    if (!container) return;

    if (!nodes || nodes.length === 0) {
        container.innerHTML = `<div class="empty-state">No active cluster node workers detected.</div>`;
        return;
    }

    let html = '';
    nodes.forEach(node => {
        const gpuBadge = node.gpu ? '<span class="text-accent" style="font-size:0.65rem; border:1px solid currentColor; padding:1px 3px; border-radius:2px; margin-left:5px;">GPU</span>' : '';
        html += `
            <div class="node-card">
                <div class="node-card-header">
                    <span>NODE_//_${node.id.substring(0, 8)}</span>
                    <span class="text-healthy">${node.status || 'READY'}</span>
                </div>
                <div class="node-details">
                    <div>Region: <span class="text-accent">${node.region || 'local'}</span></div>
                    <div>Load: <span>${node.active_replicas || 0} pods</span></div>
                    <div>Mem: <span>${node.memory_used || '0'} / ${node.memory_total || '16Gi'}</span></div>
                </div>
                <div style="font-size: 0.65rem; color:var(--color-text-secondary); margin-top:4px;">
                    GPU Hardware: ${gpuBadge ? 'ENABLED' + gpuBadge : 'NONE'}
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

// Render Templates catalog list
function renderMarketplaceCatalog(templates) {
    const container = document.getElementById('marketplace-container');
    if (!container) return;

    if (templates.length === 0) {
        container.innerHTML = `<div class="empty-state">No app templates seeded in marketplace catalog.</div>`;
        return;
    }

    let html = '';
    templates.forEach(tmpl => {
        html += `
            <div class="marketplace-item">
                <div class="marketplace-meta">
                    <h3>${tmpl.name}</h3>
                    <span>v${tmpl.version}</span>
                </div>
                <p>${tmpl.description}</p>
                <div class="marketplace-meta" style="align-items: center;">
                    <span>Runtime: <code class="text-accent">${tmpl.runtime}</code></span>
                    <button class="btn btn-secondary btn-xs" onclick="installMarketplaceTemplate('${tmpl.name}')">REGISTER</button>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

// Preset Deploy Quick Filler
function fillDeployPath(path) {
    const input = document.getElementById('manifest-path');
    if (input) {
        input.value = path;
    }
}


/* ==========================================================================
   AGENT TEST RUNNER INTERACTIVE MODAL CONTROLS
   ========================================================================== */

// Open test runner modal and populate layouts
function openTestRunner(agentName) {
    activeAgentForTesting = agentName;
    document.getElementById('test-agent-name').textContent = agentName;
    
    // Clear outputs
    document.getElementById('response-output-code').textContent = '{\n  "status": "ready",\n  "message": "Specify arguments and click Dispatch Invocation to send requests"\n}';
    document.getElementById('job-progress-stepper').style.display = 'none';

    // Clear any active polling timers
    if (activeJobPollingIntervalId) {
        clearInterval(activeJobPollingIntervalId);
        activeJobPollingIntervalId = null;
    }

    // Toggle forms
    document.getElementById('test-form-weather').style.display = 'none';
    document.getElementById('test-form-calculator').style.display = 'none';
    document.getElementById('test-form-generic').style.display = 'none';

    if (agentName === 'weather-agent') {
        document.getElementById('test-form-weather').style.display = 'block';
    } else if (agentName === 'calculator-agent') {
        document.getElementById('test-form-calculator').style.display = 'block';
    } else {
        document.getElementById('test-form-generic').style.display = 'block';
    }

    // Display modal
    document.getElementById('test-modal').classList.add('open');
}

// Close test runner modal
function closeTestRunner() {
    document.getElementById('test-modal').classList.remove('open');
    if (activeJobPollingIntervalId) {
        clearInterval(activeJobPollingIntervalId);
        activeJobPollingIntervalId = null;
    }
}

// Toggle strategy Mode
function setTestMode(mode) {
    activeTestMode = mode;
    
    const syncBtn = document.getElementById('btn-mode-sync');
    const asyncBtn = document.getElementById('btn-mode-async');
    
    if (mode === 'sync') {
        syncBtn.classList.add('active');
        asyncBtn.classList.remove('active');
        document.getElementById('job-progress-stepper').style.display = 'none';
    } else {
        syncBtn.classList.remove('active');
        asyncBtn.classList.add('active');
    }
}

// Add row to generic params builder
function addParamRow() {
    const list = document.getElementById('generic-params-list');
    if (list) {
        const div = document.createElement('div');
        div.className = 'param-row';
        div.innerHTML = `
            <input type="text" class="param-key" placeholder="Key">
            <input type="text" class="param-val" placeholder="Value">
            <button type="button" class="btn-remove-param" onclick="removeParamRow(this)">&times;</button>
        `;
        list.appendChild(div);
    }
}

// Remove row from generic params builder
function removeParamRow(button) {
    button.parentElement.remove();
}

// Dispatch request to test agent
async function triggerAgentTest() {
    const agentName = activeAgentForTesting;
    if (!agentName) return;

    // Clear output console
    const consoleOutputElement = document.getElementById('response-output-code');
    consoleOutputElement.textContent = 'Dispaching request to cluster...';
    
    if (activeJobPollingIntervalId) {
        clearInterval(activeJobPollingIntervalId);
        activeJobPollingIntervalId = null;
    }

    // 1. Gather parameters from the active form
    const inputParams = {};
    let subpath = '/invoke';

    if (agentName === 'weather-agent') {
        const cityInput = document.getElementById('weather-city');
        inputParams.city = cityInput ? cityInput.value.trim() : 'Seattle';
    } else if (agentName === 'calculator-agent') {
        const num1Input = document.getElementById('calc-num1');
        const num2Input = document.getElementById('calc-num2');
        const opSelect = document.getElementById('calc-op');

        inputParams.num1 = num1Input ? num1Input.value : '0';
        inputParams.num2 = num2Input ? num2Input.value : '0';
        inputParams.op = opSelect ? opSelect.value : 'add';
    } else {
        const pathInput = document.getElementById('generic-path');
        if (pathInput) subpath = pathInput.value.trim();

        const rows = document.querySelectorAll('.param-row');
        rows.forEach(row => {
            const k = row.querySelector('.param-key').value.trim();
            const v = row.querySelector('.param-val').value.trim();
            if (k) {
                inputParams[k] = v;
            }
        });
    }

    // Disable dispatch button during start
    const dispatchButton = document.getElementById('btn-run-test');
    dispatchButton.disabled = true;

    if (activeTestMode === 'sync') {
        // Direct proxy execution
        document.getElementById('job-progress-stepper').style.display = 'none';

        // Construct query parameters
        const queryParams = new URLSearchParams();
        for (const [key, value] of Object.entries(inputParams)) {
            queryParams.append(key, value);
        }

        const targetURL = `${API_BASE_URL}/proxy/${agentName}${subpath}?${queryParams.toString()}`;
        console.log(`[AgentOS Console] Proxying request to: ${targetURL}`);

        try {
            const startTime = performance.now();
            const response = await fetch(targetURL);
            const duration = (performance.now() - startTime).toFixed(0);
            
            const rawBody = await response.text();
            let parsedJson;
            try {
                parsedJson = JSON.parse(rawBody);
            } catch (e) {
                parsedJson = rawBody; // Fallback to raw text if not JSON
            }

            consoleOutputElement.textContent = JSON.stringify({
                _metadata: {
                    request_url: targetURL,
                    http_status: response.status,
                    latency_ms: parseInt(duration, 10)
                },
                response: parsedJson
            }, null, 2);
        } catch (error) {
            consoleOutputElement.textContent = JSON.stringify({
                error: "Proxy invocation connection failed",
                details: error.message
            }, null, 2);
        } finally {
            dispatchButton.disabled = false;
        }
    } else {
        // Asynchronous Job Queue Submit
        const stepper = document.getElementById('job-progress-stepper');
        stepper.style.display = 'flex';
        
        // Reset steps
        resetJobProgressSteps();
        setStepState('queued', 'active', 'Submitting job request...');

        try {
            const enqueueResponse = await fetch(`${API_BASE_URL}/api/agents/${agentName}/jobs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(inputParams)
            });
            const enqueueResult = await enqueueResponse.json();

            if (!enqueueResponse.ok) {
                throw new Error(enqueueResult.error || `Enqueue failure status ${enqueueResponse.status}`);
            }

            const jobID = enqueueResult.job_id;
            document.getElementById('step-queued-desc').textContent = `Enqueued ID: ${jobID.substring(0, 8)}...`;
            setStepState('queued', 'completed');
            setStepState('running', 'active', 'Awaiting worker execution...');

            consoleOutputElement.textContent = JSON.stringify({
                message: "Asynchronous job enqueued. Waiting for completion...",
                job_id: jobID
            }, null, 2);

            // Start polling for job results
            pollJobStatus(jobID, consoleOutputElement, dispatchButton);
        } catch (error) {
            setStepState('queued', 'failed', error.message);
            consoleOutputElement.textContent = JSON.stringify({
                status: "SUBMISSION_FAILED",
                error: error.message
            }, null, 2);
            dispatchButton.disabled = false;
        }
    }
}

// Poll Asynchronous Job Status
function pollJobStatus(jobID, consoleOutputElement, dispatchButton) {
    const startTime = Date.now();
    activeJobPollingIntervalId = setInterval(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/jobs/${jobID}`);
            if (!response.ok) {
                throw new Error(`Polling status request returned ${response.status}`);
            }
            
            const job = await response.json();
            
            // Render outputs and updates
            consoleOutputElement.textContent = JSON.stringify(job, null, 2);

            if (job.status === 'RUNNING') {
                setStepState('queued', 'completed');
                setStepState('running', 'active', `Running for ${((Date.now() - startTime)/1000).toFixed(0)}s...`);
            } else if (job.status === 'COMPLETED') {
                clearInterval(activeJobPollingIntervalId);
                activeJobPollingIntervalId = null;

                setStepState('queued', 'completed');
                setStepState('running', 'completed');
                setStepState('finished', 'completed', `Completed successfully!`);
                dispatchButton.disabled = false;
            } else if (job.status === 'FAILED') {
                clearInterval(activeJobPollingIntervalId);
                activeJobPollingIntervalId = null;

                setStepState('queued', 'completed');
                setStepState('running', 'completed');
                setStepState('finished', 'failed', job.error || 'Execution failed');
                dispatchButton.disabled = false;
            }
        } catch (error) {
            clearInterval(activeJobPollingIntervalId);
            activeJobPollingIntervalId = null;

            setStepState('running', 'failed', error.message);
            consoleOutputElement.textContent = JSON.stringify({
                status: "POLLING_FAILED",
                error: error.message
            }, null, 2);
            dispatchButton.disabled = false;
        }
    }, 1000); // Poll every 1 second
}

// Reset async job steps
function resetJobProgressSteps() {
    const steps = ['queued', 'running', 'finished'];
    steps.forEach(step => {
        const el = document.getElementById(`step-${step}`);
        el.className = 'step-indicator';
        el.querySelector('.step-desc').textContent = '';
    });
    
    document.getElementById('step-queued-desc').textContent = 'Pending submission';
    document.getElementById('step-running-desc').textContent = 'Awaiting worker';
    document.getElementById('step-finished-title').textContent = 'COMPLETED';
    document.getElementById('step-finished-desc').textContent = 'Awaiting output';
}

// Set state on step indicator
function setStepState(stepName, state, description = '') {
    const el = document.getElementById(`step-${stepName}`);
    if (el) {
        el.className = `step-indicator ${state}`;
        if (description) {
            el.querySelector('.step-desc').textContent = description;
        }
        if (state === 'failed') {
            if (stepName === 'finished') {
                document.getElementById('step-finished-title').textContent = 'FAILED';
            }
        }
    }
}
