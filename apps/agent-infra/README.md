┌────────────────────────┐
│ Agent Framework Layer  │
│                        │
│ LangGraph             │
│ CrewAI                │
│ OpenAI Agents         │
│ Mastra                │
└────────────┬───────────┘
             │

┌────────────▼───────────┐
│     AgentOS Runtime    │
└────────────┬───────────┘

      ┌──────┼──────┐
      │      │      │

 Scheduler Queue Memory

      │      │      │

      ▼      ▼      ▼

 Observability
 Deployments
 Scaling
 Secrets
 Auth
 Billing


 Agent deployment
Scheduling
Queueing
Worker orchestration
Memory infrastructure
Observability
Multi-tenant architecture
Secrets management
Autoscaling
Audit logs

                   AgentOS

┌───────────────────────────────────┐
│           Control Plane           │
└───────────────────────────────────┘

    Deploy
    Scale
    Configure
    Observe

                 │
                 ▼

┌───────────────────────────────────┐
│          Agent Registry           │
└───────────────────────────────────┘

Stores:

- Agent Metadata
- Versions
- Configs

                 │
                 ▼

┌───────────────────────────────────┐
│            Scheduler              │
└───────────────────────────────────┘

Creates Jobs

                 │
                 ▼

┌───────────────────────────────────┐
│             Queue                 │
└───────────────────────────────────┘

Stores Jobs

                 │
                 ▼

┌───────────────────────────────────┐
│           Worker Fleet            │
└───────────────────────────────────┘

Executes Agents

                 │
                 ▼

┌───────────────────────────────────┐
│         LangGraph Agent           │
│         CrewAI Agent              │
│      OpenAI SDK Agent             │
└───────────────────────────────────┘