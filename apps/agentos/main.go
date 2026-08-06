package main

import (
	"anishs1207/ai-infra/orchestrator"
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func startServer() {
	fmt.Println("==================================================")
	fmt.Println("             Starting AgentOS Engine              ")
	fmt.Println("==================================================")

	shutdownContext, stopSignalTrap := signal.NotifyContext(
		context.Background(),
		os.Interrupt,
		syscall.SIGTERM,
	)
	defer stopSignalTrap()

	// 1. Initialize the Port Allocator with a wide range of ports (10000 to 11000) for agent replicas.
	portAllocator := orchestrator.NewPortAllocator(10000, 11000)

	// 2. Initialize simulated Node fleet
	nodeManager := orchestrator.NewNodeManager()

	// 3. Initialize Secrets Manager
	secretsManager := orchestrator.NewSecretsManager()

	// 4. Initialize State Store (will probe local Postgres & Redis)
	stateStore := orchestrator.NewStateStore()

	// 5. Initialize Observability Metrics Tracker
	observability := orchestrator.NewObservabilityManager()

	// 6. Initialize Agent Registry and simulated Marketplace
	registry := orchestrator.NewAgentRegistry()
	marketplace := orchestrator.NewAgentMarketplace()

	// 7. Initialize the Scheduler which manages the actual-versus-desired replica states.
	scheduler := orchestrator.NewScheduler(portAllocator, nodeManager, secretsManager)

	// 8. Initialize the Job Queue with a buffer of 1000 enqueued tasks and 4 concurrent background worker threads.
	jobQueue := orchestrator.NewJobQueue(scheduler, 1000, 4)

	// 9. Initialize Event Bus
	eventBus := orchestrator.NewEventBus(scheduler)

	// 10. Initialize Workflow Engine
	workflowEngine := orchestrator.NewWorkflowEngine(jobQueue)

	// 11. Initialize the HTTP Proxy Router and the Management API Server.
	proxyHandler := orchestrator.NewProxyHandler(scheduler, observability)
	apiServer := orchestrator.NewAPIServer(
		scheduler,
		jobQueue,
		proxyHandler,
		nodeManager,
		secretsManager,
		eventBus,
		stateStore,
		workflowEngine,
		observability,
		registry,
		marketplace,
	)

	// --- START BACKGROUND ROUTINES ---

	// Monitor scale-to-zero for idle deployments.
	scheduler.StartScaleToZeroMonitor(shutdownContext)

	// Monitor multiple metrics (CPU, Memory, RPS, Tokens, Queue) for horizontal replica autoscaling.
	scheduler.StartMetricsAutoscaler(shutdownContext, observability, jobQueue)

	// Start async job processors.
	jobQueue.Start(shutdownContext)

	// Start the active background reconciliation loop to self-heal crashed replicas.
	scheduler.StartReconcilerLoop(shutdownContext)

	// 12. Instantiate ServeMux and register all API endpoint routes.
	serveMux := http.NewServeMux()
	apiServer.RegisterRoutes(serveMux)

	// Wrap serveMux in a CORS middleware handler to allow local frontend access and preflight requests
	corsHandler := http.HandlerFunc(func(responseWriter http.ResponseWriter, request *http.Request) {
		responseWriter.Header().Set("Access-Control-Allow-Origin", "*")
		responseWriter.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		responseWriter.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		// Immediately return with OK status if it is an OPTIONS preflight request
		if request.Method == "OPTIONS" {
			responseWriter.WriteHeader(http.StatusOK)
			return
		}
		serveMux.ServeHTTP(responseWriter, request)
	})

	httpServer := &http.Server{
		Addr:    ":8080",
		Handler: corsHandler,
	}

	// 13. Start the API Server.
	// as a go routine as well
	// can modfy it and use a better http lib like gin here for future use
	go func() {
		// to run here
		fmt.Printf("[AgentOS] Server listening at http://localhost:8080\n")
		// server started at localhost:8080 (prot)
		err := httpServer.ListenAndServe()

		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			// handle the errors here
			fmt.Printf("[AgentOS] Critical: HTTP server failed: %v\n", err)
			os.Exit(1)
		}
	}()

	// 14. Block execution until shutdown signal is received from the OS.
	<-shutdownContext.Done()
	fmt.Println("\n[AgentOS] Shutdown signal intercepted. Initiating cleanup sequence...")

	// 15. Shutdown the API server, allowing up to 5 seconds for existing requests to complete.
	cleanupContext, cancelCleanup := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancelCleanup()

	err := httpServer.Shutdown(cleanupContext)
	if err != nil {
		fmt.Printf("[AgentOS] Error shutting down API server: %v\n", err)
	}

	// 16. Forcefully terminate all running child process instances of deployed agents and free node resources.
	scheduler.StopAll()
	// to terminate all processes

	fmt.Println("[AgentOS] All processes terminated successfully. Shutdown complete.")
}
