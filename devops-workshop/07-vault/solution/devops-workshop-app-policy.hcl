# Solution: Vault policy granting the app read-only access to exactly
# one secret path — nothing more. This is the "least privilege" idea
# from the deck applied concretely.

path "secret/data/devops-workshop-app/*" {
  capabilities = ["read"]
}
