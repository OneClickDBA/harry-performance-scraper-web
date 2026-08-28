---
title: Preconfigured Operational Alerts
sidebar_position: 2
---

# Preconfigured Operational Alerts

The scraper repository supplies Grafana-managed alert rules in:

```text
docker-compose/grafana/alerting/oracle-operational-alerts.yaml
```

The rules evaluate PostgreSQL tables and views created by the scraper. Oracle
state rules run once per minute in the `Oracle operational alerts` group.
Repository-ingestion rules run every five minutes in the
`Harry repository ingestion alerts` group. A rule creates one alert instance
for each returned Oracle database, tablespace, resource, or ASM diskgroup.

The supplied thresholds and pending periods are starting values. Review them
against local capacity policy, collection intervals, maintenance procedures,
and notification requirements before treating them as production policy.

## Alert Summary

| Alert | Condition | Pending | Severity |
| --- | --- | --- | --- |
| Oracle scraper data is stale | Latest connectivity result is older than 180 seconds | 1 minute | Critical |
| Oracle database connectivity failed | Latest connectivity collection failed | 2 minutes | Critical |
| Oracle tablespace usage is high | Tablespace usage is greater than 90% | 5 minutes | Warning |
| Oracle resource limit usage is high | A finite Oracle resource limit is greater than 85% utilized | 5 minutes | Warning |
| Oracle ASM diskgroup usage is high | ASM diskgroup usage is greater than 90% | 5 minutes | Warning |
| Harry repository ingestion accounting is stale | No accounting flush for more than 15 minutes | 5 minutes | Critical |
| Harry SQL sample ingestion dropped sharply | Previous complete UTC day is below 20% of the prior seven-day average | 15 minutes | Warning |
| Harry repository ingestion increased sharply | Previous complete UTC day exceeds three times the prior seven-day average | 15 minutes | Warning |

Grafana evaluates thresholds with a strict `greater than` comparison. A value
equal to the threshold is not yet firing.

The provisioned rules implement each condition with a `reduce(last)` expression
followed by a boolean Math expression. This form works across Grafana 9, 12,
and 13 while retaining the labels for each database, tablespace, resource, or
ASM diskgroup. Do not replace these expressions with the newer `threshold`
command when Grafana 9 must remain supported.

## Oracle Scraper Data Is Stale

This alert reads the latest `connectivity` row from the current-state table
`oracle_latest_scrape_status` and measures its age. It detects a scraper that
has stopped writing even when the last recorded collection was successful.
Complete absence of connectivity rows and PostgreSQL query errors are also
treated as alerting conditions.

Start with:

```sql
select
    source_database,
    collected_at,
    success,
    extract(epoch from (now() - collected_at)) as age_seconds,
    error_message
from oracle_latest_scrape_status
where collector = 'connectivity'
order by collected_at;
```

Confirm that the scraper process is alive, scheduled scrapes are still running,
and PostgreSQL accepts writes. Check scraper and PostgreSQL logs before
restarting either service. If `metrics.scrapeInterval` is intentionally close
to or greater than three minutes, increase the stale threshold accordingly.

## Oracle Database Connectivity Failed

This alert fires when the latest `connectivity` status has `success = false`.
It is separate from the stale alert: a failing scraper can continue recording
fresh connection failures.

Inspect `error_message` in `oracle_latest_scrape_status` and the scraper log.
Test the same connect descriptor and monitoring account outside the scraper.
Typical causes include DNS or routing failures, listener/service registration,
expired or locked credentials, wallet problems, database maintenance, and
connection-profile limits.

Resolve the underlying Oracle or network problem and verify that a newer
successful `connectivity` row replaces the failed result.

## Oracle Tablespace Usage Is High

This alert reads `oracle_latest_tablespace_samples` and creates one instance per
database and tablespace above 90%. It covers permanent and temporary
tablespaces.

Use the Oracle Operational Overview to distinguish sustained growth from a
temporary spike. Verify datafile autoextend, `MAXSIZE`, filesystem or ASM
capacity, and expected growth before adding space. For temporary tablespaces,
identify active work areas and abnormal spill activity before resizing.

The PostgreSQL source can be checked directly:

```sql
select *
from oracle_latest_tablespace_samples
where used_percent > 90
order by used_percent desc;
```

## Oracle Resource Limit Usage Is High

This alert reads `oracle_latest_resource_limit_samples`. It evaluates only
resources with a finite positive `LIMIT_VALUE`; Oracle resources reported as
`UNLIMITED` are excluded.

The alert commonly identifies pressure on `processes`, `sessions`, transaction
resources, or other instance limits exposed by `GV$RESOURCE_LIMIT`. Check the
affected `inst_id`, compare current and maximum utilization, and determine
whether the cause is expected concurrency, connection leakage, or an
undersized Oracle parameter before increasing the limit.

```sql
select *
from oracle_latest_resource_limit_samples
where not limit_unlimited
  and limit_value > 0
  and used_percent > 85
order by used_percent desc;
```

## Oracle ASM Diskgroup Usage Is High

This alert reads `oracle_latest_asm_diskgroup_samples` and fires above 90% used
capacity.

Check `usable_bytes` as well as total and free bytes. ASM redundancy, offline
disks, rebalance operations, and required mirror space can make usable capacity
more important than the simple used percentage. Confirm expected database
growth and recovery headroom before adding disks, moving files, or dropping
content.

```sql
select *
from oracle_latest_asm_diskgroup_samples
where used_percent > 90
order by used_percent desc;
```

## Harry Repository Ingestion Accounting Is Stale

Harry buffers native ingest counters and normally flushes them to
`harry_repository_daily_ingest` every five minutes. This alert fires when a
configured database has no successful accounting flush for more than 15
minutes. A database with no accounting row is also considered stale.

Start with:

```sql
select
    source_database,
    max(last_flushed_at) as last_flushed_at,
    now() - max(last_flushed_at) as accounting_age
from harry_repository_daily_ingest
group by source_database
order by last_flushed_at;
```

Confirm which Harry instance owns the HA advisory lock, then inspect its logs,
PostgreSQL connectivity, transaction failures, and the
**Repository Ingestion Continuity** panel. This alert complements collector
status: samples can be committed while a separate accounting flush is being
retried. An abrupt failure can lose up to five minutes of buffered accounting;
a persistent age beyond 15 minutes is not normal.

## Harry SQL Sample Ingestion Dropped Sharply

This rule compares the previous complete UTC day's `sql_sample_rows` with the
average of the preceding seven complete days. It fires below 20% of that
baseline, and only after at least four baseline days exist with an average of
at least 1,000 SQL rows per day.

Review the **Ingestion Change vs 7-Day Baseline** panel, SQL collector errors,
Oracle privileges, connectivity, configured intervals, and whether the source
database was deliberately idle or unavailable. Weekends, maintenance windows,
batch schedules, and workload migrations can cause legitimate changes. Tune or
disable this starter rule where the workload is not comparable by weekday.

## Harry Repository Ingestion Increased Sharply

This rule compares all recorded repository writes for the previous complete
UTC day with the preceding seven-day average. It fires above three times the
baseline, and only after at least four baseline days exist with an average of
at least 10,000 rows per day.

Use **Daily Recorded Rows by Dataset** to identify the dataset responsible,
then review scrape intervals, newly enabled collectors, added databases, and
actual Oracle workload changes. Check **Projected 30-Day Ingest Storage** and
retention capacity before accepting sustained growth. Like the SQL drop rule,
this is a trend signal rather than proof of a scraper fault.

The two baseline alerts use complete UTC days. They do not compare partial
current-day data with complete historical days. Accounting is not backfilled
when upgrading, so these rules remain quiet until enough post-upgrade history
has accumulated.

## Evaluation Errors And No Data

All supplied rules use `execErrState: Alerting`. A firing rule can therefore
represent an unavailable PostgreSQL datasource or invalid query rather than an
Oracle threshold breach. Inspect the alert instance reason and Grafana server
logs when the displayed value is absent.

Verify:

- the Grafana PostgreSQL datasource UID is `PostgreSQL`;
- alert query models use `type: postgres`; this is the native Grafana 9 plugin
  ID and a supported PostgreSQL plugin alias in Grafana 12 and 13;
- the datasource account can select the scraper tables and views;
- the datasource account can select `harry_repository_daily_ingest`;
- PostgreSQL and Grafana can reach each other;
- schema auto-migration created the required latest-state views;
- the alerting provisioning file loaded without errors.

When an alert shows `Alerting (Error)` and annotation variables such as
`source_database` render as `<no value>`, Grafana did not receive a successful
query result. The instance contains only the rule's static labels, so this is
not evidence that the displayed Oracle threshold was breached. If every
supplied rule fails together, check the datasource UID, datasource plugin type,
PostgreSQL connectivity, and Grafana server log before investigating Oracle.
An `invalid command type ... 'threshold'` message means an older alert rule is
still loaded; deploy the current rules, which use `reduce` and `math`, then
restart Grafana or reload alert provisioning.

Availability rules treat no data as alerting because silence may mean that the
scraper never wrote connectivity state. Capacity rules treat no data as normal
because a database may legitimately have no ASM rows or no finite resource
limits. Collector failures remain visible through `oracle_scrape_status`.

## Changing The Rules

File-provisioned rules are managed from YAML and cannot be permanently edited
in the Grafana UI. Change thresholds, pending periods, labels, or no-data
behavior in `oracle-operational-alerts.yaml`, then restart Grafana or reload
alert provisioning through the Grafana Admin API.

Keep the rule queries and the Current Capacity Risks panel in Oracle Alerting
Overview aligned when thresholds change. The native Alert list remains the
authoritative source for firing, pending, no-data, and error state.

See [Grafana Alerting](../configuration/grafana-alerting.md) for provisioning,
notification, and independent monitoring requirements.
