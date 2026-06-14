package main

import (
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
)

//////////////////////////////////////////////////////////
// JOBS
//////////////////////////////////////////////////////////

type Status string

const (
	Pending   Status = "PENDING"
	Running   Status = "RUNNING"
	Failed    Status = "FAILED"
	Completed Status = "COMPLETED"
)

type Job struct {
	ID      string
	AgentID string
	Status  Status
}

//////////////////////////////////////////////////////////
// QUEUE
//////////////////////////////////////////////////////////

type Queue struct {
	jobs chan Job
}

func NewQueue(size int) *Queue {
	return &Queue{
		jobs: make(chan Job, size),
	}
}

func (q *Queue) Push(job Job) {
	q.jobs <- job
}

func (q *Queue) Pop() Job {
	return <-q.jobs
}

//////////////////////////////////////////////////////////
// RUNTIME
//////////////////////////////////////////////////////////

type Runtime struct{}

func (r *Runtime) Execute(job Job) error {

	fmt.Printf(
		"[Runtime] Executing Job=%s Agent=%s\n",
		job.ID,
		job.AgentID,
	)

	time.Sleep(2 * time.Second)

	return nil
}

//////////////////////////////////////////////////////////
// WORKER
//////////////////////////////////////////////////////////

type Worker struct {
	ID      int
	Queue   *Queue
	Runtime *Runtime
}

func (w *Worker) Start(wg *sync.WaitGroup) {

	go func() {

		for {

			job := w.Queue.Pop()

			job.Status = Running

			fmt.Printf(
				"[Worker %d] Picked Job %s\n",
				w.ID,
				job.ID,
			)

			err := w.Runtime.Execute(job)

			if err != nil {

				job.Status = Failed

				fmt.Printf(
					"[Worker %d] Job Failed %s\n",
					w.ID,
					job.ID,
				)

				continue
			}

			job.Status = Completed

			fmt.Printf(
				"[Worker %d] Job Completed %s\n",
				w.ID,
				job.ID,
			)

			wg.Done()
		}
	}()
}

//////////////////////////////////////////////////////////
// MAIN
//////////////////////////////////////////////////////////

func main() {

	queue := NewQueue(100)

	runtime := &Runtime{}

	var wg sync.WaitGroup

	worker1 := Worker{
		ID:      1,
		Queue:   queue,
		Runtime: runtime,
	}

	worker2 := Worker{
		ID:      2,
		Queue:   queue,
		Runtime: runtime,
	}

	worker1.Start(&wg)
	worker2.Start(&wg)

	fmt.Println("Creating Jobs...")

	for i := 0; i < 10; i++ {

		wg.Add(1)

		queue.Push(Job{
			ID:      uuid.New().String(),
			AgentID: "research-agent",
			Status:  Pending,
		})
	}

	wg.Wait()

	fmt.Println("All Jobs Finished")
}
