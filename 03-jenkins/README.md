# Module 03 — Jenkins: Automating Build & Test

## Objectives
By the end of this module you will have:
- Run Jenkins yourself, in a container
- Written a `Jenkinsfile` that checks out code, installs dependencies, runs tests, builds a Docker image, and smoke-tests it
- Watched a pipeline **fail on purpose** because of a broken test, then fixed it
- Connected Jenkins to your GitHub repository so pushes trigger a build automatically

## Time Estimate: ~90 minutes

## Prerequisites
- Modules 00–02 complete
- Your `sample-app` code is pushed to GitHub (from Module 01)
- Docker is running

---

## Concepts Recap

Jenkins is a generic automation engine — it has no built-in knowledge of Node.js, Docker, or your app. All of the real logic lives in a `Jenkinsfile`, a text file checked into your repository. Every stage in this module — checkout, install, test, build, push — is something you are about to define yourself, not something Jenkins already knows how to do.

---

## Part A — Run Jenkins in a Container

Jenkins needs to be able to run `docker build` itself, so we'll mount your host's Docker socket into the Jenkins container — this lets Jenkins tell your machine's Docker daemon what to do, without needing "Docker inside Docker."

**1. Create a persistent volume for Jenkins so you don't lose configuration on restart:**

```bash
docker volume create jenkins-data
```

**2. Run Jenkins:**

```bash
docker run -d \
  --name jenkins \
  -p 8080:8080 -p 50000:50000 \
  -v jenkins-data:/var/jenkins_home \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -u root \
  jenkins/jenkins:lts
```

> **Why `-u root`?** So Jenkins's shell steps can call the `docker` CLI against the mounted socket. This is a workshop shortcut — in a real production Jenkins setup, you'd grant a non-root Jenkins user access to the Docker group instead.

**3. Jenkins also needs the `docker` CLI binary available inside its own container, since we only mounted the socket:**

```bash
docker exec -u root jenkins sh -c "apt-get update && apt-get install -y docker.io"
```

**4. Get the initial admin password and unlock Jenkins:**

```bash
docker exec jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

Open **http://localhost:8080**, paste that password, click **Install suggested plugins**, and create your first admin user when prompted.

---

## Part B — Store Your Credentials in Jenkins

You'll need two credentials so the pipeline can check out private info and push images without secrets ever appearing in your Jenkinsfile.

**1. Docker Hub credentials:**
Go to **Manage Jenkins → Credentials → System → Global credentials → Add Credentials**.
- Kind: `Username with password`
- Username/Password: your Docker Hub username and password (or an [access token](https://hub.docker.com/settings/security))
- ID: `dockerhub-credentials` (the solution Jenkinsfile expects exactly this ID)

**2. (If your GitHub repo is private) GitHub credentials:**
Same screen, add a `Username with password` credential using a [GitHub Personal Access Token](https://github.com/settings/tokens) as the password. Public repos don't need this step.

---

## Part C — Add the Jenkinsfile to Your App

**1. Copy the solution Jenkinsfile into your app repository:**

```bash
cp ../03-jenkins/solution/Jenkinsfile sample-app/Jenkinsfile
cd sample-app
git add Jenkinsfile
git commit -m "Add Jenkins pipeline"
git push origin main
```

Open it and read through each `stage{}` block before continuing — know what each one does before you watch it run.

---

## Part D — Create the Pipeline Job

**1. In Jenkins:** **New Item → Pipeline**, name it `devops-workshop-app`.

**2. Under Pipeline, set:**
- Definition: `Pipeline script from SCM`
- SCM: `Git`
- Repository URL: your GitHub repo's URL
- Branch: `*/main`
- Script Path: `Jenkinsfile`

**3. Click Save, then Build Now.**

Watch the **Console Output**. You should see each stage — Checkout, Install Dependencies, Test, Build Docker Image, Smoke Test, Push Image — run in order.

**Expected outcome:** a green (successful) pipeline, and a new image tag pushed to your Docker Hub account.

---

## Part E — Watch It Fail, Then Fix It

This is the single most important exercise in this module — a CI pipeline is only valuable if it actually stops bad code.

**1. Deliberately break a test.** In `sample-app/test/index.test.js`, change:

```javascript
assert.strictEqual(body.status, "ok");
```
to:
```javascript
assert.strictEqual(body.status, "broken-on-purpose");
```

**2. Commit and push it:**

```bash
git add test/index.test.js
git commit -m "Intentionally break a test to see Jenkins catch it"
git push origin main
```

**3. Trigger a build (click Build Now, or set up the webhook in Part F first).**

**Expected outcome:** the pipeline fails at the **Test** stage. Note that it never reaches Build Docker Image or Push Image — exactly like Chapter 3 of the deck described: the broken code never gets packaged or shipped.

**4. Fix it for real.**

```bash
git revert HEAD
git push origin main
```

Trigger the build again and confirm it goes green.

---

## Part F — Trigger Builds Automatically (Webhook)

If your Jenkins is only running on `localhost`, GitHub can't reach it directly. Use one of these:

**Option 1 — Poll SCM (simplest, works anywhere):**
In your job's configuration, under **Build Triggers**, check **Poll SCM** and set a schedule like `H/2 * * * *` (every 2 minutes). Jenkins will now check for new commits on its own.

**Option 2 — Real webhook via a tunnel (closer to production):**
Install [ngrok](https://ngrok.com/), run `ngrok http 8080`, and use the HTTPS URL it gives you to configure a webhook in your GitHub repo's **Settings → Webhooks** pointing to `<ngrok-url>/github-webhook/`. Then enable **GitHub hook trigger for GITScm polling** in your job configuration instead of Poll SCM.

---

## Verification Checklist

- [ ] Jenkins is reachable at `http://localhost:8080` and you're logged in
- [ ] Both credentials (`dockerhub-credentials`, and GitHub if needed) are stored in Jenkins, not in the Jenkinsfile
- [ ] A full pipeline run went green, and a new image tag appears on your Docker Hub repository
- [ ] You saw the pipeline **fail** at the Test stage after intentionally breaking a test
- [ ] After reverting, the pipeline went green again
- [ ] Either Poll SCM or a real webhook triggers builds without clicking "Build Now"

---

## Troubleshooting

| Problem | Likely Cause | Fix |
|---|---|---|
| `docker: command not found` inside a pipeline stage | The CLI wasn't installed inside the Jenkins container | Re-run the `docker exec -u root jenkins ...install docker.io` command from Part A |
| `permission denied` on `/var/run/docker.sock` | Jenkins container user can't access the socket | Confirm you ran the container with `-u root`; on Linux hosts you may also need `sudo chmod 666 /var/run/docker.sock` (workshop-only, not production-safe) |
| Pipeline can't find `Jenkinsfile` | Wrong Script Path, or Jenkinsfile isn't at the repo root | Confirm the file is at `sample-app/Jenkinsfile` and Script Path is exactly `Jenkinsfile` |
| `Push Image` stage fails with `unauthorized` | Credential ID mismatch | Confirm the credential's ID field is exactly `dockerhub-credentials` |
| Smoke test stage fails with connection refused | The app inside the container needed more than 3 seconds to start | Increase the `sleep 3` to `sleep 6` in the Jenkinsfile |
| Poll SCM never triggers a build | Cron syntax typo, or no new commits since last poll | Check **Job → Configure → Build Triggers** schedule, and confirm you actually pushed a new commit |

---

## Stretch Goals
- Add a `Lint` stage before `Test` (e.g. `npx eslint .` after adding a basic ESLint config).
- Configure Jenkins to post a build status message to a Slack webhook or Discord webhook in the `post {}` block.
- Parameterize the pipeline to accept an environment name (`dev`/`staging`/`prod`) as a build parameter.

## Key Takeaways
- Jenkins itself is generic — the Jenkinsfile is where all the real decisions live, and it travels with your code in Git.
- A pipeline's entire value is in stopping bad code before it's packaged — you proved this by watching a broken test block the build.
- Credentials belong in Jenkins's credential store, referenced by ID — never typed directly into a Jenkinsfile.

**Next:** [`04-kubernetes/README.md`](../04-kubernetes/README.md)
