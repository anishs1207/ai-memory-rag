package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	fmt.Println("==================================================")
	fmt.Println("             Starting AgentOS Engine              ")
	fmt.Println("==================================================")

	// Trap SIGINT and SIGTERM to handle graceful shutdown and terminate child processes.
	shutdownContext, stopSignalTrap := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stopSignalTrap()

	// 1. Initialize the Port Allocator with a wide range of ports (10000 to 11000) for agent replicas.
	portAllocator := NewPortAllocator(10000, 11000)

	// 2. Initialize the Scheduler which manages the actual-versus-desired replica states.
	scheduler := NewScheduler(portAllocator)

	// 3. Initialize the Job Queue with a buffer of 1000 enqueued tasks and 4 concurrent background worker threads.
	jobQueue := NewJobQueue(scheduler, 1000, 4)

	// 4. Initialize the HTTP Proxy Router and the Management API Server.
	proxyHandler := NewProxyHandler(scheduler)
	apiServer := NewAPIServer(scheduler, jobQueue, proxyHandler)

	// 5. Start background routines.
	// Monitor scale-to-zero for idle deployments.
	scheduler.StartScaleToZeroMonitor(shutdownContext)
	// Monitor queue depth for horizontal replica autoscaling.
	scheduler.StartQueueAutoscaler(shutdownContext, jobQueue)
	// Start async job processors.
	jobQueue.Start(shutdownContext)

	// 6. Instantiate ServeMux and register all API endpoint routes.
	serveMux := http.NewServeMux()
	apiServer.RegisterRoutes(serveMux)

	httpServer := &http.Server{
		Addr:    ":8080",
		Handler: serveMux,
	}

	// 7. Start the API Server.
	go func() {
		fmt.Printf("[AgentOS] Server listening at http://localhost:8080\n")
		err := httpServer.ListenAndServe()
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			fmt.Printf("[AgentOS] Critical: HTTP server failed: %v\n", err)
			os.Exit(1)
		}
	}()

	// 8. Block execution until shutdown signal is received from the OS.
	<-shutdownContext.Done()
	fmt.Println("\n[AgentOS] Shutdown signal intercepted. Initiating cleanup sequence...")

	// 9. Shutdown the API server, allowing up to 5 seconds for existing requests to complete.
	cleanupContext, cancelCleanup := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancelCleanup()
	
	err := httpServer.Shutdown(cleanupContext)
	if err != nil {
		fmt.Printf("[AgentOS] Error shutting down API server: %v\n", err)
	}

	// 10. Forcefully terminate all running child process instances of deployed agents.
	scheduler.StopAll()

	fmt.Println("[AgentOS] All processes terminated successfully. Shutdown complete.")
}
