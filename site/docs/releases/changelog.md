---
title: Changelog
sidebar_position: 2
---

# Release Notes

List of upcoming and historic changes to the scraper.

### Next, TBD

- Consolidate identical ASM diskgroup capacity observations across databases
  in the global Alerting Overview dashboard and provisioned Grafana alert, so
  databases sharing ASM do not produce duplicate rows or duplicate alerts.

### 0.2.1, 2026-08-13

- Replace the unbounded `oracle_latest_scrape_status` view with a small
  transactionally maintained current-state table keyed by database and
  collector. Backfill it during upgrades and use it for Grafana dashboards,
  alert evaluation, and SQL Exporter reads without scanning retained history.
- Stop the DAH Average Active Sessions panel from drawing lines across periods
  with no activity samples, so idle or unavailable intervals remain visible as
  gaps instead of misleading interpolation.
- Serialize and pace godror physical OCI connection creation across all Oracle
  pools. This prevents synchronized pool expiration or reconnect attempts from
  entering `dpiConn_create` concurrently and aborting the process with native
  heap-corruption errors; established connections and queries remain
  concurrent.
- Add default-enabled active/standby operation using PostgreSQL advisory-lock
  leader election with human-readable scopes, writable-primary validation,
  multi-host connection support, and distinct `/healthz` and `/readyz`
  endpoints. Standbys avoid Oracle and write-pool initialization; leaders exit
  non-zero on leadership loss for clean service-manager restart. Document that
  PostgreSQL quorum and fencing remain mandatory to prevent split brain.
- Run two Harry instances in the Docker Compose test stack, expose their
  liveness/readiness endpoints on ports `9161` and `9162`, and document a
  repeatable kill, takeover, and standby-rejoin test.
- Assign ownership of Harry and its original components to Jorge Holgado, with
  commercial support provided under the OneClickDBA brand.
- Add signed-tag GitHub Releases with checksummed `go-ora` and `godror`
  binaries, plus multi-architecture Oracle Linux 8/9 images published to GitHub
  Container Registry. Derive release versions from tags and identify untagged
  builds as `0.0.0-dev`.
- Rename the project to **Harry - Performance Scraper for Oracle Database**,
  including the `harry-scraper` executable and service, GitHub repositories,
  container images, Go module, Kubernetes objects, configuration paths, Oracle
  client identifier, Grafana alert labels, and release archives.
- Rename the default PostgreSQL database and role to `harry_monitoring`.
- Replace the unavailable Oracle attribution-helper process with a reproducible
  `go-licenses` pipeline that generates notices for every released driver and
  operating-system variant and verifies the committed inventory in CI.
- Promote standard Oracle operational measurements from the optional generic
  definition pack into default-enabled native collectors and typed,
  daily-partitioned PostgreSQL tables for database state, instance load,
  resource limits, tablespaces, ASM, system counters, wait classes, and system
  metrics.
- Add reset-aware interval deltas and stable PostgreSQL rate/latest-state views
  for efficient Grafana dashboards and alert evaluation.
- Persist per-database connectivity and collector success, duration, sample
  count, and errors in `oracle_scrape_status`, including failed scrapes that
  produce no Oracle measurements.
- Add an Oracle Operational Overview dashboard and provisioned Grafana alerts
  for stale collection, connectivity, tablespace, resource-limit, and ASM
  pressure without requiring Prometheus.
- Add a global Oracle Alerting Overview dashboard with authoritative Grafana
  alert lists, cross-database collector health, stale-collector detection,
  capacity risks, database state, and direct investigation links. Link
  provisioned alert rules to their relevant context panels.
- Use the cross-version `postgres` datasource type in provisioned alert
  queries. It is native in Grafana 9 and retained as a PostgreSQL alias in
  Grafana 12 and 13, preventing evaluation-error alerts with missing query
  labels.
- Use portable Reduce and Math alert expressions instead of the newer Threshold
  command, preserving labeled alert instances across Grafana 9, 12, and 13.
- Document the critical requirement for an independent external availability
  check of the scraper, PostgreSQL, Grafana, and notification path, because a
  failed monitoring stack cannot alert on its own failure.
- Remove the superseded `oracle-operational-metrics.toml` and YAML files from
  images and release archives; `oracle_metric_samples` remains available only
  for user-defined additional metrics.
- Rank bounded SQL text and plan candidates by elapsed-time deltas accumulated
  from frequent `GV$SQLSTATS` samples instead of cumulative cursor lifetime,
  combining RAC instances and plan hashes by SQL ID.
- Split SQL troubleshooting into a four-category Oracle SQL Performance
  overview and a linked Oracle SQL Top Consumers dashboard with top-20 ranking,
  detailed time, workload and I/O graphs with fixed series colors, smooth
  DAH-style area rendering, and one-minute rate averaging that removes
  counter-update sawteeth without changing the stored samples. Include full SQL
  text and cached plans in the same drilldown.
- Add deterministic access, join, and sort colors to the Top Consumers
  execution-plan table, plus review signals for full scans, Cartesian joins,
  temporary-space estimates, and unusually large optimizer estimates.
- Serialize additional metric queries per database to prevent simultaneous OCI
  connection creation when pooled connections reach their maximum lifetime.
- Calculate the `GV$SQLSTATS.LAST_ACTIVE_TIME` lookback from each monitored
  database's `SYSDATE`, avoiding cross-time-zone SQL collection gaps, and remove
  the unsafe process-wide `ORA_SDTZ` recommendation for multi-database setups.
- Remove redundant source-database columns from Grafana table panels while
  retaining the dashboard-level database filters and internal query joins.
- Make Oracle ASH collection explicitly opt-in and default activity analytics
  to independent two-second `GV$SESSION` sampling. Persist the activity source
  and represented duration, use duration-weighted AAS calculations, and warn
  operators that enabling ASH requires them to verify Diagnostics Pack
  licensing.
- Move frequent SQL counter collection to recently active `GV$SQLSTATS` rows so
  short, high-frequency statements remain diagnosable without appearing in a
  session sample. Fetch `SQL_FULLTEXT` and child-plan identities only through
  the bounded, slower SQL detail pass.
- Add bounded, interval-controlled `GV$SQL_PLAN` collection for top SQL cursors,
  deduplicate plan operations in `oracle_sql_plans`, retain plans while they are
  referenced by SQL samples, and expose selected execution plans in the Oracle
  SQL Performance dashboard.
- Replace `metrics.default` and `metrics.custom` with one optional ordered
  `metrics.definitions` list. Native SQL, session, blocking, and DAH collection
  now runs without any generic metric definition file.
- Rename the supplied metric pack from `default-metrics.*` to
  `oracle-operational-metrics.*`, stop embedding it as a fallback, and remove
  its duplicated high-cardinality `top_sql` definition.
- Document the boundary between native typed performance collectors and
  additional SQL-derived metrics stored in `oracle_metric_samples`, including
  PostgreSQL cardinality and retention considerations.
- Normalize Oracle SQL text into `oracle_sql_texts`, collect complete
  `SQL_FULLTEXT` once per source database and SQL ID, and expire unreferenced
  text with the global PostgreSQL retention policy. The SQL Performance
  dashboard keeps short previews and adds a full-width selected-SQL text panel.
- Rename the project runtime to scraper terminology, including Go types, the default binary name, Docker targets, sample manifests, and active documentation.
- Replace the Prometheus scrape endpoint runtime with scheduled Oracle metric collection that writes neutral metric samples to PostgreSQL using batched `COPY` inserts.
- Add PostgreSQL output configuration, schema auto-migration for scrape summaries and metric samples, and example configuration entries.
- Remove Prometheus collector, logging, web toolkit, and client dependencies from the scraper code.
- Add PostgreSQL to the Docker Compose test stack and configure the scraper examples to write to it.
- Build the Docker Compose scraper service from the local fork image instead of Oracle's published Prometheus endpoint image.
- Add direct Oracle performance scraping for `GV$SQL`, `GV$SESSION`, and blocking sessions, with dedicated PostgreSQL tables and a starter Grafana dashboard backed by PostgreSQL.
- Add PostgreSQL Grafana dashboard filters and live `SQL_ID` panels for currently active Oracle sessions.
- Preserve available Oracle performance samples when one of the SQL, session, or blocking-session queries fails.
- Document the Oracle PDB scope of monitoring users and the additional `GV_$SQL` permission required for SQL performance samples.
- Pass explicit Go build arguments through the local Compose image build for compatibility with Podman builds.
- Add PostgreSQL activity-history storage and a dedicated DAH Grafana dashboard.
- Split Docker builds into a reusable `build-deps` stage and wire the local compose build to reuse that dependency image cache.
- Include collected Database Activity History samples in the aggregated PostgreSQL write payload.
- Replace the scrape-summary parent table with daily range-partitioned PostgreSQL sample tables and create partitions on demand before writing samples.
- Add a single PostgreSQL sample retention setting that drops expired daily partitions across all sample tables.
- Add per-database `connMaxIdleTime` for Oracle connections so idle pooled sessions can be recycled before database profile `IDLE_TIME` kills them.
- Remove the duplicated raw JSON payload from `oracle_metric_samples` to reduce PostgreSQL storage usage.
- Remove DAH-overlapping activity history panels from the Oracle DB Performance Grafana dashboard.
- Add DAH Grafana drilldowns for top wait events and module/program activity.
- Change the DAH SQL_ID activity panel to a stacked top-SQL timeline using interval buckets and total/max legend values.
- Add a PostgreSQL-backed Oracle SQL Performance Grafana dashboard for high-cardinality SQL diagnostics.
- Refactor the Oracle DB Performance Grafana dashboard into a current sessions and blocking dashboard.
