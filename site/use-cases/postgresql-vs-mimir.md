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
as its complete performance repository and reserves Prometheus/Mimir for the
smaller set of metrics that naturally belong there.

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
the dimensions Harry currently makes queryable. Current-state SQL text and
plan rows are assumed to remain exposed at a 15-second scrape interval while
they are relevant. It does not add deployment labels such as environment,
region, cluster, job, exporter instance or HA replica, and it does not include
recording rules.

## What the measurements showed

| Window | Equivalent Prometheus/Mimir workload |
|---:|---|
| **2 hours** | 1.05 million series and an average 37,700 samples/s |
| **24 hours** | 4.54 million retained series and an average 102,600 samples/s |
| **30 days** | Partial lower bound of 15.09 million retained series; at least 9.79 million continuously exposed series |
| **60 days** | Growth forecast of at least 30.2 million retained series and approximately 19.6 million continuously exposed series |

The most important result was not simply the total. It was where the
cardinality came from.

At 24 hours, the bounded operational and scraper-health data represented only
approximately **13,300 stable series**. SQL detail, execution plans, sessions,
blocking and activity history produced **99.7% of the estimated series**.

In other words, infrastructure-style Oracle metrics were not the problem. The
cardinality came from preserving the exact information that makes deep
performance investigation possible.

## What would Mimir require?

Grafana's official capacity-planning guidance provides the following baseline
figures:

- one distributor CPU core and 1 GB of distributor RAM per 25,000 samples/s;
- one ingester CPU core, 2.5 GB of ingester RAM and 5 GB of local disk per
  300,000 in-memory series;
- in-memory series multiplied by the replication factor for high availability;
- 50% additional memory and disk capacity for production headroom.

Sources: [Grafana Mimir capacity planning](https://grafana.com/docs/mimir/latest/manage/run-production-environment/planning-capacity/)
and [Mimir ingest-storage architecture](https://grafana.com/docs/mimir/latest/get-started/about-grafana-mimir-architecture/about-ingest-storage-architecture/).

Applying those published ratios to the measured workload, with three ingester
zones and Grafana's recommended headroom, gives the following write-path
capacity model:

| Retention window | Estimated Mimir write path* |
|---:|---|
| **2 hours** | Approximately 12 CPU, 42 GB RAM and 79 GB local ingester disk |
| **24 hours** | Approximately 20 CPU, 66 GB RAM and 120 GB local ingester disk |
| **30 days** | Lower bound of approximately 124 CPU, 406 GB RAM and 734 GB local ingester disk, plus at least 2.56 TB of logical object-storage capacity |
| **60 days** | Growth forecast of approximately 248 CPU, 812 GB RAM and 1.47 TB local ingester disk, plus approximately 10.2 TB of logical object-storage capacity |

\*These figures cover only distributors and ingesters. They exclude the
Kafka-compatible ingest-storage layer, queriers, query-frontends,
store-gateways, compactors, caches and physical object-storage replication.
Object-storage figures use the documented two-bytes-per-sample planning
assumption; actual compression, label length, traffic patterns and deployment
configuration will change the result.

This is not a generic benchmark claiming that Mimir always requires these
resources, nor is it a comparison of raw PostgreSQL bytes with Mimir bytes. It
is a capacity model for translating **this specific Oracle forensic data
model** into continuously queryable Prometheus series.

## The same workload in Harry

The reference Harry deployment runs as a three-node PostgreSQL/Patroni cluster.
Each node has:

- 6 CPU cores;
- 5 GB RAM;
- a 400 GB disk.

With 30 days of retention, each PostgreSQL node uses approximately 240 GB. CPU
utilisation on the primary remains below 5%, while the replicas have negligible
load.

Doubling retention to 60 days produces a simple linear forecast of
approximately 480 GB per node. Increasing each disk to around 600 GB would
provide comfortable headroom without changing the architecture or increasing
CPU and RAM. Actual growth should still be measured because workload and data
retention are not always linear.

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

The resulting architecture is deliberately simple:

- **Harry and PostgreSQL/Patroni:** complete Oracle performance history, SQL
  text, execution plans, session state, blocking and forensic drill-down.
- **Prometheus/Mimir:** bounded health metrics, alert conditions and fleet-level
  operational visibility.
- **Grafana:** one presentation layer across both data sources.

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

[Explore Harry](https://oneclickdba.com/harry/) or
[contact OneClickDBA](https://oneclickdba.com/) to discuss an Oracle
performance monitoring deployment.
