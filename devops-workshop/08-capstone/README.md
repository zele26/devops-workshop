# Module 08 — Capstone: The Full Pipeline, End to End

## Objective

Everything up to this point was learned one tool at a time, with some manual steps standing in for what a later module would automate. In this capstone, you'll remove every manual step and wire the entire chain together so that **one action — merging a Pull Request — is the only thing a developer ever has to do.**

By the end, this will be true:

> A developer merges a Pull Request → Jenkins builds, tests, and pushes a new image → Jenkins commits the new image tag to the config repo → ArgoCD detects it and syncs the cluster → the new version is live, self-healing, autoscaling, and pulling its secrets from Vault.

No `docker build`, no `kubectl apply`, no `helm install`, no manual anything, from this point forward.

## Time Estimate: 2–3 hours

## Prerequisites
- Modules 00–07 all complete, each verification checklist checked off

---

## The Architecture You're About to Assemble

```
 Developer                                                      
    │ git push / merge PR                                       
    ▼                                                            
 ┌─────────┐   watches    ┌─────────┐   docker build/push  ┌──────────┐
 │   Git   │─────────────▶│ Jenkins │──────────────────────▶│  Docker  │
 │(app repo)│              └─────────┘                       │ Registry │
 └─────────┘                    │                            └──────────┘
                                 │ commits new image tag
                                 ▼
                         ┌───────────────┐
                         │  Git (config  │
                         │     repo)     │
                         └───────┬───────┘
                                 │ watched by
                                 ▼
                          ┌────────────┐        ┌──────────────┐
                          │   ArgoCD   │───────▶│  Kubernetes  │
                          └────────────┘  sync   │   Cluster    │
                                                  │  ┌────────┐ │
                                                  │  │  Pods  │◀┼── secrets from Vault
                                                  │  └────────┘ │
                                                  └──────────────┘
```

---

## Part A — Close the Loop: Jenkins Writes to the Config Repo

Right now, Jenkins pushes an image (Module 03) but a human edits `values.yaml` in the config repo (Module 06). Let's remove that human step.

**1. Give Jenkins credentials for your `devops-workshop-config` repository** (Manage Jenkins → Credentials — same process as Module 03's Docker Hub credential, but a Git username/Personal Access Token this time). Use ID `config-repo-credentials`.

**2. Add a final stage to your `Jenkinsfile`:**

```groovy
stage('Update Config Repo') {
    when {
        branch 'main'
    }
    steps {
        withCredentials([usernamePassword(
            credentialsId: 'config-repo-credentials',
            usernameVariable: 'GIT_USER',
            passwordVariable: 'GIT_TOKEN'
        )]) {
            sh """
                rm -rf config-repo
                git clone https://\$GIT_USER:\$GIT_TOKEN@github.com/<your-username>/devops-workshop-config.git config-repo
                cd config-repo
                sed -i "s/tag: .*/tag: ${IMAGE_TAG}/" devops-workshop-app/values.yaml
                git config user.email "jenkins@workshop.local"
                git config user.name "Jenkins"
                git add devops-workshop-app/values.yaml
                git commit -m "Update image tag to ${IMAGE_TAG}" || echo "No changes to commit"
                git push origin main
            """
        }
    }
}
```

**3. Push this Jenkinsfile change, then trigger a build.**

**Expected outcome:** Jenkins pushes a new image **and** updates the config repo itself. Watch ArgoCD pick up that change and sync automatically — you should not touch `kubectl`, `helm`, or the config repo by hand at any point.

---

## Part B — The Full Live-Fire Drill

With the loop fully closed, perform this end-to-end exercise exactly as written, timing yourself:

**1. Make a small, visible product change.** In `sample-app/index.js`, change the greeting message one more time to something you'll recognize (e.g., add your name).

**2. Follow the real workflow from Module 01:** branch, commit, push, open a Pull Request, merge it.

**3. Do nothing else.** Just watch:
   - Jenkins's dashboard — a build should start within your configured trigger interval
   - The pipeline stages complete: Test → Build → Smoke Test → Push → Update Config Repo
   - The ArgoCD UI — the Application goes `OutOfSync` then back to `Synced`
   - `kubectl get pods -n devops-workshop -w` — new Pods appear, old ones terminate only after the new ones are ready

**4. Confirm the change is live:**

```bash
kubectl port-forward svc/dev-devops-workshop-app -n devops-workshop 8080:80
curl http://localhost:8080/
```

You should see your new greeting — having done nothing but merge a Pull Request.

**5. Time it.** From the moment you clicked "Merge" to the moment `curl` showed your new text — how long did it take? Write the number down; it's a genuinely satisfying thing to see for the first time.

---

## Part C — Break Something on Purpose, End to End

Prove the whole safety net works together, not just each piece in isolation.

**1. Introduce a real bug** — break the `/health` route so it returns a 500 error instead of 200:

```javascript
app.get("/health", (req, res) => {
  throw new Error("intentional capstone failure");
});
```

**2. Update the test to expect the old, correct behavior (don't change the test — that's the point):** leave `test/index.test.js` as-is, asserting `status === "ok"`.

**3. Push it through a Pull Request and merge, same as Part B.**

**Expected outcome:** Jenkins's **Test** stage fails. The pipeline stops there — no image is built, nothing is pushed, the config repo is never touched, and ArgoCD never sees a change. The bug never reaches your cluster.

**4. Revert it properly:**

```bash
git revert HEAD
git push origin main
```

Confirm the pipeline goes green again and the app is healthy.

---

## Part D — Final Self-Assessment

Answer these out loud, in your own words, without checking the deck or earlier modules:

1. What are the two Git repositories in this system, and why are they separate?
2. If you delete a Pod right now, what brings it back, and why doesn't Jenkins or ArgoCD need to do anything?
3. Where does the database password actually live, and what would you have to compromise to steal it?
4. If Jenkins's pipeline fails at the Test stage, exactly how far did the bad code get, and what stopped it from going further?
5. Name every point in this entire system where a human still has to make a judgment call, versus where automation fully takes over.

If you can answer all five clearly, you've genuinely internalized this workshop — not just followed the steps.

---

## Verification Checklist

- [ ] Jenkins's final stage commits directly to the config repo — no human edits `values.yaml` anymore
- [ ] A full merge-to-live cycle completed with zero manual `kubectl`/`helm`/`docker` commands
- [ ] You timed your first fully automated deployment
- [ ] A broken test was caught before reaching the config repo or the cluster
- [ ] You can answer all five self-assessment questions without notes

---

## Troubleshooting

| Problem | Likely Cause | Fix |
|---|---|---|
| Jenkins can push images but the "Update Config Repo" stage fails | Credential ID mismatch, or the config repo URL/username is wrong | Recheck the credential ID matches `config-repo-credentials` exactly |
| ArgoCD never notices the config repo change | Default polling interval hasn't elapsed | Click **Refresh** in the ArgoCD UI, or reduce `timeout.reconciliation` in ArgoCD's config for faster feedback during the workshop |
| The full loop "works" but deploys the wrong image tag | The `sed` command in the Jenkinsfile didn't match `values.yaml`'s actual formatting | Print the file with `cat devops-workshop-app/values.yaml` right before the `sed` command to confirm the exact line format |
| Everything seems to work but you can't tell what changed | No easy way to see current live version | Add a step to your live-fire drill: `curl http://localhost:8080/version` before and after, and diff the output |

---

## Wrap-Up

You've now built — with your own hands, not just watched in a slide — the same system described across all eight chapters of the deck:

- **Git** as the single source of truth and collaboration point
- **Docker** for consistent packaging
- **Jenkins** automating build, test, and the handoff to Git
- **Kubernetes** running, healing, and scaling the result
- **Helm** keeping configuration reusable across environments
- **ArgoCD** keeping the cluster continuously matched to Git
- **Vault** keeping secrets out of all of the above entirely

The tools will keep changing over a career — the underlying shape of this system (small changes, automatically verified, continuously reconciled, safely reversible) is what's worth carrying forward.

**Optional next steps:** revisit each module's Stretch Goals, or try rebuilding this same pipeline against a cloud-managed Kubernetes cluster (EKS/GKE/AKS) instead of `kind`, using Terraform to provision it — a natural bridge into Chapter 9 of the deck.
