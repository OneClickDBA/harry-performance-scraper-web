---
title: Builds
sidebar_position: 3
---

# Builds

The scraper can be built with either Oracle's `godror` driver or the no-CGO
`go-ora` driver.

## Default Build

The default build uses `godror`.

```bash
go build -o harry-scraper ./
```

Use this build when Oracle Instant Client is installed and configured on the
machine that runs the scraper.

## No-CGO Build

Build with `go-ora` using the `goora` tag:

```bash
go build -tags goora -o harry-scraper ./
```

Use this build when you want a simpler binary deployment without Oracle Instant
Client.

## Container Build

The Dockerfile supports Oracle Linux 8 and 9 slim base images. It has a reusable
`build-deps` stage and runtime stages for `godror` and `goora`.

BuildKit sets `TARGETOS=linux` and selects `TARGETARCH` for each requested
platform. Oracle Linux 8 or 9 is selected separately through `BASE_IMAGE`;
the Oracle Linux release is not a `TARGETOS` value.

Build the dependency image:

```bash
docker build \
  -f Dockerfile \
  --target build-deps \
  --build-arg GOOS=linux \
  --build-arg GOARCH=amd64 \
  --build-arg TAGS=godror \
  --build-arg CGO_ENABLED=1 \
  --build-arg GO_VERSION=1.26.3 \
  -t harry-performance-scraper-build-deps:local \
  .
```

Build the scraper image through Compose:

```bash
docker compose --env-file .env -f docker-compose/compose.yaml build harry-scraper
```

The Compose build creates:

```text
harry-performance-scraper:local
```

## Extracting The Binary From An Image

From a running container:

```bash
docker cp <container_name>:/harry-scraper ./harry-scraper
chmod +x ./harry-scraper
```

From an image without keeping a container:

```bash
docker create --name tmp_harry-scraper harry-performance-scraper:local
docker cp tmp_harry-scraper:/harry-scraper ./harry-scraper
docker rm tmp_harry-scraper
chmod +x ./harry-scraper
```

The same pattern works with `podman cp`.

## GitHub Release Artifacts

Pushing a GitHub-verified signed tag matching `vMAJOR.MINOR.PATCH` starts the
release workflow. The tag must point to a commit contained in `main`.

The workflow tests both Oracle drivers and publishes:

- self-contained `go-ora` archives for Linux amd64/arm64, Windows amd64, and
  macOS amd64/arm64;
- `godror` Linux amd64/arm64 archives built on Oracle Linux 8 and 9;
- a `SHA256SUMS` file covering every release archive.

Every binary archive includes `example-config.yaml` for a single Oracle
Database and `example-config-multi-database.yaml` for multiple databases.

Standalone `godror` binaries require Oracle Instant Client on the destination
system. The release version is derived from the tag; untagged local builds use
`0.0.0-dev`.

Create and push the signed release tag only after merging the release commit:

```bash
git switch main
git pull --ff-only origin main
git tag -s v1.0.0 -m "Harry v1.0.0"
git tag -v v1.0.0
git push origin v1.0.0
```

## GitHub Container Registry

The release workflow publishes multi-architecture Linux images for amd64 and
arm64 to:

```text
ghcr.io/oneclickdba/harry-performance-scraper
```

Each release has explicit driver and Oracle Linux variants:

```text
v1.0.0-godror-el8
v1.0.0-godror-el9
v1.0.0-goora-el8
v1.0.0-goora-el9
```

The normal version aliases (`v1.0.0`, `1.0.0`, `1.0`, `1`, and `latest`) point
to the `godror` Oracle Linux 8 image. Use an explicit variant tag when the
driver or Oracle Linux release must not depend on that default.

The `godror` images include Oracle Instant Client. The `goora` images do not
require Oracle client libraries. The default image build installs Oracle
Instant Client 26ai from Oracle's EL8 or EL9 package repository.

The workflow authenticates with the repository `GITHUB_TOKEN`; it does not
require a personal access token. The organization must allow Actions to create
packages, and the repository workflow-token policy must permit the declared
`contents: write` and `packages: write` permissions. New GHCR packages are
private by default, so change the package visibility deliberately when the
release is intended for anonymous public pulls.
