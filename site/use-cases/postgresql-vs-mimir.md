---
title: "When Oracle Performance Data Becomes a Cardinality Problem"
sidebar_position: 3
slug: "oracle-performance-prometheus-cardinality"
description: "A measured use case showing why detailed Oracle SQL, plans, sessions and activity history fit a relational repository better than a Prometheus-compatible time-series model."
---

# When Oracle Performance Data Becomes a Cardinality Problem

Prometheus is excellent at metrics. Grafana Mimir is designed to scale those
metrics across large environments.

But diagnosing Oracle Database performance requires more than conventional
metrics.

When a database slows down, knowing that CPU, sessions or wait time increased
is only the beginning. A DBA must answer much more specific questions:

- Which SQL statement was responsible?
- What was its complete SQL text?
- Which child cursor and execution plan did it use?
- Did the plan change?
- Which sessions were involved?
- Was another session blocking it?
- What was each session waiting for at that moment?

That information is relational, highly dimensional and constantly changing.
Treating every SQL ID, plan operation, session and wait relationship as a
Prometheus label set creates a cardinality problem very quickly.

This is why **Harry - Performance Scraper for Oracle Database** uses PostgreSQL
as its complete performance repository. Organisations that also use
Prometheus/Mimir can reserve it for the smaller set of bounded operational
metrics and alerts that naturally fit a time-series model.

## The use case

We analysed real data collected by Harry from an anonymised benchmark
environment monitoring **25 Oracle databases**.

The objective was simple: estimate how many Prometheus-compatible time series
would be required to preserve Harry's existing troubleshooting capabilities,
including:

- SQL performance history;
- `SQL_ID`, child cursor and plan-hash navigation;
- complete SQL text;
- cached execution-plan operations;
- session and blocking relationships;
- detailed database activity history;
- conventional operational metrics and scraper health.

The analysis was executed over two hours, 24 hours and 30 days of retained
data. A 15-minute safety timeout protected the running environment. The two
largest full-retention cardinality scans exceeded that limit, so their results
are absent from the 30-day total. The reported result is therefore a **lower
bound**, not a complete estimate.

The model counts the distinct label sets and scalar metrics needed to retain
the dimensions Harry currently makes queryable. It does not add deployment
labels such as environment, region, cluster, job, scraper instance or HA
replica, and it does not include recording rules.

The analysis deliberately does **not** estimate samples per second. That rate
depends on a Prometheus publication design that does not exist: which entities
would be emitted on every scrape, how long current-state metadata would remain
exposed, and how stale SQL and plan series would be retired. Distinct series
can be measured from the retained data; a reliable ingestion rate cannot.

## What the measurements showed

| Window | Distinct equivalent Prometheus/Mimir series |
|---:|---|
| **2 hours** | Approximately 1.05 million |
| **24 hours** | Approximately 4.54 million |
| **30 days** | Partial lower bound of approximately 15.09 million |

These figures represent unique series identities observed within each window.
They are not concurrent active series, Head series or an ingestion-rate
estimate. The 30-day value excludes the two scans that exceeded the safety
timeout, so it must not be treated as a complete total.

The most important result was not simply the total. It was where the
cardinality came from.

At 24 hours, the bounded operational and scraper-health data represented only
approximately **13,300 stable series**. SQL detail, execution plans, sessions,
blocking and activity history produced **99.7% of the estimated series**.

In other words, infrastructure-style Oracle metrics were not the problem. The
cardinality came from preserving the exact information that makes deep
performance investigation possible.

## What the measurements do and do not prove

The measurements show that preserving Harry's existing troubleshooting
dimensions as Prometheus metric identities creates substantial cardinality and
label churn. They do not prove how much CPU, memory or storage a particular
Mimir deployment would require.

Sizing Mimir would first require a complete publication design and a controlled
load test covering scrape cadence, active-series lifetime, staleness, label
length, recording rules, replication and query patterns. Assigning
samples-per-second or infrastructure requirements without that design would be
speculation.

It is also possible to reduce cardinality by dropping labels or retaining only
aggregated metrics. That can be a good monitoring design, but it no longer
preserves the SQL-, plan-, session- and execution-level investigation described
in this use case. The relevant comparison is equivalent troubleshooting
functionality, not a reduced metric subset presented as the same system.

## The same workload in Harry

The reference Harry deployment runs as a three-node PostgreSQL/Patroni cluster.
Each node has:

- 6 CPU cores;
- 5 GB RAM;
- a 400 GB disk.

With 30 days of retention, each PostgreSQL node uses approximately 240 GB. CPU
utilisation on the primary remains below 5%, while the replicas have negligible
load. These are observations from this deployment, not universal PostgreSQL
capacity guarantees.

That is the practical advantage of using a relational repository for
relational performance data. PostgreSQL stores SQL text once, represents
execution plans as ordered rows, preserves typed attributes and joins related
entities by keys. It does not need to turn every descriptive field and state
change into a new metric identity.

## Why not emit every plan only once?

A Prometheus implementation could reduce ingestion by emitting SQL text and
plan information only once.

However, that changes the result:

- the series becomes stale for ordinary instant queries;
- historical lookups require long-range PromQL queries;
- joins between workload metrics and metadata become more expensive and
  fragile;
- a separate metadata database may still be required for full SQL text and
  plan reconstruction.

That can be a valid reduced monitoring design, but it is not equivalent to
Harry's complete historical repository.

SQL text also demonstrates a fundamental format mismatch. Mimir's default
maximum label-value length is 2,048 bytes, while the benchmark contained SQL
text exceeding 106,000 bytes. The default behaviour rejects over-limit label
values. Truncating or hashing the label may preserve an identifier, but it does
not preserve the statement a DBA needs to investigate. See
[Grafana Mimir configuration limits](https://grafana.com/docs/mimir/latest/configure/configuration-parameters/).

## The right tool for each layer

Harry does not compete with Prometheus or Mimir for conventional
infrastructure metrics. It complements them.

The resulting architecture can remain deliberately simple:

- **Harry and PostgreSQL/Patroni:** complete Oracle performance history, SQL
  text, execution plans, session state, blocking, operational history and
  forensic drill-down.
- **Grafana:** dashboards and, where permitted, PostgreSQL-backed alerting.
- **Optional Prometheus/Mimir integration:** bounded alert metrics for
  organisations that require an existing Prometheus/Alertmanager path.

Teams can keep their existing Prometheus, Mimir and Grafana investments while
adding the detailed Oracle visibility that a metrics-only model cannot provide
efficiently.

## From an alert to an answer

An alert can tell you that an Oracle database is under pressure.

Harry helps explain why.

Instead of choosing between lightweight alerting and deep database analysis,
use each storage engine for the workload it handles best. Harry provides the
missing forensic layer: high-frequency Oracle performance history that remains
searchable, structured and useful when the incident is already over.

If you need to investigate SQL behaviour, compare execution plans, trace
blocking sessions or retain detailed Oracle performance history without
turning every database entity into a metric label, Harry was built for that
job.

[Open the public Harry demo](https://demo.harryperformance.com/),
[explore Harry](https://oneclickdba.com/harry/) or
[contact OneClickDBA](https://oneclickdba.com/) to discuss an Oracle
performance monitoring deployment.
