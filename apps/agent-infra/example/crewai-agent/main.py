import os
import sys
import time
from flask import Flask, request, jsonify

# Import CrewAI modules
try:
    from crewai import Agent, Task, Crew, Process, LLM
    CREWAI_AVAILABLE = True
except ImportError:
    CREWAI_AVAILABLE = False

app = Flask(__name__)

# Determine the port to listen on.
# AgentOS orchestrator dynamically assigns a port and passes it via the PORT environment variable.
server_port = int(os.environ.get("PORT", 5000))

# Configure logging to write to stdout immediately for consolidations
sys.stdout.reconfigure(line_buffering=True) if hasattr(sys.stdout, "reconfigure") else None

@app.route("/health", methods=["GET"])
def check_health():
    """
    Standard readiness probe used by the AgentOS orchestrator scheduler.
    Returns a 200 OK once the web server is booted and ready to route requests.
    """
    return jsonify({
        "status": "healthy",
        "crewai_installed": CREWAI_AVAILABLE,
        "api_keys_present": bool(os.environ.get("GEMINI_API_KEY") or os.environ.get("OPENAI_API_KEY"))
    }), 200

@app.route("/invoke", methods=["GET", "POST"])
def run_agent():
    """
    Main invocation endpoint routed through the orchestrator reverse-proxy.
    Accepts input payload via either POST JSON body or GET query parameters.
    """
    # 1. Parse the request inputs (e.g. topic)
    input_data = {}
    if request.method == "POST":
        input_data = request.json or {}
    else:
        # Fallback to GET query parameters
        input_data = {key: value for key, value in request.args.items()}

    target_topic = input_data.get("topic", "AI Agent Orchestrator Platforms")
    
    print(f"[CrewAI Agent] Processing invocation request for topic: '{target_topic}'")

    # 2. Check for configured LLM API keys
    api_key_openai = os.environ.get("OPENAI_API_KEY")
    api_key_gemini = os.environ.get("GEMINI_API_KEY")

    # Check if we can run real CrewAI LLM kickoff
    if CREWAI_AVAILABLE and (api_key_openai or api_key_gemini):
        try:
            print("[CrewAI Agent] API Key detected. Initializing real CrewAI execution...")
            
            # Select appropriate LLM client
            if api_key_openai:
                print("[CrewAI Agent] Using OpenAI GPT-4o-mini LLM")
                configured_llm = LLM(model="gpt-4o-mini", api_key=api_key_openai)
            else:
                print("[CrewAI Agent] Using Google Gemini 1.5 Flash LLM")
                configured_llm = LLM(model="gemini/gemini-1.5-flash", api_key=api_key_gemini)

            # Define the Lead Researcher agent
            lead_researcher_agent = Agent(
                role="Lead AI Researcher",
                goal=f"Conduct thorough research and find key architectural components, usecases, and benefits of {target_topic}.",
                backstory="You are a senior technology analyst specializing in investigating cutting-edge AI systems.",
                verbose=True,
                allow_delegation=False,
                llm=configured_llm
            )

            # Define the Content Writer agent
            content_writer_agent = Agent(
                role="Technical Content Writer",
                goal=f"Write a clear, structured markdown summary of the research about {target_topic}.",
                backstory="You are a professional tech writer who specializes in making deep technical concepts easy to understand.",
                verbose=True,
                allow_delegation=False,
                llm=configured_llm
            )

            # Define the sequential tasks
            research_task = Task(
                description=f"Compile a structured bulleted summary of key facets, specifications, and architecture of: {target_topic}.",
                expected_output="A bulleted summary detailing core aspects.",
                agent=lead_researcher_agent
            )

            writing_task = Task(
                description=f"Format and expand the research findings on {target_topic} into a beautiful, publication-ready markdown article.",
                expected_output="A structured markdown article with headings, subheadings, and clear formatting.",
                agent=content_writer_agent
            )

            # Build and execute the crew
            collaborative_crew = Crew(
                agents=[lead_researcher_agent, content_writer_agent],
                tasks=[research_task, writing_task],
                process=Process.sequential,
                verbose=True
            )

            print("[CrewAI Agent] Starting CrewAI kickoff process...")
            agent_execution_output = collaborative_crew.kickoff()
            
            # Safely capture string output from KickoffResult
            response_text = str(agent_execution_output)
            print("[CrewAI Agent] CrewAI execution completed successfully.")

            return jsonify({
                "status": "success",
                "mode": "live_execution",
                "topic": target_topic,
                "response": response_text
            }), 200

        except Exception as execution_error:
            print(f"[CrewAI Agent] Live CrewAI execution failed: {execution_error}. Falling back to simulation.")
            # Fall through to simulation if live run errors out

    # 3. Simulation/Mock execution when offline or API keys are missing
    print("[CrewAI Agent] Running in Local Simulation Mode (Offline/No API Keys).")
    
    # Emulate agent print logs for stdout to show in the orchestrator console
    print("\n--------------------------------------------------")
    print(f" [SIMULATING CREWAI EXECUTION] Topic: {target_topic} ")
    print("--------------------------------------------------")
    print("[Agent Loop] Agent 'Lead AI Researcher' initialized.")
    print(f"[Agent Task] 'Lead AI Researcher' scanning concepts for: {target_topic}...")
    time.sleep(1.0)
    print("[Agent Output] Researcher gathered 5 key architectural components.")
    print("[Agent Loop] Agent 'Technical Content Writer' initialized.")
    print("[Agent Task] Writer combining research facts into markdown layout...")
    time.sleep(1.0)
    print("[Agent Output] Content Writer finalized article composition.")
    print("--------------------------------------------------\n")

    # Generate a beautiful simulated Markdown report based on the topic
    simulated_markdown = f"""# Comprehensive Guide on {target_topic}

## Executive Summary
This document provides a detailed, simulated assessment of **{target_topic}**, compiled collaboratively by the *Lead AI Researcher* and the *Technical Content Writer*.

## Key Architectural Pillars
1. **Core Service Manager**: Coordinates the configuration details, directories, and processes.
2. **Dynamic Placement Scheduler**: Determines hardware constraints, CPU baseline loads, and allocates port boundaries dynamically.
3. **Control Plane Gateway**: Bridges incoming user REST APIs, performs load balancing, and delegates traffic to active nodes.
4. **State Store persistence**: Emulates key-value caching (similar to Redis) and SQL database logging (similar to PostgreSQL).

## Main Advantages & Benefits
* **High Efficiency**: Automatic scale-to-zero terminates idle deployments after timeouts, saving system RAM.
* **Resilient Lifecycle**: Self-healing loops detect crashed process replicas and spawn new healthy instances.
* **Extensible Middleware**: Custom pub/sub Event Bus routes webhooks to active subscribers seamlessly.
* **Cost Tracking**: Active observability tracks CPU times, memory footprints, and simulated LLM token usage.

*Compiled dynamically by the local simulation engine on 2026-06-17.*
"""

    return jsonify({
        "status": "success",
        "mode": "simulated_fallback",
        "topic": target_topic,
        "response": simulated_markdown
    }), 200

if __name__ == "__main__":
    print(f"[CrewAI Agent] Server starting on http://localhost:{server_port}")
    app.run(host="0.0.0.0", port=server_port)
