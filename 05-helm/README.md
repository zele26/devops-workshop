# Module 05 — Helm: Templating for Every Environment

## Objectives
By the end of this module you will have:
- Converted your raw Kubernetes YAML from Module 04 into a Helm Chart
- Deployed the same Chart with different values for "dev" and "production"
- Upgraded a release and rolled it back using Helm's own release history
- Installed a real third-party Chart from a public repository

## Time Estimate: ~60 minutes

## Prerequisites
- Module 04 complete
- Helm installed (verified in Module 00)

---

## Concepts Recap

A Helm **Chart** bundles Kubernetes YAML into a reusable package with placeholders. A **values file** supplies the actual settings. The same Chart, given different values, produces correctly-sized YAML for any environment — no copy-pasted files drifting out of sync.

---

## Part A — Scaffold and Build Your Own Chart

**Don't copy `solution/` yet.**

**1. Generate a starter chart:**

```bash
cd sample-app
helm create devops-workshop-app
```

This generates far more than you need (it includes example Ingress, ServiceAccount, tests, etc.). **Delete everything inside `templates/` and `values.yaml`,** and rebuild them yourself with just three things:
- `templates/deployment.yaml` — templated from your Module 04 `deployment.yaml`, replacing hardcoded values (replica count, image tag, port) with `{{ .Values.xxx }}` placeholders
- `templates/service.yaml` — same idea, templated from your Module 04 `service.yaml`
- `values.yaml` — the default values those placeholders pull from

**2. Render it without installing anything, to check your templating logic:**

```bash
helm template devops-workshop-app ./devops-workshop-app
```

Read the output carefully — this is the exact YAML that would be sent to Kubernetes. Fix any template errors now; they're much easier to debug here than after a failed install.

**3. Compare your work to the solution** at [`solution/devops-workshop-app/`](./solution/devops-workshop-app/), which also adds a conditional HPA template (only rendered `{{- if .Values.autoscaling.enabled }}`) and injects `APP_VERSION` from values.

---

## Part B — Install It

**1. Uninstall your Module 04 raw manifests first, so there's no naming conflict:**

```bash
kubectl delete -f ../04-kubernetes/solution/deployment.yaml -f ../04-kubernetes/solution/service.yaml --ignore-not-found
```

**2. Install the Chart as a named "release":**

```bash
helm install dev-release ../05-helm/solution/devops-workshop-app
kubectl get pods
kubectl get svc
```

Notice the resource names now include `dev-release-devops-workshop-app` — Helm namespaces resources by release name automatically, which is exactly what lets you install the same Chart multiple times without collisions.

**3. Port-forward and confirm it's serving traffic:**

```bash
kubectl port-forward service/dev-release-devops-workshop-app 8080:80
curl http://localhost:8080/
```

---

## Part C — One Chart, Two Environments

**1. Look at [`solution/devops-workshop-app/values-prod.yaml`](./solution/devops-workshop-app/values-prod.yaml)** — notice it only lists what's *different* for production: more replicas, higher resource limits, autoscaling turned on.

**2. Render both environments side-by-side, without installing, to see exactly what differs:**

```bash
helm template dev ./solution/devops-workshop-app > /tmp/dev-rendered.yaml
helm template prod ./solution/devops-workshop-app -f ./solution/devops-workshop-app/values-prod.yaml > /tmp/prod-rendered.yaml
diff /tmp/dev-rendered.yaml /tmp/prod-rendered.yaml
```

**Expected outcome:** the `diff` shows only replica counts, resource limits, and the extra HPA block — proving the *structure* is identical and only the *configuration* changed.

**3. Actually install the "production" version alongside dev, in its own release:**

```bash
helm install prod-release ./solution/devops-workshop-app -f ./solution/devops-workshop-app/values-prod.yaml
kubectl get pods
```

You should now see both `dev-release-*` and `prod-release-*` Pods running side by side, from the exact same Chart.

---

## Part D — Upgrade & Rollback

**1. Make a change and upgrade the dev release** (e.g., bump `appVersion` in `values.yaml` to `1.1.0`):

```bash
helm upgrade dev-release ./solution/devops-workshop-app --set appVersion=1.1.0
```

**2. Check release history:**

```bash
helm history dev-release
```

**3. Roll it back to the previous revision:**

```bash
helm rollback dev-release 1
helm history dev-release
```

This is the same idea as `kubectl rollout undo` in Module 04, but at the level of an entire Chart release, not just one Deployment.

---

## Part E — Install a Real-World Chart

Experience how much complexity a good Chart hides, using a genuinely popular one.

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update
helm install my-redis bitnami/redis --set auth.enabled=false
kubectl get pods
```

Look at how many Kubernetes resources this one `helm install` created:
```bash
helm get manifest my-redis | grep "^kind:"
```

Clean it up once you've seen it:
```bash
helm uninstall my-redis
```

---

## Verification Checklist

- [ ] `helm template` on your own chart produced valid, sensible YAML before you looked at the solution
- [ ] `dev-release` and `prod-release` are both running simultaneously from the same Chart
- [ ] `diff` between rendered dev and prod YAML shows only intentional differences
- [ ] `helm rollback` successfully reverted a release to a previous revision
- [ ] You installed and removed a real third-party Chart (Redis)

---

## Troubleshooting

| Problem | Likely Cause | Fix |
|---|---|---|
| `helm template` errors with "nil pointer evaluating interface" | A value referenced in a template doesn't exist in `values.yaml` | Check for typos between `{{ .Values.x.y }}` and the actual key name/nesting in `values.yaml` |
| `helm install` fails: "cannot re-use a name that is still in use" | A release with that name already exists (maybe from a failed previous attempt) | `helm list` to check, then `helm uninstall <name>` before retrying |
| Both releases' Pods have colliding labels | Templates didn't include `{{ .Release.Name }}` in the `app`/`release` labels | Compare against `solution/` — every label and name should include the release name |
| `helm upgrade` seems to do nothing | `--set` flag typo, or the value wasn't actually used anywhere in a template | Confirm the key exists in a template with `helm template ... --debug` |
| Bitnami repo add fails | Typo in the URL, or no internet access | Double check `https://charts.bitnami.com/bitnami` exactly |

---

## Stretch Goals
- Add a `NOTES.txt` to your chart (Helm shows this automatically after `helm install`) with the exact `kubectl port-forward` command needed to reach the app.
- Add a `values.schema.json` to your chart so Helm validates values *before* attempting to render templates.
- Package your chart (`helm package ./devops-workshop-app`) and host it in a simple Git-based Chart repository.

## Key Takeaways
- Helm doesn't deploy anything by itself — it renders templates into plain Kubernetes YAML, which then gets applied like any other manifest.
- One Chart, many values files, many environments — the discipline that keeps dev and prod from silently drifting apart.
- Release history makes "undo this entire deployment" a single command, at the same granularity you'll see ArgoCD operate at next.

**Next:** [`06-argocd/README.md`](../06-argocd/README.md)
