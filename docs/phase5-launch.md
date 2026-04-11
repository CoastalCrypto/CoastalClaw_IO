# Phase 5 — Launch

**Target version:** v0.6.0  
**Status:** In progress

---

## Goals

Make Coastal.AI installable by anyone in under 5 minutes via three paths:

| Path | Target user |
|---|---|
| One-line `install.sh` | Developer on any Linux/macOS machine |
| `apt install coastal-ai` | Ubuntu/Debian server operators |
| AWS Marketplace AMI | Cloud-first teams |

---

## Deliverables

### 1. APT repository

**Status:** Scripts complete — needs GPG key + GitHub Pages configured.

- `packaging/build-deb.sh` — builds `coastal-ai_<version>_amd64.deb`
- `packaging/publish-apt.sh` — pushes `.deb` + regenerated `Packages` index to the `apt` branch (served by GitHub Pages)
- `release.yml` job `apt` — runs automatically on every version tag

**To activate:**
1. Generate a GPG signing key: `gpg --full-generate-key`
2. Export and add to repo secrets: `GPG_PRIVATE_KEY`, `GPG_KEY_ID`
3. Export public key and commit to `apt` branch as `coastal-ai.gpg`
4. Enable GitHub Pages on the `apt` branch in repo settings

Users install with:
```bash
curl -fsSL https://CoastalCrypto.github.io/Coastal.AI_IO/setup.sh | sudo bash
```

---

### 2. AWS AMI

**Status:** Packer template complete (`packer/coastalos.pkr.hcl`).

- Base: Ubuntu 24.04 LTS (Canonical AMI)
- Default instance: `g4dn.xlarge` (1× T4, 16 GB RAM)
- 60 GB gp3 root volume
- Runs `post-install.sh` → clones repo, builds, enables services
- Pre-pulls `llama3.2` via Ollama

**To build:**
```bash
# One-time: configure AWS credentials
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
export AWS_DEFAULT_REGION=us-east-1

cd packer
packer init .
packer build -var "version=0.6.0" coastalos.pkr.hcl
```

**To add to release workflow:** Add a `packer` job in `release.yml` that runs after `smoke`, gated on `secrets.AWS_ACCESS_KEY_ID` being set.

**AWS Marketplace submission checklist:**
- [ ] AMI built and tested in target region
- [ ] Product listing created in AWS Marketplace Management Portal
- [ ] Pricing model chosen (free product, bring-your-own compute)
- [ ] Submit AMI for scanning (AWS Security scan required)
- [ ] Set AMI to public after approval

---

### 3. Open source release

**Status:** Complete.

- [x] `LICENSE` — MIT
- [x] `CONTRIBUTING.md` — dev setup, test instructions, release process
- [x] `package.json` — version `0.6.0`, `"license": "MIT"`
- [x] `.github/workflows/ci.yml` — test + Docker smoke on every push/PR
- [x] `.github/workflows/release.yml` — full release pipeline on version tags

---

### 4. Release checklist

Before tagging `v0.6.0`:

- [ ] All tests green: `pnpm test` (197 tests)
- [ ] Docker smoke test green: `bash scripts/smoke-test-docker.sh`
- [ ] README reviewed — version numbers, install commands accurate
- [ ] CONTRIBUTING.md reviewed
- [ ] GPG key added to secrets (for signed APT repo)
- [ ] AWS credentials added to secrets (optional, for AMI build)
- [ ] Draft release notes written

Tag and release:
```bash
git tag v0.6.0
git push origin v0.6.0
```

CI does the rest.

---

## Post-launch

- [ ] Submit to AWS Marketplace
- [ ] Announce on Hacker News / relevant communities
- [ ] Set up `coastal-ai.io` landing page (currently in `docs/site/`)
- [ ] Monitoring: set up GitHub Discussions for community support
