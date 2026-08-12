---
title: Scraper Configuration
sidebar_position: 1
---

# Scraper Configuration

Configure the scraper with a YAML file passed by `--config.file` or the
`CONFIG_FILE` environment variable.

Environment variables of the form `${VAR_NAME}` are expanded when the file is
loaded. To use a literal `$`, escape it as `$$`.

## Example

```yaml
databases:
  prod:
    username: ${ORACLE_USERNAME}
    password: ${ORACLE_PASSWORD}
    url: ${ORACLE_CONNECT_STRING}
    queryTimeout: 10
    connMaxLifetime: 30m
    connMaxIdleTime: 5m
    maxOpenConns: 10
    maxIdleConns: 10

metrics:
  scrapeInterval: 15s
  connectionBackoff: 5m

operational:
  enabled: true
  interval: 1m
  queryTimeout: 10s

performance:
  activity:
    source: session
    interval: 2s
    queryTimeout: 2s
  sqlPlans:
    enabled: true
    interval: 2m
    topN: 20
    queryTimeout: 10s

highAvailability:
  enabled: true
  scope: default
  retryInterval: 5s
  validationInterval: 2s

output:
  postgresql:
    url: ${POSTGRES_URL}
    autoMigrate: true
    retention: 720h
    maxConns: 4

log:
  level: info
  format: logfmt
  destination: /var/log/harry/alert.log
  interval: 15s
  disable: 1

web:
  listenAddresses: [':9161']
```

## Database Configuration

Each entry under `databases` defines one Oracle database connection. Monitoring
multiple PDBs normally means adding one named database entry per PDB.

Common properties:

- `username`: Oracle username.
- `password`: Oracle password.
- `passwordFile`: Optional file containing the Oracle password.
- `url`: Oracle connect string, service name, or TNS alias.
- `queryTimeout`: Timeout in seconds for scraper queries. Defaults to `5`.
- `connMaxLifetime`: Maximum age for a pooled Oracle connection. Defaults to
  `30m`.
- `connMaxIdleTime`: Maximum idle time for a pooled Oracle connection. Defaults
  to `5m`.
- `maxOpenConns`: Maximum open Go SQL connections. Defaults to `10`.
- `maxIdleConns`: Maximum idle Go SQL connections. Defaults to `10`.
- `externalAuth`: Use Oracle external authentication.
- `role`: Optional Oracle role such as `SYSDBA`; use the least privileged role
  possible.
- `tnsAdmin`: Wallet or TNS directory for this database connection.
- `labels`: Static labels added to generic metric samples.

The scraper may also load database credentials from [OCI Vault](./oci-vault.md),
[Azure Vault](./azure-vault.md), or [HashiCorp Vault](./hashicorp-vault.md).

## Metrics Configuration

```yaml
metrics:
  scrapeInterval: 15s
  connectionBackoff: 5m
  definitions:
    - /etc/harry/application-capacity-metrics.toml
    - /etc/harry/application-metrics.toml
```

- `scrapeInterval`: How often the scraper collects Oracle data and writes to
  PostgreSQL. Configure this for continuous collection.
- `connectionBackoff`: How long to wait before retrying an invalid database
  connection. Defaults to `5m`.
- `definitions`: Optional ordered list of TOML or YAML files containing
  additional SQL-derived metrics. Later files override duplicate generated
  metric identifiers from earlier files. If omitted, native operational and
  performance collectors still run.
- `databaseLabel`: Label key used for generic metric samples. Defaults to
  `database`.

Additional metric definitions are stored in `oracle_metric_samples`. Native
operational and performance collectors write to dedicated typed tables
regardless of whether `definitions` is configured.

The removed pre-beta keys `default` and `custom` are rejected by strict YAML
parsing. See [Additional Metrics](./additional-metrics.md) for migration and
cardinality guidance.

## Native Operational Configuration

```yaml
operational:
  enabled: true
  interval: 1m
  queryTimeout: 10s
```

- `enabled`: Enable typed operational collection. Defaults to `true`.
- `interval`: Minimum collection interval per Oracle database. Defaults to
  `1m`.
- `queryTimeout`: Timeout applied independently to each operational-domain
  query. Defaults to `10s`.

One domain failing does not discard rows returned by other domains. Every
domain writes success, duration, sample count, and a bounded error message to
the partitioned `oracle_scrape_status` history and transactionally updates its
row in `oracle_latest_scrape_status`.

## Native Performance Configuration

:::warning  
Oracle Diagnostics Pack  
The Oracle ASH collector is **DISABLED by default**.   
Enabling it requires that **YOU verify your Oracle Diagnostics Pack licensing**.
:::

```yaml
performance:
  activity:
    source: session
    interval: 2s
    queryTimeout: 2s
  sqlPlans:
    enabled: true
    interval: 2m
    topN: 20
    queryTimeout: 10s
```

The `activity` collector runs independently from `metrics.scrapeInterval`:

- `source`: `session` or `ash`. Defaults to `session`. The default reads active
  foreground sessions from `GV$SESSION` and does not access Oracle ASH.
- `interval`: Activity sampling interval. Defaults to `2s`.
- `queryTimeout`: Timeout for one activity query. Defaults to `2s`.

Setting `source: ash` makes the scraper query
`GV$ACTIVE_SESSION_HISTORY`. The setting is never enabled automatically from
`CONTROL_MANAGEMENT_PACK_ACCESS`, because an enabled database feature does not
establish that a deployment owns the corresponding license.

The `sqlPlans` collector reads cached cursor plans from `GV$SQL_PLAN`; it does
not run `EXPLAIN PLAN` and does not require `STATISTICS_LEVEL=ALL`.

- `enabled`: Enable cached cursor-plan collection. Defaults to `true`.
- `interval`: Minimum interval between plan collection passes for each source
  database. Defaults to `2m`.
- `topN`: Maximum number of SQL IDs selected for the detail pass. Candidates
  are ranked by elapsed-time counter deltas accumulated from frequent
  `GV$SQLSTATS` samples since the previous detail pass. Deltas are combined
  across instances and plans for each SQL ID. Defaults to `20` and must be
  between `1` and `100`.
- `queryTimeout`: Timeout for the bounded plan query. Defaults to `10s`.

The selected SQL IDs drive both `SQL_FULLTEXT` and cached-plan collection.
Plans already collected while they remain among the top candidates are not
queried again. A plan that leaves and later returns to the candidate set may be
refreshed safely through PostgreSQL upsert semantics. A selected cursor that
ages out of Oracle before the detail pass can have statistics without available
text or plan rows.

## High Availability

PostgreSQL-backed leader election is enabled by default, even when the section
is omitted:

```yaml
highAvailability:
  enabled: true
  scope: default
  retryInterval: 5s
  validationInterval: 2s
```

- `enabled`: Gate all Oracle collection behind PostgreSQL leadership. Defaults
  to `true`.
- `scope`: Election-group name. Defaults to `default`.
- `retryInterval`: Standby retry delay. Defaults to `5s`.
- `validationInterval`: Leader connection check interval. Defaults to `2s`.

See [High Availability](./high-availability.md) before deploying replicas. It
documents multi-host PostgreSQL URLs, scope isolation, health/readiness
behavior, restart requirements, and the mandatory PostgreSQL fencing caveat.

## PostgreSQL Output

```yaml
output:
  postgresql:
    url: ${POSTGRES_URL}
    autoMigrate: true
    retention: 720h
    maxConns: 4
```

Properties:

- `url`: PostgreSQL connection URL. Required.
- `autoMigrate`: Create tables and indexes on startup. Defaults to `true`.
- `retention`: Optional retention duration. When set, expired daily partitions
  are dropped across all sample tables and SQL text and execution plans no
  longer referenced within the retained partition horizon are deleted. Use Go
  duration syntax such as `720h` for 30 days.
- `maxConns`: Maximum PostgreSQL pool connections. Defaults to `4`.
- `minConns`: Minimum PostgreSQL pool connections. Defaults to `0`.
- `connMaxLifetime`: PostgreSQL pool connection lifetime. Defaults to `1h`.

The table name properties are optional. Defaults are:

```yaml
output:
  postgresql:
    samplesTable: oracle_metric_samples
    sqlSamplesTable: oracle_sql_samples
    sessionSamplesTable: oracle_session_samples
    blockingSessionsTable: oracle_blocking_session_samples
    databaseActivityTable: oracle_database_activity_samples
```

`oracle_sql_texts`, `oracle_sql_plans`, and all native operational tables and
views are derived from `sqlSamplesTable` and created in the same PostgreSQL
schema. For example,
`monitoring.oracle_sql_samples` uses `monitoring.oracle_sql_texts` and
`monitoring.oracle_sql_plans`.

Schema-qualified names may be used, for example:

```yaml
output:
  postgresql:
    samplesTable: monitoring.oracle_metric_samples
```

## Logging

The `log` section configures process logs and optional alert-log export.

- `level`: `debug`, `info`, `warn`, or `error`. Defaults to `info`.
- `format`: `logfmt` or `json`. Defaults to `logfmt`.
- `destination`: Alert log output file path. Defaults to `/log/alert.log`.
- `interval`: Alert log polling interval. Defaults to `15s`.
- `disable`: Set to `1` to disable alert-log export. Defaults to `0`.
- `perDatabaseFiles`: Write alert logs to per-database files. Defaults to
  `false`.

## Web Listener

The scraper HTTP listener exposes process health and leadership readiness:

- `/healthz`: returns `ok` when the process is running.
- `/readyz`: returns HTTP `200` only after this instance is the active scraper;
  a healthy HA standby returns HTTP `503`.
- `/`: small landing page pointing to health.

It does not expose Oracle metrics on `/metrics`.

```yaml
web:
  listenAddresses: [':9161']
  readHeaderTimeout: 10s
  readTimeout: 30s
  idleTimeout: 120s
```

Properties:

- `listenAddresses`: One or more addresses to bind. Defaults to `[':9161']`.
- `readHeaderTimeout`: Maximum time to read request headers. Defaults to `10s`.
- `readTimeout`: Maximum time to read a full HTTP request. Defaults to `30s`.
- `idleTimeout`: Maximum keep-alive idle time. Defaults to `120s`.

## Container Image Config

To add a config file to a custom image:

```Dockerfile
FROM harry-performance-scraper:local
COPY my-scraper-config.yaml /
ENTRYPOINT ["/harry-scraper", "--config.file", "/my-scraper-config.yaml"]
```
