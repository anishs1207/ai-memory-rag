import { z } from '@hono/zod-openapi'
import { createRoute } from '@hono/zod-openapi'
import { OpenAPIHono } from '@hono/zod-openapi'
import { serve } from '@hono/node-server'
import { swaggerUI } from '@hono/swagger-ui'

// --- SCHEMAS ---
const SuccessResponse = z.object({
  success: z.boolean().openapi({ example: true }),
  data: z.unknown().optional(),
}).openapi('SuccessResponse')

const ErrorResponse = z.object({
  success: z.boolean().openapi({ example: false }),
  error: z.string().openapi({ example: 'Something went wrong' })
}).openapi('ErrorResponse')

const ChatRequest = z.object({
  prompt: z.string().openapi({ example: 'Hello' })
}).openapi('ChatRequest')

const app = new OpenAPIHono()

// --- MESSAGE API ---
app.openapi(createRoute({
  method: 'post', path: '/api/v1/message/general',
  request: { body: { content: { 'application/json': { schema: ChatRequest } } } },
  responses: { 200: { content: { 'application/json': { schema: SuccessResponse } }, description: 'Success' } }
}), (c) => c.json({ success: true, data: 'Response' }, 200))

app.openapi(createRoute({
  method: 'post', path: '/api/v1/message/legal',
  request: { body: { content: { 'application/json': { schema: ChatRequest } } } },
  responses: { 200: { content: { 'application/json': { schema: SuccessResponse } }, description: 'Success' } }
}), (c) => c.json({ success: true, data: 'Response' }, 200))

app.openapi(createRoute({
  method: 'post', path: '/api/v1/message/finance',
  request: { body: { content: { 'application/json': { schema: ChatRequest } } } },
  responses: { 200: { content: { 'application/json': { schema: SuccessResponse } }, description: 'Success' } }
}), (c) => c.json({ success: true, data: 'Response' }, 200))

app.openapi(createRoute({
  method: 'get', path: '/api/v1/message/get-files',
  responses: { 200: { content: { 'application/json': { schema: SuccessResponse } }, description: 'Success' } }
}), (c) => c.json({ success: true, data: [] }, 200))

// --- MEMORY API ---
// Session management
app.openapi(createRoute({
  method: 'post', path: '/api/v1/memory/session',
  request: { body: { content: { 'application/json': { schema: z.object({ userId: z.string(), agentId: z.string().optional() }) } } } },
  responses: { 200: { content: { 'application/json': { schema: SuccessResponse } }, description: 'Success' } }
}), (c) => c.json({ success: true, data: {} }, 200))

app.openapi(createRoute({
  method: 'get', path: '/api/v1/memory/session/{sessionId}',
  request: { params: z.object({ sessionId: z.string() }) },
  responses: { 200: { content: { 'application/json': { schema: SuccessResponse } }, description: 'Success' } }
}), (c) => c.json({ success: true, data: {} }, 200))

// Orchestrator
app.openapi(createRoute({
  method: 'post', path: '/api/v1/memory/chat',
  request: { body: { content: { 'application/json': { schema: z.object({ userId: z.string(), sessionId: z.string(), userMessage: z.string() }) } } } },
  responses: { 200: { content: { 'application/json': { schema: SuccessResponse } }, description: 'Success' } }
}), (c) => c.json({ success: true, data: 'Chat response' }, 200))

// Knowledge Graph
app.openapi(createRoute({
  method: 'post', path: '/api/v1/memory/kg/node',
  request: { body: { content: { 'application/json': { schema: z.object({ userId: z.string(), label: z.string(), type: z.string() }) } } } },
  responses: { 200: { content: { 'application/json': { schema: SuccessResponse } }, description: 'Success' } }
}), (c) => c.json({ success: true, data: {} }, 200))

// --- PANEL API ---
app.openapi(createRoute({
  method: 'post', path: '/api/v1/panel/generate-personas',
  request: { body: { content: { 'application/json': { schema: z.object({ count: z.number() }) } } } },
  responses: { 200: { content: { 'application/json': { schema: SuccessResponse } }, description: 'Success' } }
}), (c) => c.json({ success: true, data: [] }, 200))

app.openapi(createRoute({
  method: 'post', path: '/api/v1/panel/conduct-election',
  request: { body: { content: { 'application/json': { schema: z.object({ agents: z.array(z.unknown()) }) } } } },
  responses: { 200: { content: { 'application/json': { schema: SuccessResponse } }, description: 'Success' } }
}), (c) => c.json({ success: true, data: {} }, 200))

app.get('/ui', swaggerUI({ url: '/doc' }))
app.doc('/doc', {
  openapi: '3.0.0',
  info: { version: '1.0.0', title: 'Memory-AI API Core' },
})

serve({ fetch: app.fetch, port: 8787 })
console.log('Running on http://localhost:8787')
export default app