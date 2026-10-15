---
title: "The missing information: connecting SQL pressure to application context"
sidebar_position: 2
slug: "sql-application-context"
description: "How Harry adds parsing schema, module, and child-cursor context without making frequent Oracle collection or PostgreSQL storage expensive."
---

# The missing information

A SQL performance ranking can identify the statement consuming the most
elapsed time, CPU, logical reads, or physical I/O. That is enough to prove that
there is pressure, but it does not always answer the next operational question:

> Which application context produced this SQL, and which cursor variants are
> involved?

Harry's Oracle SQL Performance dashboard originally showed `Schema`, `Module`,
and `Child` columns. They were empty. This was not a Grafana rendering problem
or missing PostgreSQL data: it exposed a deliberate tradeoff in the collection
model and raised a second question about where that context belongs.

## Why the information was missing

Harry's frequent SQL sampler uses `GV$SQLSTATS`. Oracle designed this view as a
faster, more scalable source of cumulative SQL statistics with longer retention
than the shared-pool cursor detail. It provides the counters Harry needs for
interval analysis: executions, elapsed time, CPU time, waits, buffer gets,
physical reads, and rows processed.

It does not provide the child-cursor number, parsing schema, or application
module required by those dashboard columns. Those values are available from
`GV$SQL`, but replacing the frequent `GV$SQLSTATS` query or joining every sample
to `GV$SQL` would move cost back onto every monitored Oracle database.

Harry therefore kept the scalable counter source and returned typed nulls for
the unavailable columns. The counters were correct, but useful investigation
context was absent.

## Reuse the bounded detail collection

Harry already has a second, deliberately bounded collection path. At the
configured SQL-plan interval it ranks recent interval deltas, selects only the
top SQL candidates, and queries `GV$SQL` for their full SQL text and cursor-plan
identity. The default is 20 candidates every two minutes.

The solution reuses that same query to retrieve:

- `CHILD_NUMBER`
- `PARSING_SCHEMA_NAME`
- `MODULE`
- `PLAN_HASH_VALUE`

No additional Oracle query, scan, collection thread, or privilege is required.
The additional payload is two short nullable strings on rows that Harry already
retrieves. `MODULE` can still be empty when the client application does not call
`DBMS_APPLICATION_INFO.SET_MODULE`; Harry cannot create instrumentation that the
application never supplied. Because the enrichment shares the SQL text and plan
detail path, disabling `performance.sqlPlans` also disables its collection.

## Store context as a dimension, not another time series

Copying schema and module into every frequent SQL sample would repeat stable
strings thousands of times. Instead, Harry stores one row in
`oracle_sql_cursor_metadata` for each:

```text
source database + instance + SQL ID + child number + plan hash
```

The row contains the parsing schema, module, `first_seen_at`, and
`last_seen_at`. The frequent partitioned `oracle_sql_samples` table remains
focused on counters. The `oracle_sql_samples_enriched` view can combine both
models for ad hoc analysis, but Harry's standard dashboards deliberately avoid
using it for broad rankings.

This distinction matters. `GV$SQLSTATS` counters are aggregated and must not be
misrepresented as belonging to one arbitrary child cursor when several cursor
variants were observed.

## Avoid write amplification

The bounded collector may see the same stable cursor every two minutes. Writing
`last_seen_at` every time would create hundreds of unnecessary PostgreSQL row
versions per cursor each day, generating WAL, dead tuples, autovacuum work, and
replica replay pressure.

Harry therefore applies two rules:

1. Changes to parsing schema or module are stored immediately.
2. An otherwise unchanged row advances `last_seen_at` at most once per UTC day.

Retention is measured in days, so sub-day precision adds cost without improving
the lifecycle decision.

## Why the metadata table is not partitioned

Daily partitioning is excellent for Harry's append-only sample facts because an
expired day can be dropped as one object. It is the wrong model for mutable,
deduplicated cursor metadata.

Partitioning by `last_seen_at` would move every active row to a new partition
each day. It would also require the partition key in PostgreSQL's unique key,
allowing copies of the same cursor identity in different partitions.
Partitioning by `first_seen_at` would be worse: dropping an old partition could
remove metadata for a cursor that remains active.

The metadata therefore remains a compact non-partitioned dimension with a
natural primary key and an index on `last_seen_at`.

## Retention without one large delete

Eventually, cursor variants disappear. Without cleanup the dimension would
grow forever, but one unbounded `DELETE` could generate a large transaction and
a burst of WAL.

Harry removes expired metadata in indexed batches:

- at most 2,000 rows per batch;
- no more than five batches in one hourly maintenance cycle;
- subsequent cycles continue when more expired rows remain;
- PostgreSQL autovacuum reclaims the resulting dead tuples for reuse.

There is no foreign key from historical samples to this optional context. A
metadata cleanup can never cascade into performance samples or block partition
retention. At worst, context is unavailable for an old sample after both data
lifecycles have moved beyond the configured retention window.

## Enrich only after selecting the SQL

Joining contextual metadata before ranking a large historical SQL-sample range
would make PostgreSQL carry schema, module, and child-cursor values through an
aggregation of potentially millions of rows. That cost is unnecessary: these
attributes become useful after an operator has selected a statement to
investigate.

The Oracle SQL Performance dashboard therefore keeps its broad elapsed, CPU,
I/O, and efficiency rankings on `oracle_sql_samples`. After an operator opens a
SQL ID in Top Consumers, the Selected SQL Plan Hashes table joins its small set
of instance/plan summaries to `oracle_sql_cursor_metadata`. This reports all
observed children, schemas, and modules without another large sample-table
index or a broad enrichment join.

## Operational result

The selected-SQL workflow connects expensive SQL to the application schema and
module while preserving Harry's original priorities:

- frequent, scalable SQL counter collection from `GV$SQLSTATS`;
- bounded detail queries against `GV$SQL`;
- no Oracle Diagnostics Pack dependency;
- deduplicated relational storage instead of repeated labels or strings;
- bounded PostgreSQL maintenance and predictable retention behavior.

The result is not merely another column in a dashboard. It shortens the path
from "this SQL is expensive" to "this is the application context and these are
the cursor variants that require investigation" without making that answer
expensive to collect.

Explore the dashboards in the [public Harry demo](https://demo.harryperformance.com).

## Related use case

See [From Spike to SQL](/use-cases/from-spike-to-sql) for the investigation
workflow that uses this SQL context.
