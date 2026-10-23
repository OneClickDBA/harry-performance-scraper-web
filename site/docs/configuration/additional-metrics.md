---
title: Additional Metrics
sidebar_position: 2
---

# Additional Metrics

Additional metric definitions let the scraper run Oracle SQL queries without a
new native collector. Numeric query results are stored in
`oracle_metric_samples` with their context, metric name, type, help text, and
labels.

This mechanism is optional. It is best suited to operational measurements with
bounded dimensions and to deliberately selected medium-cardinality data whose
row volume and retention have been evaluated. Diagnostic entities with
unbounded or rapidly changing dimensions should use a dedicated typed
collector, table, and dashboard.

## Configuration

List TOML or YAML files under `metrics.definitions`:

```yaml
metrics:
  scrapeInterval: 15s
  definitions:
    - /etc/harry/application-metrics.toml
```

The list is optional. If it is absent or empty, native operational and
performance collection continues normally.

Files are loaded in list order. If multiple files generate the same internal
metric identifier, the definition from the last file wins. All listed files are
watched and hot-reloaded. A parsing failure during hot reload preserves the last
known good definitions and is retried on later collection cycles.

The pre-beta configuration keys `metrics.default` and `metrics.custom` have
been removed. Strict configuration parsing rejects them; replace both with one
ordered `metrics.definitions` list.

## Native Operational Metrics

Database state, instance utilization, resource limits, tablespaces, ASM,
system counters, wait classes, system ratios, and collection health are native
typed datasets. They are configured under `operational:` and are not additional
metric definitions.

The former pre-beta `oracle-operational-metrics.toml` and YAML files were
removed to prevent the same values being written a second time to
`oracle_metric_samples`.

## Metric Schema

Metric files contain a series of `[[metric]]` definitions in TOML, or the
equivalent `metrics` list in YAML.

| Field | Description | Required | Default |
| --- | --- | --- | --- |
| `context` | Stored context and part of the generated metric identifier. | Yes | |
| `labels` | Query columns stored in the JSON `labels` column. Other numeric columns become values. | No | `[]` |
| `metricsdesc` | Value-column names mapped to human-readable descriptions. | Yes | |
| `metricstype` | Value-column names mapped to type metadata, usually `gauge` or `counter`. | No | `gauge` |
| `metricsbuckets` | Legacy histogram bucket metadata for compatible definitions. | No | |
| `fieldtoappend` | Query column appended to the metric name instead of stored as a label. | No | |
| `request` | Oracle SQL query without a trailing semicolon. | Yes | |
| `ignorezeroresult` | Suppress an error when the query returns no rows. | No | `false` |
| `querytimeout` | Per-definition timeout such as `300ms`, `10s`, or `0.5h`. | No | Database timeout |
| `scrapeinterval` | Collect this definition less frequently than the global schedule. | No | Global interval |
| `databases` | Named database entries where this definition runs. | No | All databases |

## TOML Example

```toml
[[metric]]
context = "application_queue"
labels = [ "inst_id", "queue_name" ]
metricsdesc = { pending = "Messages waiting for processing." }
metricstype = { pending = "gauge" }
request = '''
select inst_id, queue_name, count(*) as pending
from application_queue
where processed = 0
group by inst_id, queue_name
'''
ignorezeroresult = true
querytimeout = "10s"
```

The scraper writes one `oracle_metric_samples` row for each numeric value column
returned by each query row.

```sql
select
  collected_at,
  source_database,
  context,
  metric_name,
  metric_type,
  value,
  labels
from oracle_metric_samples
where context = 'application_queue'
order by collected_at desc;
```

## Cardinality Guidance

Good user-defined candidates have a naturally bounded set of label combinations:

- application queue depth by a controlled queue name;
- business transaction counts by a controlled application status;
- application-specific capacity that is not part of native collection.

Definitions require additional review when labels contain tenant, application,
object, service, or other values that can grow continually. Estimate storage as
approximately:

```text
databases x query rows x numeric value columns x collections retained
```

Avoid generic labels for SQL text, SQL ID, SID/serial number, child cursors,
plan hashes, arbitrary object names, request IDs, or other unbounded values.
Use or extend the native performance tables for those cases.

## Database Selection

By default, a definition runs against every configured Oracle database. Limit
it with `databases`:

```toml
[[metric]]
context = "db_platform"
labels = [ "platform_name" ]
request = "select platform_name, 1 as value from gv$database"
metricsdesc = { value = "Database platform." }
databases = [ "prod1", "prod2" ]
```

Set `databases = []` to disable a definition without deleting it.

## YAML Example

```yaml
metrics:
  - context: application_queue
    labels: [queue_name]
    metricsdesc:
      pending: Messages waiting for processing.
    request: |
      select queue_name, count(*) as pending
      from application_queue
      where processed = 0
      group by queue_name
```

## Container Images

Mount user-defined files and list their paths under `metrics.definitions`. A
missing or invalid definition file is reported in the scraper log.
