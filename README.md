# The Complete DevOps Workshop

**A hands-on companion to "The Complete DevOps Journey" deck.**

This workshop turns every concept — Git, Docker, Jenkins, Kubernetes, Helm, ArgoCD, and Vault — into something you actually **type, run, break, and fix** on your own machine. Every module uses the same tiny sample application, so you watch *one* app travel the entire path from a `git commit` to a securely running, self-healing, auto-deployed service.

By the end, you won't just know what these tools do — you'll have used every one of them, in the correct order, on a real (if small) working system.

---

## How This Workshop Is Organized

```
devops-workshop/
├── README.md                  ← you are here
├── 00-setup/                  ← install everything, once
├── sample-app/                ← the one app used in every module
├── 01-git/                    ← branching, merging, PR workflow
├── 02-docker/                 ← write a Dockerfile, build & run it
├── 03-jenkins/                ← automate build + test with a real pipeline
├── 04-kubernetes/             ← run it on a local cluster, self-heal, scale
├── 05-helm/                   ← template it for dev/staging/prod
├── 06-argocd/                 ← GitOps: deploy by pushing to Git
├── 07-vault/                  ← stop hardcoding secrets, inject them securely
└── 08-capstone/               ← wire all seven modules into one pipeline
```

Each module folder contains its own `README.md` with:

| Section | What it gives you |
|---|---|
| **Objectives** | Exactly what you'll be able to do afterward |
| **Concepts Recap** | A two-minute reminder of the "why," before the "how" |
| **Hands-On Steps** | Numbered, copy-pasteable instructions |
| **Verification Checklist** | How to know it actually worked |
| **Troubleshooting** | The specific errors people hit, and their fixes |
| **Stretch Goals** | Optional extras if you finish early |
| **Solution** | A `solution/` folder with a working, complete answer |

You're encouraged to attempt each step yourself **before** opening `solution/`. Getting an error and fixing it is most of the learning.

---

## Prerequisites

### Knowledge
- Comfortable typing commands in a terminal
- Having read (or skimmed) the companion slide deck helps, but each module recaps the "why" before the "how"

### Software to install before Module 00

| Tool | Purpose | Install Guide |
|---|---|---|
| **Git** | Version control | https://git-scm.com/downloads |
| **Node.js** (v18+) | Runs the sample app locally | https://nodejs.org |
| **Docker Desktop** (or Docker Engine) | Builds & runs containers | https://docs.docker.com/get-docker/ |
| **kind** (Kubernetes in Docker) | A real local Kubernetes cluster | https://kind.sigs.k8s.io/docs/user/quick-start/ |
| **kubectl** | Talk to your Kubernetes cluster | https://kubernetes.io/docs/tasks/tools/ |
| **Helm** | Package/template Kubernetes YAML | https://helm.sh/docs/intro/install/ |
| **A GitHub (or GitLab) account** | Your own remote repo, used from Module 01 onward | https://github.com |

> **Why `kind` instead of a cloud cluster?** It creates a real, multi-node-capable Kubernetes cluster inside Docker containers on your own laptop — free, fast to reset, and identical in behavior to a "real" cluster for everything this workshop covers. `minikube` is a perfectly good alternative if you already have it installed; every `kind`-specific command has a `minikube` equivalent noted where it matters.

Jenkins, ArgoCD, and Vault are **not** installed upfront — each of their modules walks you through installing exactly that tool, because seeing the installation step is itself part of the learning.

---

## Suggested Pace

| Module | Focus | Suggested Time |
|---|---|---|
| 00 | Setup & verification | 30–45 min |
| 01 | Git | 45 min |
| 02 | Docker | 60 min |
| 03 | Jenkins | 90 min |
| 04 | Kubernetes | 120 min |
| 05 | Helm | 60 min |
| 06 | ArgoCD | 90 min |
| 07 | Vault | 75 min |
| 08 | Capstone | 2–3 hours |

Total: roughly **two focused working days**, or spread across a week of evenings. Modules 01–02 can be done in isolation; from Module 03 onward, each module builds directly on the previous one's output, so it's best to go in order.

---

## The One Rule

**Don't copy-paste the solution files first.** Type the commands yourself, read the errors when they show up (they will), and use each module's Troubleshooting table before peeking at `solution/`. That struggle is where the actual learning happens — the slides gave you the *why*; this workshop is where you earn the *how*.

Start with [`00-setup/README.md`](./00-setup/README.md).
