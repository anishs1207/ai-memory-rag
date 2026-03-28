import { Hono } from 'hono'

const app = new Hono()

// https://anishsab.workers.dev.

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.get('/api/user', (c) => {
  return c.json({
    name: 'Anish',
    role: 'Developer'
  })
})

app.get('/api/greet/:name', (c) => {
  const name = c.req.param('name')
  return c.text(`Hello ${name} 👋`)
})

export default app
