---
title: Collection Model
sidebar_position: 2
---

# Collection Model

The scraper has native operational and performance collection plus optional
additional metrics.
Database activity uses its own short sampling schedule so slower SQL, plan, and
additional-metric queries cannot delay activity observations.

:::warning  
Oracle Diagnostics Pack  
The Oracle ASH collector is **DISABLED by default**.   
Enabling it requires that **YOU verify your Oracle Diagnostics Pack licensing**.
:::

## Native Performance Collection

Native performance collection is the scraper's default behavior. It does not
require a metric definition file and writes structured Oracle data to dedicated
tables:

| PostgreSQL table | Collected data |
| --- | --- |
| `oracle_sql_samples` | `GV$SQLSTATS` counters by SQL ID, including executions, CPU, elapsed time, and I/O |
| `oracle_sql_texts` | Complete SQL text, stored once per source database and SQL ID |
| `oracle_sql_cursor_metadata` | Bounded `GV$SQL` child-cursor context: parsing schema, module, plan identity, and first/last observation |
| `oracle_sql_plans` | Cached `GV$SQL_PLAN` operations, stored once per cursor-plan identity |
| `oracle_session_samples` | Current sessions, SQL, waits, modules, programs, and machines |
| `oracle_blocking_session_samples` | Waiter and blocker relationships |
| `oracle_database_activity_samples` | Activity observations from `GV$SESSION` by default, or explicitly enabled Oracle ASH |

The default `session` activity source polls active foreground sessions from
`GV$SESSION`. Every stored observation records `sample_source = SESSION` and
the duration represented by that observation. This supports AAS, wait-class,
wait-event, SQL, session, module, service, and blocking analysis without
querying Oracle ASH.

The optional `ash` source reads `GV$ACTIVE_SESSION_HISTORY` and stores
`sample_source = ASH`. It adds Oracle's internal sample timing and ASH-only
details such as the active plan hash and plan line. The two sources are never
silently substituted: dashboards expose the source stored with each row.

Session sampling cannot observe SQL that starts and finishes between polls.
The frequent `GV$SQLSTATS` collector complements it for short, frequently
executed statements. PostgreSQL derives changes between cumulative counter
snapshots, so a statement executing thousands of times per minute remains
visible even when no session poll catches its 50-millisecond executions. An
activity observation should not be interpreted as an exact trace of every
execution.

The included Grafana dashboards query these tables directly. They do not query
`oracle_metric_samples`.

Use native collectors for diagnostic entities with many changing dimensions,
including SQL IDs, child cursors, plan hashes, sessions, blocking chains, wait
events, SQL text, modules, programs, and machines. Typed columns make these
values easier to index, aggregate, filter, and evolve than a generic label
document.

SQL statistics, SQL text, and execution plans have different collection and storage lifecycles.
`oracle_sql_samples` is a daily partitioned fact table and does not duplicate
the statement text in every sample. Its frequent query reads recently active
rows from `GV$SQLSTATS`, which Oracle provides as a SQL-ID-level statistics
view. When Harry connects to a CDB root, it aggregates contributions visible
from multiple containers into one row per instance, SQL ID, and plan hash;
PDB-level SQL attribution is intentionally outside the current collection
model. Between detail passes, the scraper accumulates positive counter deltas
across instances and plans for each SQL ID. A lower cumulative value establishes
a new baseline and contributes zero for that ambiguous interval instead of
being counted as a complete new counter. The next bounded detail pass ranks
those interval deltas by elapsed time, then reads `SQL_FULLTEXT` and child
cursor keys from `GV$SQL` only for the selected SQL IDs. This prevents both a
historically expensive cursor and changing `GV$SQLSTATS` contributors from
manufacturing top-consumer workload that did not occur in the selected period.

The bounded detail pass also records `PARSING_SCHEMA_NAME` and `MODULE` in
`oracle_sql_cursor_metadata`, keyed by source database, instance, SQL ID, child
number, and plan hash. `oracle_sql_samples_enriched` combines that deduplicated
context with the frequent SQL statistics for Grafana. It reports all child
cursors, schemas, and modules observed for an instance/SQL/plan identity rather
than attributing aggregate `GV$SQLSTATS` counters to an arbitrary child cursor.
`MODULE` remains empty when the client does not instrument sessions with
`DBMS_APPLICATION_INFO`. Disabling `performance.sqlPlans` also disables this
shared bounded detail pass, including SQL text and cursor metadata collection.
The metadata is not reconstructed from older retained SQL samples; populated
context appears after the next successful bounded detail pass.

`oracle_sql_texts` is a non-partitioned
lookup table keyed by `(source_database, sql_id)` and stores Oracle
`SQL_FULLTEXT`, first-seen, last-text-seen, and last-reference timestamps.
Dashboards join the tables logically; PostgreSQL foreign keys are intentionally
not used because session and activity samples may observe SQL IDs that are not
present in the top-SQL collection.

`oracle_sql_plans` is another non-partitioned lookup table. Each row represents
one operation in a cached cursor plan, keyed by source database, instance, SQL
ID, child number, plan hash, and plan line ID. The scraper uses the same bounded
interval-delta candidate set for SQL text and plans, and avoids querying plans
already collected while they remain active candidates. A selected cursor may
age out of Oracle before the detail pass; its frequent SQL statistics remain
valid, while text or plan details can be unavailable. The stored cardinality,
cost, bytes, and predicate values are optimizer estimates; runtime `ALLSTATS`
data is not enabled or collected.

Unchanged cursor metadata advances `last_seen_at` at most once per UTC day;
schema or module changes are stored immediately. This avoids rewriting stable
dimension rows every time the bounded detail collector runs. Cursor metadata
is deliberately non-partitioned because partitioning by `last_seen_at` would
move active rows between partitions and weaken natural-key uniqueness.

When PostgreSQL retention is enabled, SQL text and plan operations are deleted
only after their last known reference is older than the oldest retained daily
partition. Expired cursor metadata is removed through indexed, bounded batches
of at most 2,000 rows, with no more than five batches per hourly maintenance
cycle. When retention is disabled, lookup-table cleanup is also disabled.

## Native Operational Collection

Operational collection is enabled by default and runs at a slower cadence than
activity sampling:

```yaml
operational:
  enabled: true
  interval: 1m
  queryTimeout: 10s
```

It replaces the former `oracle-operational-metrics.toml` definition pack.
Known operational domains are stored in typed, daily-partitioned tables rather
than JSON labels in `oracle_metric_samples`:

| PostgreSQL table | Collected data |
| --- | --- |
| `oracle_database_status_samples` | Stable DBID/unique name, product/version, instance/database status, role, protection, open mode, startup time, container, and platform |
| `oracle_instance_samples` | Session/process counts, configured CPU/SGA/PGA limits, and observed SGA/PGA allocation |
| `oracle_resource_limit_samples` | Current, maximum, and configured Oracle resource utilization |
| `oracle_tablespace_samples` | Permanent and temporary used, allocated, and maximum tablespace capacity |
| `oracle_asm_diskgroup_samples` | ASM total, free, and usable capacity |
| `oracle_system_counter_samples` | Selected cumulative `GV$SYSSTAT` and `GV$SYS_TIME_MODEL` counters with reset-aware interval deltas |
| `oracle_wait_class_samples` | Cumulative wait-class time and reset-aware interval deltas |
| `oracle_system_metric_samples` | Selected bounded `GV$CON_SYSMETRIC` values |
| `oracle_dataguard_destination_samples` | Automatically detected redo transport destinations, configuration, synchronization, gap, and error state |
| `oracle_dataguard_lag_samples` | Standby transport/apply lag and source-datum freshness |
| `oracle_dataguard_process_samples` | Physical standby managed recovery and redo transport process state |
| `oracle_scrape_status` | Connectivity and collector success, duration, row count, and errors |
| `oracle_latest_scrape_status` | Current result per database and collector, maintained transactionally for dashboards and alerts |
| `harry_database_connection_state` | Current active, quarantined, or probing state plus DCD failure, attempt, duration, and recovery metadata |

The scraper keeps in-memory baselines for cumulative counters. The first sample
after startup has no delta. A lower subsequent value is marked as a counter
reset instead of producing a negative rate.

Data Guard monitoring has no separate configuration switch. Each operational
cycle performs a small membership query. Standalone databases skip the Data
Guard detail queries and write no Data Guard dataset rows. Detected primaries
collect destination health; configured and reachable standby services also
collect lag and recovery process state. Harry does not discover connection
descriptors or credentials for an unconfigured standby.

The instance-level CPU and I/O collector stores `DB CPU`, `DB time`, physical
read/write request counts, and physical read/write byte counts with
`con_id = 0`. `DB CPU` and `DB time` are measured in microseconds. Dividing a
`DB CPU` delta by elapsed wall-clock microseconds estimates consumed CPU cores;
the value is Oracle workload demand, not host CPU utilization. PDB-level
analytics are not collected.

Observed memory remains distinct from configured capacity. `sga_allocated_bytes`
and `pga_allocated_bytes` describe current Oracle allocation, while
`pga_max_allocated_bytes` is a high-water value since instance startup. These
measurements exclude operating-system and service overhead and do not by
themselves prove that reducing configured memory is safe.

Current-state rows for databases removed from the configuration expire with
the global PostgreSQL retention period. The `oracle_latest_scrape_status`
current-state table and views including
`oracle_latest_tablespace_samples`, `oracle_system_counter_rates`, and
`oracle_wait_class_rates` provide stable inputs for dashboards and alerts.
The latest tablespace, resource-limit, and ASM diskgroup views use the exact
timestamp recorded for their current collector result and only expose results
from the previous 24 hours. This avoids scanning retained partitions on
PostgreSQL replicas and prevents stale capacity data from appearing current.

## Runtime Pressure Telemetry

Harry records scheduler and repository timing without issuing any additional
queries against Oracle Database. The existing `oracle_scrape_status` history
continues to identify the duration and result of each collector for each Oracle
database. Three Harry-level tables describe scheduler cycles and current
connection recovery state:

| PostgreSQL table | Collected data |
| --- | --- |
| `harry_runtime_samples` | Partitioned cycle history: scheduling lag, Oracle collection duration, PostgreSQL repository duration, total duration, missed intervals, completed databases, samples, and errors |
| `harry_latest_runtime_status` | Latest cycle per HA scope and scheduler, maintained for dashboards and alerts |
| `harry_database_connection_state` | One current row per configured Oracle target; this is not retained event history |

`collection_duration_seconds` covers the concurrent Oracle collection phase.
`postgresql_write_duration_seconds` covers the complete repository phase,
including pool wait, partition checks, sample and latest-state writes, commit,
and any ingest-accounting or retention work performed before the scheduler can
continue. `total_duration_seconds` starts at the planned scheduler time, so it
also includes scheduling delay.

Dead Connection Detection is represented as its own scheduler in both runtime
tables. When an active connectivity check fails, Harry quarantines that target
and normal collectors stop using it. The fixed-interval DCD scheduler probes
queued targets strictly one at a time, records every attempt in
`oracle_scrape_status`, and returns a target to active collection only after
connection initialization and pool warmup succeed. The current-state table is
upserted transactionally and removes databases no longer present in the active
configuration.

Runtime records are completed only after the PostgreSQL phase ends. Harry
buffers them in memory for up to one minute and writes the batch with a normal
sample transaction, avoiding a separate transaction every two seconds. A
graceful shutdown flushes the final buffered rows; an abrupt process failure can
lose up to the buffered minute of runtime telemetry without losing sample rows
that already committed. After a PostgreSQL write failure, bounded buffered
runtime records are written when the repository recovers; a complete repository
outage still requires an independent availability check.

At the default `2s` activity, `15s` scheduled, and `5m` DCD intervals, one
active Harry HA scope produces approximately 49,248 narrow runtime rows per day
regardless of the number of monitored Oracle databases. The global retention
setting applies to `harry_runtime_samples`. Harry observes and reports pressure
but does not automatically throttle or change collection intervals: incident
periods are when complete diagnostic data is most valuable.

## Repository Ingestion Accounting

`harry_repository_daily_ingest` records Harry's successful PostgreSQL writes
with one row per source database and UTC day. Typed counters distinguish SQL,
session, activity, operational, additional-metric, collector-status, SQL-text,
and execution-plan writes. Timestamp columns record the first and latest sample
represented by each daily row and the most recent accounting flush.

Harry updates these counters in a separate transaction after sample data has
committed. Updates are buffered for five minutes to avoid adding one accounting
write to every scrape transaction. A failed accounting flush is retained in
memory and retried without reporting the already committed sample transaction
as failed. Graceful shutdown and HA leadership loss force a final flush; an
abrupt process or host failure can lose at most the buffered accounting window.

The accounting table uses the same daily partition creation and global
retention policy as native sample tables. It supports exact row-ingestion
trends, collector continuity checks, change detection, capacity projection,
and estimated physical-storage attribution without scanning high-volume fact
tables. Existing retained rows are not backfilled when the feature is first
deployed.

SQL text and plan counters represent successful write operations against
deduplicated lookup tables, not current distinct row counts. Physical bytes by
source database remain estimated because multiple databases share heap and
index pages inside each daily dataset partition.

## Additional Metrics

Additional metrics are optional SQL-derived measurements loaded from TOML or
YAML definition files:

```yaml
metrics:
  scrapeInterval: 15s
  definitions:
    - /etc/harry/application-metrics.toml
```

Each numeric result is stored as a row in:

```text
oracle_metric_samples
```

No additional metrics are collected when `metrics.definitions` is empty or
omitted. Native operational and performance collection continues normally.
The generic table is reserved for user-defined additional metrics.

## Choosing A Storage Model

Use `oracle_metric_samples` when a user-defined result is naturally a numeric
measurement with a bounded set of dimensions. Native tablespace, process, wait,
and resource measurements already have dedicated typed tables.

Use a dedicated collector and typed table when rows identify diagnostic
entities, dimensions grow without a practical bound, or dashboards need to
query many attributes efficiently. Examples include every SQL ID, SQL text,
session, cursor, execution plan, object, or blocking relationship.

PostgreSQL avoids a Prometheus time-series label explosion, but it does not make
cardinality free. Every unique label combination still creates stored rows, and
unbounded JSON labels increase storage, indexing, retention, and dashboard
costs. Estimate rows per collection cycle and retention before enabling a
medium- or high-cardinality definition.

See [Additional Metrics](../configuration/additional-metrics.md) for the file
schema, ordered override behavior, and examples.
