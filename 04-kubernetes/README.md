# Module 04 — Kubernetes: Running, Healing & Scaling

## Objectives
By the end of this module you will have:
- Loaded your Docker image into a local Kubernetes cluster
- Written your own Deployment and Service manifests
- Watched Kubernetes automatically replace a Pod you killed yourself
- Performed a zero-downtime rolling update
- Configured autoscaling and driven it with real load

## Time Estimate: ~120 minutes

## Prerequisites
- Modules 00–02 complete (a `devops-workshop-app:v2` image built locally)
- A running `kind` cluster named `devops-workshop` (created in Module 00)

---

## Concepts Recap

You declare a **desired state** ("3 healthy copies of this app, on this port"), and Kubernetes continuously works to keep reality matching it. A **Pod** is the smallest deployable unit; a **Deployment** manages a set of replica Pods; a **Service** gives them a stable network address even as individual Pods come and go.

---

## Part A — Get Your Image Into the Cluster

`kind` clusters run in Docker containers with their own isolated image storage — they can't see images that only exist in your regular Docker Desktop. You have to load the image in explicitly.

```bash
cd sample-app
docker build -t devops-workshop-app:v2 -f ../02-docker/solution/Dockerfile .
kind load docker-image devops-workshop-app:v2 --name devops-workshop
```

> **Using minikube instead?** Run `minikube image load devops-workshop-app:v2` instead of the `kind load` command.

---

## Part B — Write Your Own Manifests

**Don't copy `solution/` yet.** Create a `k8s/` folder inside `sample-app/` and write your own `deployment.yaml` and `service.yaml`.

At minimum your Deployment needs:
- 3 replicas
- The `devops-workshop-app:v2` image, with `imagePullPolicy: IfNotPresent` (so it uses your locally loaded image instead of trying to reach the internet)
- Container port `3000`

Your Service needs to:
- Select Pods by the same label your Deployment uses
- Forward port `80` to the container's port `3000`

**Apply them:**

```bash
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl get pods
kubectl get deployments
kubectl get svc
```

**Reach the app** (Services of type `ClusterIP` aren't reachable from your laptop directly — use port-forward):

```bash
kubectl port-forward service/devops-workshop-app 8080:80
```

In another terminal:
```bash
curl http://localhost:8080/
```

Leave the port-forward running in its own terminal for the rest of this module — you'll use it repeatedly.

---

## Part C — Prove Self-Healing

**1. List your Pods and pick one to kill:**

```bash
kubectl get pods
```

**2. Delete it directly** — simulating a crash:

```bash
kubectl delete pod <one-of-the-pod-names>
```

**3. Immediately list Pods again:**

```bash
kubectl get pods
```

**Expected outcome:** you'll see the deleted Pod is `Terminating`, and a **brand-new** Pod has already been created to replace it — usually within a second or two. Nobody restarted anything; the Deployment's controller noticed reality (2 Pods) no longer matched desired state (3 Pods) and corrected it.

**4. Try killing two at once**, and watch both get replaced:

```bash
kubectl delete pod <pod-1> <pod-2>
kubectl get pods -w
```

(`-w` watches continuously — press `Ctrl+C` to stop watching.)

---

## Part D — Zero-Downtime Rolling Update

**1. In another terminal, start a loop that continuously hits the app, so you can watch for any dropped requests during the update:**

```bash
while true; do curl -s http://localhost:8080/ | grep -o '"servedBy":"[^"]*"'; sleep 0.5; done
```

Notice the `servedBy` value changes between requests — that's the Service load-balancing across your 3 Pods already.

**2. In your original terminal, change the app version and trigger a rolling update:**

```bash
kubectl set image deployment/devops-workshop-app devops-workshop-app=devops-workshop-app:v2 --record
kubectl set env deployment/devops-workshop-app APP_VERSION=1.1.0-rolled-out
```

**3. Watch the rollout happen:**

```bash
kubectl rollout status deployment/devops-workshop-app
```

**Expected outcome:** the curl loop in the other terminal never shows a connection error — new Pods start and pass their readiness probe *before* old ones are terminated.

**4. Check the rollout history, then roll it back — exactly like the ArgoCD rollback story in the deck, but performed manually here:**

```bash
kubectl rollout history deployment/devops-workshop-app
kubectl rollout undo deployment/devops-workshop-app
```

---

## Part E — Autoscaling Under Real Load

**1. Install the Kubernetes Metrics Server** (needed for CPU-based autoscaling; `kind` doesn't include it by default):

```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

`kind` clusters use self-signed kubelet certificates, so metrics-server needs one extra flag:

```bash
kubectl patch deployment metrics-server -n kube-system --type='json' \
  -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'
```

Wait about a minute, then confirm it's working:
```bash
kubectl top nodes
```

**2. Apply the autoscaler** (use `solution/hpa.yaml`, or write your own targeting 50% average CPU utilization, min 2 / max 8 replicas):

```bash
kubectl apply -f ../04-kubernetes/solution/hpa.yaml
kubectl get hpa
```

**3. Generate real load** to force it to scale up. In a new terminal:

```bash
kubectl run load-generator --image=busybox --restart=Never -- \
  /bin/sh -c "while true; do wget -q -O- http://devops-workshop-app.default.svc.cluster.local/; done"
```

**4. Watch it react** (this can take 1–3 minutes):

```bash
kubectl get hpa -w
```

**Expected outcome:** `REPLICAS` climbs above your original 3 as CPU usage rises past 50%.

**5. Stop the load and watch it scale back down:**

```bash
kubectl delete pod load-generator
kubectl get hpa -w
```

Scaling down is intentionally slower than scaling up (a built-in safety cooldown) — give it a few minutes.

---

## Verification Checklist

- [ ] `kubectl get pods` shows 3 Pods in `Running` state
- [ ] Deleting a Pod resulted in an automatic replacement within seconds
- [ ] A rolling update completed with zero failed requests in your curl loop
- [ ] `kubectl rollout undo` successfully reverted to the previous version
- [ ] `kubectl top nodes` returns real numbers (metrics-server is working)
- [ ] The HPA's `REPLICAS` count increased under load and later decreased once load stopped

---

## Troubleshooting

| Problem | Likely Cause | Fix |
|---|---|---|
| Pods stuck in `ImagePullBackOff` | Image wasn't loaded into the `kind` cluster, or tag doesn't match | Re-run `kind load docker-image devops-workshop-app:v2 --name devops-workshop`; confirm `imagePullPolicy: IfNotPresent` |
| Pods stuck in `CrashLoopBackOff` | App is erroring on startup | `kubectl logs <pod-name>` to see why |
| `curl: (7) Failed to connect` on port 8080 | Port-forward isn't running, or it died | Re-run `kubectl port-forward service/devops-workshop-app 8080:80` in its own terminal |
| `kubectl top nodes` returns "metrics not available" | Metrics-server not ready yet, or the insecure-TLS patch wasn't applied | Wait ~60s after applying the patch; check `kubectl get pods -n kube-system` for `metrics-server` status |
| HPA `TARGETS` column shows `<unknown>` | Metrics-server isn't working yet | Same fix as above — HPA depends entirely on metrics-server |
| Rolling update doesn't seem to change anything | Both `kubectl set image` and `kubectl set env` need the exact deployment/container name | Confirm names with `kubectl get deployment devops-workshop-app -o yaml \| grep name` |

---

## Stretch Goals
- Add an `Ingress` resource and an ingress controller (e.g. `ingress-nginx`) so you can reach the app via a hostname instead of `kubectl port-forward`.
- Deliberately set an unreasonably low memory `limit` on the Deployment and watch Kubernetes `OOMKill` the container — then check `kubectl describe pod` to see the exact reason recorded.
- Create a second `Namespace` called `staging` and deploy a second copy of the app into it, to see namespace isolation in action.

## Key Takeaways
- Kubernetes doesn't wait for you to notice something's wrong — the reconciliation loop between desired and actual state runs constantly, on its own.
- Readiness probes are what make rolling updates safe: a new Pod only receives traffic once it proves it's actually ready.
- Autoscaling is driven by real metrics (via metrics-server) — without it, an HPA has nothing to react to.

**Next:** [`05-helm/README.md`](../05-helm/README.md)
