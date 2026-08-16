process.env.EXECUTION_BACKEND = "local"
process.env.QUEUE_BACKEND = "memory"

const { getWorkflow, orchestrator, runnerPool } = await import("../dist/index.js")

if (runnerPool.mode !== "local") throw new Error(`Expected local runner, got ${runnerPool.mode}`)

await orchestrator.start()
await orchestrator.submitWorkflow({
  workflowId: "local-mode-smoke",
  steps: [{
    id: "execute-locally",
    command: `node -e "process.stdout.write('LOCAL_WORKFLOW_OK')"`,
  }],
})

const deadline = Date.now() + 5_000
let state
while (Date.now() < deadline) {
  state = getWorkflow("local-mode-smoke")
  if (state?.status === "completed" || state?.status === "failed") break
  await new Promise((resolve) => setTimeout(resolve, 25))
}

const step = state?.stepState["execute-locally"]
if (state?.status !== "completed" || step?.stdout !== "LOCAL_WORKFLOW_OK") {
  throw new Error(`Local workflow failed: ${JSON.stringify(state)}`)
}

console.log("Local workflow completed without Kubernetes or Redis")
process.exit(0)
