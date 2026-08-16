# Inqora deployment

`k8s/` runs PostgreSQL, Redis, the Node API, RAG pipeline, web app, and the
workflow runner pool expected by the API.

## Local Kind cluster

```powershell
kind create cluster --name inqora --config deploy/kind/clusters.yml
docker compose build server rag-pipeline web
kind load docker-image inqora/server:local inqora/rag-pipeline:local inqora/web:local --name inqora
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.13.0/deploy/static/provider/kind/deploy.yaml
kubectl wait --namespace ingress-nginx --for=condition=ready pod --selector=app.kubernetes.io/component=controller --timeout=180s
kubectl apply -k deploy/k8s
kubectl rollout status deployment/server -n inqora
kubectl rollout status deployment/rag-pipeline -n inqora
kubectl rollout status deployment/web -n inqora
```

Open <http://localhost:8080>. Render manifests without applying them using
`kubectl kustomize deploy/k8s`.

For a shared or production cluster, replace `inqora-secrets` through External
Secrets, Sealed Secrets, or the cloud secret manager; use registry-hosted image
tags; and configure a real ingress hostname and TLS. Committed secret values are
intentionally non-secret local placeholders.

For Docker Compose, create a local `.env` from `.env.example`, supply the API
keys you use, and run `docker compose up --build`.
