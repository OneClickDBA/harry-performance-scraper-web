---
title: Development
sidebar_position: 3
---

# Development

The scraper is a Go program that connects to Oracle databases on a schedule and
writes collected samples into PostgreSQL.

The runtime flow is:

- Parse `--config.file` and expand environment variables.
- Load database, metric, HA, PostgreSQL output, logging, and web configuration.
- Start the lightweight web listener for `/healthz`, `/readyz`, and `/`.
- Acquire the configured PostgreSQL HA scope on a dedicated connection. A
  standby stops here and retries without opening Oracle pools.
- Load any optional files listed under `metrics.definitions` after leadership.
- Open the PostgreSQL connection pool and run schema migrations when
  `output.postgresql.autoMigrate` is enabled.
- Open Oracle connection pools for each configured source database.
- Start scheduled native collectors for SQL, cached cursor plans, sessions,
  blocking, DAH, and alert logs, plus any configured additional metrics.

Generic TOML/YAML metrics are written to `oracle_metric_samples`. Performance
collectors write to dedicated tables such as `oracle_sql_samples`,
`oracle_sql_texts`, `oracle_sql_cursor_metadata`, `oracle_sql_plans`, `oracle_session_samples`,
`oracle_blocking_session_samples`, and `oracle_database_activity_samples`.

Grafana dashboards read PostgreSQL directly. The scraper does not expose Oracle
metrics on `/metrics`.

The leader monitors its dedicated PostgreSQL session independently from the
write pool. Loss of that session or writable-primary status cancels collection
and exits non-zero so the surrounding service manager can restart the process.

## Container Build

To build a container image, run:

```bash
make docker
```

For ARM:

```bash
make docker-arm
```

## Binary Build

The default build uses the `godror` driver:

```bash
go build -o harry-scraper ./
```

Build with the pure-Go `go-ora` driver:

```bash
go build -tags goora -o harry-scraper ./
```

The Makefile release build writes binaries and archives under `dist`.
