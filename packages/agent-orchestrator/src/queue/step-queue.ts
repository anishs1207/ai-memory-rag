import type { QueuedStep } from "../types/workflow.js"

const QUEUE_NAMESPACE = process.env.REDIS_QUEUE_PREFIX || `workflow:${process.pid}`
const STEP_QUEUE_KEY = `${QUEUE_NAMESPACE}:step-queue`
const USE_REDIS = process.env.QUEUE_BACKEND?.trim().toLowerCase() === "redis"

console.log(USE_REDIS ? `Step queue (Redis): ${STEP_QUEUE_KEY}` : "Step queue: in-memory")

async function getRedis() {
  return (await import("./redis-client.js")).redis
}

function parseQueuedStep(value: string): QueuedStep {
  return JSON.parse(value) as QueuedStep
}

export class StepQueue {
  private readonly memoryQueue: QueuedStep[] = []

  async enqueue(step: QueuedStep): Promise<void> {
    if (!USE_REDIS) {
      this.memoryQueue.push(step)
      return
    }
    const redis = await getRedis()
    await redis.lpush(STEP_QUEUE_KEY, JSON.stringify(step))
  }

  async dequeue(): Promise<QueuedStep | null> {
    if (!USE_REDIS) return this.memoryQueue.shift() ?? null
    const redis = await getRedis()
    const value = await redis.rpop(STEP_QUEUE_KEY)
    return value ? parseQueuedStep(value) : null
  }

  async peek(): Promise<QueuedStep | null> {
    if (!USE_REDIS) return this.memoryQueue[0] ?? null
    const redis = await getRedis()
    const values = await redis.lrange(STEP_QUEUE_KEY, -1, -1)
    return values[0] ? parseQueuedStep(values[0]) : null
  }

  async size(): Promise<number> {
    if (!USE_REDIS) return this.memoryQueue.length
    const redis = await getRedis()
    return redis.llen(STEP_QUEUE_KEY)
  }
}

export const stepQueue = new StepQueue()
