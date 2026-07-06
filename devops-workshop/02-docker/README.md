# Module 02 — Docker: Packaging the App

## Objectives
By the end of this module you will have:
- Written your own Dockerfile from scratch for the sample app
- Built an image and run it as a container
- Proven the "it works the same everywhere" claim by running the exact same image twice, differently configured
- Pushed an image to Docker Hub (or a local registry)

## Time Estimate: ~60 minutes

## Prerequisites
- Module 00 complete (Docker installed and verified)
- The sample app runs locally with `npm start` (from Module 01)

---

## Concepts Recap

A **Dockerfile** is a text recipe. `docker build` follows that recipe and produces an **image** — a read-only template. `docker run` starts a **container**, a live instance of that image. Push the image to a **registry** (Docker Hub, or a private one) and anyone — or any server — can pull and run the identical package.

---

## Part A — Write Your Own Dockerfile

**Don't look at `solution/Dockerfile` yet.** Try this yourself first.

**1. In `sample-app/`, create a file named `Dockerfile` (no extension) with your own attempt.**

At minimum, it needs to:
- Start from a Node.js base image
- Copy `package.json` and install dependencies
- Copy the rest of the app's source code
- Expose port 3000
- Start the app with `node index.js`

Give it a genuine attempt before reading further. A reasonable first pass often looks like this:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
EXPOSE 3000
CMD ["node", "index.js"]
```

**2. Build it.**

```bash
cd sample-app
docker build -t devops-workshop-app:v1 .
```

**3. Run it.**

```bash
docker run -d -p 3000:3000 --name workshop-app devops-workshop-app:v1
curl http://localhost:3000/
```

**4. Check it's actually running as a container, then stop it.**

```bash
docker ps
docker logs workshop-app
docker stop workshop-app
docker rm workshop-app
```

If all four steps worked, you've built and run your first container. Now let's make it better.

---

## Part B — Improve It: Multi-Stage Build, Smaller Image, Non-Root User

Compare your image's size against a leaner approach:

```bash
docker images devops-workshop-app
```

Now open [`solution/Dockerfile`](./solution/Dockerfile) and compare it to yours. It uses:
- **A multi-stage build** — dependencies are installed in one temporary stage, and only the final `node_modules` folder is copied into the real image, leaving build tools behind.
- **`npm ci` instead of `npm install`** — installs *exactly* what's in `package-lock.json`, which is what you want for a reproducible build (this is the same discipline Git gives you for code, applied to dependencies).
- **A non-root user** — containers run as root by default unless told otherwise; this Dockerfile creates and switches to an unprivileged user.
- **A `HEALTHCHECK`** — Docker itself can now tell you if the app inside stopped responding.

**Build the improved version and compare sizes:**

```bash
docker build -t devops-workshop-app:v2 -f solution/Dockerfile .
docker images devops-workshop-app
```

You should see `v2` is noticeably smaller than `v1`.

---

## Part C — Prove "It Works the Same Everywhere"

**1. Run the same image twice, with different configuration, to prove the image itself never changes:**

```bash
docker run -d -p 3001:3000 -e APP_VERSION=1.0.0-blue --name app-blue devops-workshop-app:v2
docker run -d -p 3002:3000 -e APP_VERSION=1.0.0-green --name app-green devops-workshop-app:v2
```

```bash
curl http://localhost:3001/
curl http://localhost:3002/
```

Notice: **one image**, two running containers, two different reported versions — purely from environment variables. The image itself was never rebuilt or modified.

**2. Clean up:**

```bash
docker stop app-blue app-green
docker rm app-blue app-green
```

---

## Part D — Push to a Registry

**1. Create a free account on [Docker Hub](https://hub.docker.com) if you don't have one, then log in:**

```bash
docker login
```

**2. Tag your image with your Docker Hub username and push it:**

```bash
docker tag devops-workshop-app:v2 <your-dockerhub-username>/devops-workshop-app:v2
docker push <your-dockerhub-username>/devops-workshop-app:v2
```

**3. Prove it's really there — remove your local copy and pull it back down:**

```bash
docker rmi devops-workshop-app:v2 <your-dockerhub-username>/devops-workshop-app:v2
docker pull <your-dockerhub-username>/devops-workshop-app:v2
docker run -d -p 3000:3000 --name from-registry <your-dockerhub-username>/devops-workshop-app:v2
curl http://localhost:3000/
docker stop from-registry && docker rm from-registry
```

You've now completed the exact flow from Chapter 2 of the deck: Dockerfile → build → image → push → pull → run, on a registry anyone (with permission) can reach.

---

## Verification Checklist

- [ ] You wrote your own working Dockerfile before looking at the solution
- [ ] `docker images` shows the multi-stage `v2` image is smaller than `v1`
- [ ] Two containers from the same image reported two different `APP_VERSION` values
- [ ] Your image is visible on your Docker Hub account's repository page
- [ ] You successfully pulled and ran the image after deleting your local copy

---

## Troubleshooting

| Problem | Likely Cause | Fix |
|---|---|---|
| `docker build` fails at `COPY package.json .` | You're not running the command from inside `sample-app/` | `cd sample-app` first, or adjust the path/context |
| Container exits immediately after `docker run` | An error inside the app crashed it on startup | `docker logs <container-name>` to see the actual error |
| `curl: (7) Failed to connect` | Port wasn't published, or the app isn't listening yet | Check `docker ps` for the `PORTS` column; give the container a few seconds after starting |
| `docker push` fails with "denied: requested access is not authorized" | Image tag doesn't start with your Docker Hub username | Re-tag: `docker tag devops-workshop-app:v2 <username>/devops-workshop-app:v2` |
| Build works but image is huge | Using `npm install` instead of `npm ci`, or copying `node_modules` from the host | Use the multi-stage solution Dockerfile, and make sure `.dockerignore` excludes `node_modules` |

---

## Stretch Goals
- Add a `.dockerignore` entry check: confirm your image does **not** contain your local `node_modules` by running `docker run --rm devops-workshop-app:v2 ls node_modules | wc -l` and comparing to your host's `node_modules` count.
- Try `docker scout quickview devops-workshop-app:v2` (or any vulnerability scanner you have) to see known vulnerabilities in your base image — a preview of the DevSecOps ideas from the deck's Chapter 9.

## Key Takeaways
- A Dockerfile is a recipe; building it produces a reusable, immutable image; running it produces a live container.
- The same image, unmodified, can behave differently only through explicit configuration (environment variables) — never by quietly drifting.
- Multi-stage builds and non-root users are two small habits that meaningfully improve real-world image size and security.

**Next:** [`03-jenkins/README.md`](../03-jenkins/README.md)
