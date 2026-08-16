import type { StepResult } from "../types/workflow.js"

const QUEUE_NAMESPACE = process.env.REDIS_QUEUE_PREFIX || `workflow:${process.pid}`
const RESULT_QUEUE_KEY = `${QUEUE_NAMESPACE}:result-queue`
const USE_REDIS = process.env.QUEUE_BACKEND?.trim().toLowerCase() === "redis"

console.log(USE_REDIS ? `Result queue (Redis): ${RESULT_QUEUE_KEY}` : "Result queue: in-memory")

async function getRedis() {
  return (await import("./redis-client.js")).redis
}

function parseStepResult(value: string): StepResult {
  return JSON.parse(value) as StepResult
}

export class ResultQueue {
  private readonly memoryQueue: StepResult[] = []
  private handler: ((result: StepResult) => Promise<void>) | undefined
  private draining = false

  async push(result: StepResult): Promise<void> {
    if (!USE_REDIS) {
      this.memoryQueue.push(result)
      await this.drainMemoryQueue()
      return
    }
    const redis = await getRedis()
    await redis.lpush(RESULT_QUEUE_KEY, JSON.stringify(result))
  }

  async consume(handler: (result: StepResult) => Promise<void>): Promise<void> {
    if (!USE_REDIS) {
      this.handler = handler
      await this.drainMemoryQueue()
      return
    }

    const redis = await getRedis()
    const subscriber = redis.duplicate()
    while (true) {
      const item = await subscriber.brpop(RESULT_QUEUE_KEY, 0)
      if (!item) continue
      await handler(parseStepResult(item[1]))
    }
  }

  private async drainMemoryQueue(): Promise<void> {
    if (this.draining || !this.handler) return
    this.draining = true
    try {
      while (this.memoryQueue.length > 0) {
        const result = this.memoryQueue.shift()
        if (result) await this.handler(result)
      }
    } finally {
      this.draining = false
    }
  }
}

export const resultQueue = new ResultQueue()
