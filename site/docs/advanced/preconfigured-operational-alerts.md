---
title: Preconfigured Operational Alerts
sidebar_position: 2
---

# Preconfigured Operational Alerts

The scraper repository supplies Grafana-managed alert rules in:

```text
docker-compose/grafana/alerting/oracle-operational-alerts.yaml
```

The rules evaluate PostgreSQL views created by the scraper. They run once per
minute in the `Oracle operational alerts` group and create one alert instance
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
