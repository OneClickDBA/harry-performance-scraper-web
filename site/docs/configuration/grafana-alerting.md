---
title: Grafana Alerting
sidebar_position: 3
---

# Grafana Alerting

Grafana can evaluate alert rules directly against the scraper's PostgreSQL
tables and views. Prometheus is not required for Oracle operational alerts.

The project supplies starter rules for stale scraper data, failed Oracle
connectivity, tablespace utilization, finite Oracle resource limits, and ASM
diskgroup utilization. The Docker Compose stack provisions them from:

```text
docker-compose/grafana/alerting/oracle-operational-alerts.yaml
```

The global Oracle Alerting Overview dashboard is provisioned from:

```text
docker-compose/grafana/dashboards/oracle-alerting-overview.json
```

It has no database variable. Its Alert list panels show Grafana's current
firing, pending, no-data, error, and normal alert instances across all monitored
databases. Supporting PostgreSQL panels show collector freshness and errors,
capacity risks, and current database state. Select a database in those tables
to open its Oracle Operational Overview dashboard.

Production packages can place the same file under Grafana's
`provisioning/alerting` directory. File-provisioned rules are managed as code
and cannot be edited permanently in the Grafana UI.

Configure a real Grafana contact point and notification policy before relying
on these rules. Thresholds and pending durations are starting values, not
universal Oracle capacity policy.

See [Preconfigured Operational Alerts](../advanced/preconfigured-operational-alerts.md)
for each supplied rule's condition, pending period, PostgreSQL source, and initial
troubleshooting steps.

## Monitoring The Monitoring System

:::danger  
Critical monitoring dependency

PostgreSQL-backed Grafana alerts **cannot report that their entire evaluation
stack is down**.

If Grafana stops, no rules are evaluated. If PostgreSQL stops, Oracle
measurements cannot be stored or queried. If the scraper stops, no new Oracle
state reaches PostgreSQL. A failure of these components can therefore produce
silence instead of an alert.

Production deployments must use an independent availability check for:

- every scraper process and its `/healthz` endpoint;
- at least one successful `/readyz` endpoint per HA scope;
- the PostgreSQL service and monitoring database;
- the Grafana process and HTTP endpoint;
- the notification path used by Grafana.

:::

The independent check should run outside the monitored stack. Suitable options
include an existing infrastructure monitor, an external uptime service, a
separate management host, or a simple systemd/cron watchdog that notifies
through an independent channel. It does not require Prometheus, but it must not
depend exclusively on this scraper's PostgreSQL database or Grafana instance.

The native `oracle_scrape_status` table complements that external check. It
records connectivity and collector success, duration, row count, and errors.
The `oracle_latest_scrape_status` current-state table lets Grafana detect stale
or failed collection while Grafana and PostgreSQL remain operational. Harry
updates it transactionally with the partitioned `oracle_scrape_status` history,
so alert evaluation does not scan retained status partitions.

The Oracle Alerting Overview dashboard has the same dependency. It is an
operator console, not an independent availability monitor: it cannot render or
report that Grafana itself is unavailable.

## PostgreSQL Query Requirements

Grafana alert conditions use time-series queries. Each query must return a
`time` column and at least one numeric value. String columns become alert
labels, allowing one rule to create separate instances for each Oracle
database, tablespace, resource, or diskgroup.

Dashboard variables such as `$source_database` are not available to alert
rules. The supplied rules query all configured databases and return
`source_database` as an alert label.

Use a dedicated PostgreSQL account with `SELECT` access to the scraper schema
for the Grafana datasource. Do not give the Grafana datasource account schema
ownership or write privileges.

## No-Data And Error Behavior

The supplied availability rules treat datasource errors and complete absence
of connectivity rows as alerting conditions. Capacity rules use `OK` for no
data because ASM and some resource classes may legitimately not exist;
failures of those collectors are visible through `oracle_scrape_status`.

Review these settings for the local operating model. Never configure every
availability rule to treat both query errors and no data as healthy.
