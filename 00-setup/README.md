# Module 00 — Setup & Verification

## Objectives
By the end of this module you will have:
- Verified every required tool is installed and working
- Forked/cloned the workshop repository so you have your own remote to push to
- Run the sample app locally, once, with no containers or orchestration involved

This module has no "solution" folder — it's pure setup. If every command below succeeds, you're ready for Module 01.

---

## 1. Verify Your Tools

Run each command. You're looking for a version number, not an error.

```bash
git --version
node --version
npm --version
docker --version
docker run hello-world
kind --version
kubectl version --client
helm version
```

**Expected outcome:** every command prints a version (or, for `docker run hello-world`, a friendly confirmation message). If `docker run hello-world` fails, fix Docker before continuing — everything from Module 02 onward depends on it.

---

## 2. Get Your Own Copy of This Workshop in Git

If this workshop was handed to you as a folder, turn it into your own Git repository now — you'll need a remote of your own starting in Module 01.

```bash
cd devops-workshop
git init
git add .
git commit -m "Initial commit: workshop starting point"
```

Then create a **new, empty** repository on GitHub (do not initialize it with a README), and connect it:

```bash
git branch -M main
git remote add origin https://github.com/<your-username>/devops-workshop.git
git push -u origin main
```

> If you were instead given a Git URL to clone, just run `git clone <url>` and skip the `git init` step.

---

## 3. Run the Sample App Locally (No Containers Yet)

This confirms Node.js works and gets you familiar with the app you'll be using for the rest of the workshop.

```bash
cd sample-app
npm install
npm test
npm start
```

You should see:
```
devops-workshop-app v1.0.0 listening on port 3000
```

Open a **second terminal** and try:

```bash
curl http://localhost:3000/
curl http://localhost:3000/health
```

**Expected outcome:**
```json
{"message":"Hello from the DevOps Workshop app!","version":"1.0.0","servedBy":"...","timestamp":"..."}
{"status":"ok"}
```

Stop the app with `Ctrl+C` before continuing.

---

## 4. Create Your Local Kubernetes Cluster (Preview)

You won't need this cluster until Module 04, but creating it now means any networking or resource issues surface early, not in the middle of a later module.

```bash
kind create cluster --name devops-workshop
kubectl cluster-info --context kind-devops-workshop
kubectl get nodes
```

**Expected outcome:** one node listed with status `Ready`.

Leave the cluster running — you can delete it at the very end of Module 08. If you need the disk space back sooner, `kind delete cluster --name devops-workshop` and re-create it before Module 04.

---

## Verification Checklist

- [ ] All eight `--version` commands succeeded
- [ ] `docker run hello-world` printed its confirmation message
- [ ] Your workshop folder is a Git repository with a remote on GitHub/GitLab
- [ ] `npm test` passed (2 tests, 0 failures)
- [ ] `curl http://localhost:3000/` returned JSON with a `message` field
- [ ] `kubectl get nodes` shows one `Ready` node

---

## Troubleshooting

| Problem | Likely Cause | Fix |
|---|---|---|
| `docker run hello-world` hangs or errors | Docker daemon isn't running | Start Docker Desktop (or `sudo systemctl start docker` on Linux) |
| `npm install` fails with permission errors | Global npm config issue, not project-related | Try `npm install` again inside a fresh terminal; avoid `sudo npm install` |
| `kind create cluster` fails with a network/port error | A previous cluster or another tool is using the same port | `kind delete cluster --name devops-workshop` then retry |
| `git push` asks for a password and rejects it | GitHub no longer accepts account passwords over HTTPS | Use a [Personal Access Token](https://github.com/settings/tokens) as the password, or switch to SSH remotes |
| `kubectl get nodes` shows nothing / connection refused | `kubectl` is pointed at the wrong context | `kubectl config use-context kind-devops-workshop` |

---

## Key Takeaways
- Every tool this workshop needs is now confirmed working — later modules assume this and won't re-explain installation.
- You have your own Git remote — this matters starting in the very next module.
- The sample app runs with nothing more than Node.js — Docker (Module 02) is what will make it runnable *anywhere*, not just on your machine.

**Next:** [`01-git/README.md`](../01-git/README.md)
