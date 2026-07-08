# Module 07 — Vault: Secrets Without Hardcoding Them

## Objectives
By the end of this module you will have:
- Run Vault inside your cluster and stored a real secret in it
- Configured Vault so only Pods with the right Kubernetes identity can read that secret
- Watched the Vault Agent Injector automatically add a secret to a running Pod — with the value never appearing in Git, Helm values, or plain Kubernetes YAML
- Rotated a secret and confirmed the running Pod picks up the new value

## Time Estimate: ~75 minutes

## Prerequisites
- Module 06 complete (ArgoCD and your app running in the `devops-workshop` namespace)

---

## Concepts Recap

Vault stores secrets encrypted, controls exactly who or what can read each one, and can hand out short-lived credentials instead of permanent ones. The **Vault Agent Injector** is a sidecar that authenticates to Vault on a Pod's behalf and writes the real secret to a local file *inside that Pod only* — nothing sensitive ever needs to sit in Git.

---

## Part A — Install Vault (Dev Mode) With the Agent Injector

> **Dev mode note:** Vault's "dev server" mode used here is unsealed automatically and stores data in memory — perfect for learning, never for production. A real deployment uses a properly initialized, unsealed, persistently-stored Vault cluster.

**1. Add the HashiCorp Helm repository and install Vault with the injector enabled:**

```bash
helm repo add hashicorp https://helm.releases.hashicorp.com
helm repo update
helm install vault hashicorp/vault \
  --set "server.dev.enabled=true" \
  --set "injector.enabled=true"
```

**2. Confirm both the server and injector are running:**

```bash
kubectl get pods -l app.kubernetes.io/name=vault
kubectl get pods -l app.kubernetes.io/name=vault-agent-injector
```

---

## Part B — Store a Secret

**1. Open a shell inside the Vault server Pod:**

```bash
kubectl exec -it vault-0 -- /bin/sh
```

**2. Inside that shell**, Vault's dev mode is already logged in as root. Enable the KV secrets engine (version 2) and write a secret:

```sh
vault secrets enable -path=secret kv-v2
vault kv put secret/devops-workshop-app/db password="Sup3rSecretRotates!"
vault kv get secret/devops-workshop-app/db
```

Exit the shell (`exit`) once you've confirmed it's stored.

---

## Part C — Let Kubernetes Pods Authenticate to Vault

**1. Back in the Vault Pod shell** (`kubectl exec -it vault-0 -- /bin/sh`), enable the Kubernetes auth method:

```sh
vault auth enable kubernetes

vault write auth/kubernetes/config \
  kubernetes_host="https://$KUBERNETES_PORT_443_TCP_ADDR:443"
```

**2. Create the policy** — copy [`solution/devops-workshop-app-policy.hcl`](./solution/devops-workshop-app-policy.hcl)'s content and write it:

```sh
vault policy write devops-workshop-app-policy - <<EOF
path "secret/data/devops-workshop-app/*" {
  capabilities = ["read"]
}
EOF
```

**3. Create a role binding a Kubernetes ServiceAccount to that policy:**

```sh
vault write auth/kubernetes/role/devops-workshop-app \
  bound_service_account_names=default \
  bound_service_account_namespaces=devops-workshop \
  policies=devops-workshop-app-policy \
  ttl=1h
```

This says: "any Pod running as the `default` ServiceAccount, in the `devops-workshop` namespace, may authenticate and will receive the `devops-workshop-app-policy` — nothing more." Exit the shell.

---

## Part D — Inject the Secret Into Your Running App

**1. Apply the annotation patch** from [`solution/vault-annotations-patch.yaml`](./solution/vault-annotations-patch.yaml) to your Deployment. The simplest way in this workshop is to merge those `annotations` into `devops-workshop-config/devops-workshop-app/templates/deployment.yaml`, under `spec.template.metadata`, then:

```bash
cd ~/devops-workshop-config
git add devops-workshop-app/templates/deployment.yaml
git commit -m "Inject db-creds secret via Vault Agent"
git push origin main
```

**2. Let ArgoCD sync it** (from Module 06 — no manual `kubectl apply` needed):

```bash
kubectl get application devops-workshop-app -n argocd -w
```

**3. Once synced, check the Pod** — it should now show **2/2** containers ready (your app, plus the injected Vault Agent sidecar):

```bash
kubectl get pods -n devops-workshop
```

**4. Prove the secret is really there, inside the Pod, without it ever touching Git:**

```bash
kubectl exec -n devops-workshop <pod-name> -c devops-workshop-app -- cat /vault/secrets/db-creds
```

**Expected outcome:**
```
DB_PASSWORD=Sup3rSecretRotates!
```

Notice: this value exists only inside this running Pod's filesystem. Check your `devops-workshop-config` Git history — it is not there, and never was.

---

## Part E — Rotate the Secret and Watch It Update

**1. Change the secret's value:**

```bash
kubectl exec -it vault-0 -- vault kv put secret/devops-workshop-app/db password="RotatedPassword-$(date +%s)"
```

**2. Wait about a minute** (the Vault Agent checks for changes periodically), then check the file inside the Pod again:

```bash
kubectl exec -n devops-workshop <pod-name> -c devops-workshop-app -- cat /vault/secrets/db-creds
```

**Expected outcome:** the value has changed, **without the Pod restarting and without any Git commit** — the Vault Agent sidecar refreshed it in place.

---

## Verification Checklist

- [ ] Vault server and Agent Injector Pods are both `Running`
- [ ] A secret exists at `secret/devops-workshop-app/db` inside Vault
- [ ] Your annotated Pod shows `2/2` containers ready
- [ ] `cat /vault/secrets/db-creds` inside the Pod shows the real password
- [ ] Searching your `devops-workshop-config` Git history for the password text returns nothing
- [ ] After rotating the secret in Vault, the in-Pod file updated without a restart

---

## Troubleshooting

| Problem | Likely Cause | Fix |
|---|---|---|
| Pod stays `1/1`, no sidecar appears | Annotations missing or misplaced (must be under the **Pod template's** metadata, not the Deployment's own metadata) | Compare carefully against `solution/vault-annotations-patch.yaml` — indentation under `spec.template.metadata.annotations` matters |
| Sidecar container `CrashLoopBackOff` | Role/policy/ServiceAccount name mismatch | Recheck `bound_service_account_names` and `bound_service_account_namespaces` match your actual Pod's ServiceAccount and namespace exactly |
| `permission denied` reading the secret | Policy path doesn't match the actual KV path, or forgot the `data/` segment (KV v2 always inserts `data` in the real API path) | Confirm the policy path is `secret/data/devops-workshop-app/*`, matching KV v2's actual storage layout |
| `vault: command not found` outside the Pod | You're trying to run `vault` on your host, not inside `vault-0` | Prefix with `kubectl exec -it vault-0 --`, or install the Vault CLI locally |
| Rotated secret never updates in the Pod | Vault Agent's template refresh interval hasn't elapsed yet | Wait longer, or check the Agent sidecar's own logs: `kubectl logs <pod> -c vault-agent` |

---

## Stretch Goals
- Modify `sample-app/index.js` to actually read `/vault/secrets/db-creds` at startup instead of `process.env.DB_PASSWORD`, and rebuild/redeploy through the full pipeline (Docker → Jenkins → config repo → ArgoCD) to see the whole chain work together.
- Explore Vault's **dynamic secrets** for a real database engine (e.g. PostgreSQL) instead of a static KV value, so Vault generates a brand-new, auto-expiring credential on every request — the "rotates every hour" story from the deck, for real.
- Add a Vault **audit log device** and review exactly who/what requested the secret and when.

## Key Takeaways
- The Vault Agent Injector adds a sidecar automatically via annotations — no application code changes are strictly required to start benefiting from centralized secret storage.
- Kubernetes ServiceAccounts double as Vault identities — a Pod's identity, not a shared password, is what proves it's allowed to read a given secret.
- Rotating a secret in Vault propagates to running Pods without a redeploy — a static Kubernetes `Secret` object cannot do this on its own.

**Next:** [`08-capstone/README.md`](../08-capstone/README.md)
