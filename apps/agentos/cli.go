package main

import (
	"anishs1207/ai-infra/orchestrator"
	"bytes"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

const version = "0.1.0"
const helpText = "AgentOS runs local AI agents described by YAML manifests.\n\nUsage:\n  agentos run [agent.yaml ...]              Start AgentOS and optionally deploy manifests\n  agentos deploy [options] <agent.yaml>     Deploy an agent on a running AgentOS\n  agentos agents [options]                  List deployed agents and replicas\n  agentos status [options]                  Check whether AgentOS is reachable\n  agentos stats [options] [agent]           Show measured request metrics\n  agentos logs [options] <agent>            Show agent process output\n  agentos scale [options] <agent> <count>   Change desired replicas\n  agentos undeploy [options] <agent>        Stop and remove an agent\n  agentos version                           Print the version\n  agentos help                              Show this help\n\nClient option:\n  --server URL   AgentOS URL (default http://localhost:8080 or AGENTOS_SERVER)\n\nA manifest supplies the agent name, working directory, start command, environment,\nand replica limits. AgentOS starts it locally, injects PORT, health-checks it, and\nproxies calls through /proxy/<agent>/.\n"

func main() { 
	os.Exit(execute(os.Args[1:], os.Stdout, os.Stderr)) 
}

func execute(a []string, out, er io.Writer) int {
	if len(a) == 0 || a[0] == "help" || a[0] == "--help" || a[0] == "-h" {
		fmt.Fprint(out, helpText)
		return 0
	}
	if a[0] == "version" || a[0] == "--version" {
		fmt.Fprintf(out, "agentos %s\n", version)
		return 0
	}
	if a[0] == "--run" {
		a[0] = "run"
	}
	if a[0] == "run" {
		for _, p := range a[1:] {
			if _, e := orchestrator.ParseManifest(p); e != nil {
				fmt.Fprintf(er, "agentos: invalid manifest %q: %v\n", p, e)
				return 1
			}
		}
		if len(a) > 1 {
			go deployWhenReady(a[1:], er)
		}
		startServer()
		return 0
	}
	known := map[string]bool{"deploy": true, "agents": true, "status": true, "stats": true, "logs": true, "scale": true, "undeploy": true}
	if !known[a[0]] {
		fmt.Fprintf(er, "agentos: unknown command %q\n\n%s", a[0], helpText)
		return 2
	}
	if e := runClient(a[0], a[1:], out, er); e != nil {
		fmt.Fprintf(er, "agentos: %v\n", e)
		return 1
	}
	return 0
}
func deployWhenReady(paths []string, er io.Writer) {
	for i := 0; i < 100; i++ {
		r, e := http.Get("http://localhost:8080/api/health")
		if e == nil {
			r.Body.Close()
			if r.StatusCode == 200 {
				break
			}
		}
		time.Sleep(100 * time.Millisecond)
	}
	for _, p := range paths {
		abs, _ := filepath.Abs(p)
		e := requestJSON("POST", "http://localhost:8080/api/deploy", map[string]string{"path": abs}, io.Discard)
		if e != nil {
			fmt.Fprintf(er, "agentos: deploy %q: %v\n", p, e)
		} else {
			fmt.Fprintf(er, "[AgentOS] Deployed %s\n", abs)
		}
	}
}
func runClient(cmd string, a []string, out, er io.Writer) error {
	f := flag.NewFlagSet(cmd, flag.ContinueOnError)
	f.SetOutput(er)
	d := strings.TrimSpace(os.Getenv("AGENTOS_SERVER"))
	if d == "" {
		d = "http://localhost:8080"
	}
	server := f.String("server", d, "AgentOS server URL")
	if e := f.Parse(a); e != nil {
		return e
	}
	base := strings.TrimRight(*server, "/")
	u, e := url.ParseRequestURI(base)
	if e != nil || (u.Scheme != "http" && u.Scheme != "https") {
		return fmt.Errorf("invalid --server URL %q", base)
	}
	var method, ep string
	var body any
	switch cmd {
	case "deploy":
		if f.NArg() != 1 {
			return errors.New("usage: agentos deploy [--server URL] <agent.yaml>")
		}
		abs, e := filepath.Abs(f.Arg(0))
		if e != nil {
			return e
		}
		if _, e = orchestrator.ParseManifest(abs); e != nil {
			return fmt.Errorf("invalid manifest: %w", e)
		}
		method, ep, body = "POST", "/api/deploy", map[string]string{"path": abs}
	case "agents":
		if f.NArg() != 0 {
			return errors.New("usage: agentos agents [--server URL]")
		}
		method, ep = "GET", "/api/agents"
	case "status":
		if f.NArg() != 0 {
			return errors.New("usage: agentos status [--server URL]")
		}
		method, ep = "GET", "/api/health"
	case "stats":
		if f.NArg() > 1 {
			return errors.New("usage: agentos stats [--server URL] [agent]")
		}
		method, ep = "GET", "/api/observability/stats"
		if f.NArg() == 1 {
			ep += "?agent=" + url.QueryEscape(f.Arg(0))
		}
	case "logs":
		if f.NArg() != 1 {
			return errors.New("usage: agentos logs [--server URL] <agent>")
		}
		method, ep = "GET", "/api/agents/"+url.PathEscape(f.Arg(0))+"/logs"
	case "scale":
		if f.NArg() != 2 {
			return errors.New("usage: agentos scale [--server URL] <agent> <count>")
		}
		n, e := strconv.Atoi(f.Arg(1))
		if e != nil || n < 0 {
			return errors.New("replica count must be a non-negative integer")
		}
		method, ep, body = "POST", "/api/agents/"+url.PathEscape(f.Arg(0))+"/scale", map[string]int{"replicas": n}
	case "undeploy":
		if f.NArg() != 1 {
			return errors.New("usage: agentos undeploy [--server URL] <agent>")
		}
		method, ep = "DELETE", "/api/deploy/"+url.PathEscape(f.Arg(0))
	}
	return requestJSON(method, base+ep, body, out)
}
func requestJSON(method, endpoint string, body any, out io.Writer) error {
	var rd io.Reader
	if body != nil {
		b, e := json.Marshal(body)
		if e != nil {
			return e
		}
		rd = bytes.NewReader(b)
	}
	q, e := http.NewRequest(method, endpoint, rd)
	if e != nil {
		return e
	}
	if body != nil {
		q.Header.Set("Content-Type", "application/json")
	}
	r, e := (&http.Client{Timeout: 10 * time.Second}).Do(q)
	if e != nil {
		return fmt.Errorf("cannot reach server (is 'agentos run' running?): %w", e)
	}
	defer r.Body.Close()
	b, e := io.ReadAll(r.Body)
	if e != nil {
		return e
	}
	if r.StatusCode < 200 || r.StatusCode > 299 {
		return fmt.Errorf("server returned %s: %s", r.Status, strings.TrimSpace(string(b)))
	}
	var v any
	if json.Unmarshal(b, &v) == nil {
		p, _ := json.MarshalIndent(v, "", "  ")
		fmt.Fprintf(out, "%s\n", p)
	} else {
		fmt.Fprintf(out, "%s\n", bytes.TrimSpace(b))
	}
	return nil
}
