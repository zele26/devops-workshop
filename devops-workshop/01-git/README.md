# Module 01 — Git: Branching, Merging & Collaboration

## Objectives
By the end of this module you will have:
- Created a feature branch and made isolated commits on it
- Simulated a two-developer collaboration, including a merge conflict
- Opened and merged a Pull Request on GitHub
- Practiced reverting a bad change safely

## Time Estimate: ~45 minutes

---

## Concepts Recap

Git tracks every change as a **commit** — a snapshot with a message explaining what and why. A **branch** lets you work on something without touching the main line of the project. A **remote** (GitHub) is the shared meeting point where branches get reviewed and merged.

This module deliberately creates a **merge conflict** on purpose — it's one of the few things that's genuinely hard to understand from a slide, and completely straightforward once you've resolved one yourself.

---

## Part A — A Feature Branch, Start to Finish

**1. Create a branch for a small feature: adding a `/version` endpoint.**

```bash
cd sample-app
git checkout -b feature/version-endpoint
```

**2. Make the change.** Open `index.js` and add a new route, right below the `/health` route:

```javascript
app.get("/version", (req, res) => {
  res.json({ version: APP_VERSION });
});
```

**3. Test it locally.**

```bash
npm start
# in another terminal:
curl http://localhost:3000/version
# {"version":"1.0.0"}
```

Stop the server with `Ctrl+C`.

**4. Commit it.**

```bash
git add index.js
git commit -m "Add /version endpoint"
```

**5. Push the branch and open a Pull Request.**

```bash
git push -u origin feature/version-endpoint
```

Go to your repository on GitHub — you'll see a banner offering to open a Pull Request from this branch. Click it, add a short description ("Adds a dedicated /version endpoint"), and open it.

**6. Merge it.** On GitHub, click **Merge pull request**, then **Confirm merge**.

**7. Bring your local `main` up to date.**

```bash
git checkout main
git pull origin main
```

You've now completed the exact loop from Chapter 1 of the deck: branch → commit → push → review → merge — for real, on your own repository.

---

## Part B — Simulating Two Developers & a Merge Conflict

This part deliberately creates a conflict so you can practice resolving one.

**1. Create two branches from the current `main`, representing two developers working at the same time.**

```bash
git checkout -b feature/greeting-formal
git checkout main
git checkout -b feature/greeting-casual
```

**2. On `feature/greeting-casual`, change the greeting message.**

In `index.js`, change:
```javascript
message: "Hello from the DevOps Workshop app!",
```
to:
```javascript
message: "Hey there! 👋 Welcome to the DevOps Workshop app.",
```

Commit and push:
```bash
git add index.js
git commit -m "Make greeting more casual"
git push -u origin feature/greeting-casual
```

**3. Switch to the other branch and change the *same line* differently.**

```bash
git checkout feature/greeting-formal
```

Change the same line to:
```javascript
message: "Greetings. This is the DevOps Workshop application.",
```

Commit and push:
```bash
git add index.js
git commit -m "Make greeting more formal"
git push -u origin feature/greeting-formal
```

**4. Merge the first one into `main` normally.**

Open a Pull Request for `feature/greeting-casual` on GitHub and merge it, same as Part A.

**5. Now try to merge the second one — and hit the conflict.**

```bash
git checkout main
git pull origin main
git merge feature/greeting-formal
```

You'll see:
```
CONFLICT (content): Merge conflict in index.js
Automatic merge failed; fix conflicts and then commit the result.
```

**6. Open `index.js`. Git has marked the conflict directly in the file:**

```javascript
<<<<<<< HEAD
    message: "Hey there! 👋 Welcome to the DevOps Workshop app.",
=======
    message: "Greetings. This is the DevOps Workshop application.",
>>>>>>> feature/greeting-formal
```

**7. Resolve it.** Decide what the line should actually say (pick one, combine them, or write something new), then delete the `<<<<<<<`, `=======`, and `>>>>>>>` markers entirely — Git left them for you to edit, not to keep.

**8. Mark it resolved and finish the merge.**

```bash
git add index.js
git commit -m "Merge feature/greeting-formal, resolve greeting text conflict"
git push origin main
```

---

## Part C — Safely Undoing a Bad Change

**1. Make an intentionally bad commit.**

```bash
git checkout main
git pull origin main
echo "console.log('this should not be here');" >> index.js
git add index.js
git commit -m "Oops: accidental debug line"
git push origin main
```

**2. Undo it safely, keeping the history honest.**

```bash
git log --oneline -5
```

Copy the commit hash of your "Oops" commit, then:

```bash
git revert <that-commit-hash>
git push origin main
```

Notice `git revert` creates a **new** commit that undoes the change — it doesn't erase history. This is exactly the mechanic ArgoCD relies on in Module 06: reverting a bad config change instead of hand-editing a live system.

---

## Verification Checklist

- [ ] Your GitHub repository shows at least 3 merged Pull Requests / merge commits
- [ ] You personally resolved a merge conflict and the app still runs afterward (`npm start`, `curl http://localhost:3000/`)
- [ ] `git log --oneline` shows a revert commit referencing the original bad commit
- [ ] `npm test` still passes on `main`

---

## Troubleshooting

| Problem | Likely Cause | Fix |
|---|---|---|
| `git push` rejected: "failed to push some refs" | Your local `main` is behind the remote | `git pull origin main` first, then push again |
| Conflict markers still visible when you run the app | You committed without fully removing `<<<<<<<` / `=======` / `>>>>>>>` | Edit the file again, remove the markers, `git add`, `git commit --amend` |
| `git revert` opens an editor you don't recognize | It's asking you to confirm the revert commit message | Save and close it (in Vim: press `Esc` then type `:wq` and Enter) |
| You committed to `main` directly by mistake | Forgot to `git checkout -b` first | Not fatal — just be more intentional about branching going forward. If it hasn't been pushed yet: `git reset HEAD~1` to undo the commit locally, then redo it on a branch. |

---

## Stretch Goals
- Configure [branch protection rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) on GitHub so `main` can't be pushed to directly, only merged via Pull Request.
- Try `git rebase` instead of merge for one of your branches, and compare the resulting history with `git log --graph --oneline --all`.

## Key Takeaways
- A feature branch isolates risky work; a Pull Request is where a second set of eyes reviews it before it reaches `main`.
- Merge conflicts happen when two people change the *same lines* — Git flags them for a human to decide, it never silently guesses.
- `git revert` is the safe, auditable way to undo something already on `main` — this exact idea reappears in Module 06 when ArgoCD reacts to a Git revert automatically.

**Next:** [`02-docker/README.md`](../02-docker/README.md)
