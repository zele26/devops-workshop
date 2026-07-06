# Module 06 — ArgoCD & GitOps: Deploying by Pushing to Git

## Objectives
By the end of this module you will have:
- Installed ArgoCD on your local cluster
- Split your project into an "app repo" and a "config repo" — the same split described in the deck
- Deployed your Helm chart by pushing a commit, not by running `helm install` or `kubectl apply` yourself
- Watched ArgoCD automatically undo a manual change you made directly to the cluster
- Rolled back a bad release with `git revert`

## Time Estimate: ~90 minutes

## Prerequisites
- Module 05 complete
- Your Helm chart works when installed manually

---

## Concepts Recap

GitOps means Git is the single source of truth for what *should* be running. ArgoCD continuously compares the live cluster against what's declared in Git and reconciles any difference — like a thermostat, not a one-time space heater. From this module onward, **you will never run `helm install`, `helm upgrade`, or `kubectl apply` on this app again** — only `git push`.

---

## Part A — Install ArgoCD

**1. Create a namespace and install ArgoCD into it:**

```bash
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
```

**2. Wait for everything to come up:**

```bash
kubectl get pods -n argocd -w
```

(Press `Ctrl+C` once every pod shows `Running`/`Completed`.)

**3. Get the initial admin password:**

```bash
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d; echo
```

**4. Access the UI:**

```bash
kubectl port-forward svc/argocd-server -n argocd 8081:443
```

Open **https://localhost:8081** (accept the self-signed certificate warning), log in as `admin` with the password from step 3.

---

## Part B — Split Into an App Repo and a Config Repo

This is the single most important structural change in this module.

**1. Create a brand-new, separate GitHub repository** named `devops-workshop-config`.

**2. Move your Helm chart there:**

```bash
mkdir ~/devops-workshop-config
cp -r 05-helm/solution/devops-workshop-app ~/devops-workshop-config/
cd ~/devops-workshop-config
git init
git add .
git commit -m "Initial commit: Helm chart for devops-workshop-app"
git branch -M main
git remote add origin https://github.com/<your-username>/devops-workshop-config.git
git push -u origin main
```

You now have two repositories with two distinct jobs:

| Repository | Contains | Changed by |
|---|---|---|
| `devops-workshop` (your app repo) | Source code, Dockerfile, Jenkinsfile | Developers, via Pull Requests |
| `devops-workshop-config` (new) | The Helm chart and its values | Jenkins's final pipeline stage, or you manually in this module |

---

## Part C — Create the ArgoCD Application

**1. Edit [`solution/argocd-application.yaml`](./solution/argocd-application.yaml)**, replacing `<your-username>` with your actual GitHub username.

**2. Apply it:**

```bash
kubectl apply -f 06-argocd/solution/argocd-application.yaml
```

**3. Watch it sync**, either with:

```bash
kubectl get application devops-workshop-app -n argocd -w
```

or by opening the ArgoCD UI — click into the `devops-workshop-app` tile and watch the resource graph appear as it syncs.

**Expected outcome:** a `devops-workshop` namespace is created automatically, and your Deployment, Service, and (if enabled) HPA appear — all without you running `helm install` yourself. ArgoCD did it, driven entirely by what's in `devops-workshop-config`.

**4. Confirm the app is reachable:**

```bash
kubectl port-forward svc/dev-devops-workshop-app -n devops-workshop 8080:80
curl http://localhost:8080/
```

---

## Part D — Deploy a Change *Only* by Pushing to Git

**1. In `devops-workshop-config`, change something meaningful** — bump the replica count:

```bash
cd ~/devops-workshop-config
sed -i 's/replicaCount: 3/replicaCount: 5/' devops-workshop-app/values.yaml
git add devops-workshop-app/values.yaml
git commit -m "Scale up to 5 replicas"
git push origin main
```

**2. Do *not* run any `kubectl` or `helm` command.** Just watch:

```bash
kubectl get application devops-workshop-app -n argocd -w
```

Within ArgoCD's polling interval (default: up to 3 minutes; you can also click **Refresh** in the UI to force it immediately), you'll see the Application go `OutOfSync`, then automatically `Synced` again — and:

```bash
kubectl get pods -n devops-workshop
```

now shows 5 Pods, without you ever touching the cluster directly.

---

## Part E — Prove Self-Healing (Drift Correction)

**1. Manually break the declared state, directly on the cluster** — simulating an engineer making a panicked manual fix:

```bash
kubectl scale deployment dev-devops-workshop-app -n devops-workshop --replicas=1
kubectl get pods -n devops-workshop
```

You'll briefly see only 1 Pod.

**2. Wait a few seconds, then check again:**

```bash
kubectl get pods -n devops-workshop
```

**Expected outcome:** ArgoCD notices the live cluster (1 replica) no longer matches Git (5 replicas) and automatically scales it back to 5 — because `selfHeal: true` is set in the Application's `syncPolicy`. Nobody ran a command to fix it; Git said what should be true, and ArgoCD kept making it true.

---

## Part F — Rollback via Git Revert

**1. Deploy something deliberately bad:**

```bash
cd ~/devops-workshop-config
sed -i 's/repository: devops-workshop-app/repository: devops-workshop-app-typo/' devops-workshop-app/values.yaml
git add devops-workshop-app/values.yaml
git commit -m "Bad change: typo'd image repository"
git push origin main
```

**2. Watch it fail:**

```bash
kubectl get pods -n devops-workshop -w
```

You should see new Pods stuck in `ImagePullBackOff`.

**3. Roll it back the GitOps way — exactly like Chapter 6 of the deck:**

```bash
git revert HEAD
git push origin main
```

**4. Watch ArgoCD sync the fix automatically**, and confirm Pods return to `Running`.

---

## Verification Checklist

- [ ] ArgoCD UI is reachable and shows your Application as `Synced` and `Healthy`
- [ ] A replica count change was deployed by `git push` alone — no `kubectl`/`helm` command
- [ ] Manually scaling the Deployment down was automatically corrected back by ArgoCD
- [ ] A bad image name broke the app, and `git revert` fixed it without any manual cluster edit
- [ ] You can clearly explain, out loud, the difference between your app repo and your config repo

---

## Troubleshooting

| Problem | Likely Cause | Fix |
|---|---|---|
| Application stuck `Unknown` or `Progressing` forever | `repoURL` typo, or repo is private without credentials configured | Double-check the URL; for private repos, add credentials under **Settings → Repositories** in the ArgoCD UI |
| Application shows `OutOfSync` but never syncs | `syncPolicy.automated` missing or misindented | Compare exactly against `solution/argocd-application.yaml` |
| Self-heal doesn't kick in | `selfHeal: true` missing, or you didn't wait long enough | ArgoCD's default reconciliation loop runs every few minutes; force it immediately via the UI's **Refresh** button |
| `git revert` conflict | Multiple bad commits were made without reverting in between | Resolve like any Git conflict (Module 01), or use `git revert -m 1` for merge commits |
| Port-forward reaches an old version | Browser cache or you're forwarding to the wrong Service name | Recheck the exact Service name via `kubectl get svc -n devops-workshop` |

---

## Stretch Goals
- Turn off `automated` sync and practice clicking **Sync** manually in the UI instead — this is how many teams treat production, versus fully automated dev/staging.
- Explore the **"App of Apps"** pattern: create one parent Application that itself points to a folder containing multiple child Application manifests.
- Connect Jenkins (Module 03) directly to this workflow: have its final stage `git commit` and `git push` the new image tag into `devops-workshop-config` automatically, exactly as described in the deck's Chapter 8 "TechShop" story.

## Key Takeaways
- Git is now the only thing you interact with to change what's running — ArgoCD is the tireless agent making the cluster match it.
- Splitting "app repo" from "config repo" cleanly separates "how to build it" from "what should be running."
- Self-healing and `git revert`-based rollback are the same reconciliation idea applied in two directions: correcting drift, and correcting mistakes.

**Next:** [`07-vault/README.md`](../07-vault/README.md)
