---
title: "Consolidating SQL performance analysis into Top Consumers"
sidebar_position: 3
slug: "consolidating-sql-performance-dashboards"
description: "Why Harry replaced separate SQL ranking dashboards with one configurable Top Consumers workflow, and how it preserves correct Top N and efficiency analysis."
---

# Consolidating SQL performance analysis into Top Consumers

Harry originally provided two related Grafana dashboards:

- **Oracle SQL Performance** ranked SQL by elapsed time, CPU time, User I/O
  wait, and per-execution efficiency.
- **Oracle SQL Top Consumers** ranked the Top 20 SQL statements by elapsed time
  and provided the detailed investigation workflow: workload graphs, SQL full
  text, child cursors, execution plans, schema, and module context.

Both dashboards were useful, but the separation duplicated expensive ranking
logic and split one investigation across two entry points. A DBA could identify
a SQL statement in the overview, then move to Top Consumers to understand why
it was expensive. Most of the first dashboard was therefore another view of
data already available in the second one.

The solution was consolidation rather than adding more panels, adopting a multidimensional analysis approach similar to the one familiar to Oracle Enterprise Manager ASH Analytics users.

## One table, multiple ranking perspectives

Top Consumers now has a compact **Rank SQL by** selector with seven choices:

- Elapsed Time
- CPU Time
- User I/O Wait
- Executions
- Buffer Gets
- Disk Reads
- Elapsed / Execution

Changing the selector does not sort the same fixed result in the browser. It changes the PostgreSQL ranking expression before the Top 20 limit, so each choice returns the actual highest consumers for the selected database and time range, following a similar analytical philosophy to OEM ASH Analytics, but using Harry's independently collected SQL performance statistics.

## Preserve the correct counter model

Oracle exposes these SQL statistics as cumulative counters. Harry cannot rank
the raw values directly because an old cursor would retain its historical
advantage indefinitely.

For every selected dashboard range, the query:

1. Groups samples by collection time, Oracle instance, SQL ID, and plan hash.
2. Uses `LAG` independently for each instance, SQL, and plan combination.
3. Calculates reset-safe interval deltas for elapsed time, CPU, waits,
   executions, logical reads, physical reads, and rows processed.
4. Adds those deltas together by SQL ID.
5. Applies the selected ranking and limits the result to 20 SQL IDs.
6. Enriches only those 20 results with SQL text and execution-plan
   availability.

Calculating deltas before aggregation is essential. Counters from different
RAC instances or execution plans must never be subtracted from one another.

## Why one row per SQL ID

The former SQL Performance dashboard could rank separate instance and plan
combinations. That was useful detail, but it also allowed one SQL ID to occupy
multiple positions in a Top SQL list.

Top Consumers deliberately ranks the total impact of each SQL ID across its
instances and plans. A statement therefore occupies one Top 20 position. After
selection, the existing plan-hash and child-cursor panels provide the detailed
instance, plan, schema, and module breakdown.

This separates two questions cleanly:

- **Which SQL statements had the greatest overall impact?**
- **Which instance, cursor, or execution plan produced that impact?**

## Retaining efficiency analysis

The only unique feature that could not be represented by the original ranking
choices was **SQL Efficiency Outliers**. Removing it would have hidden
statements that are expensive per execution but do not dominate total database
time.

It was incorporated as the `Elapsed / Execution` ranking. The existing Top
Consumers table was extended with the supporting values:

- rows processed;
- seconds per execution;
- buffer gets per row;
- disk reads per execution.

This preserved the analysis without adding another permanent panel or
increasing the dashboard's vertical footprint.

## Result

The separate Oracle SQL Performance dashboard, its navigation links, and its
documentation entry were removed. Top Consumers is now the single SQL-ranking
and statement-investigation workbench.

The change required no new Oracle collection, PostgreSQL table, index, or
stored data. It changed only how Grafana asks PostgreSQL to rank information
Harry already collects. The detailed graphs, SQL full text, plan inspection,
and application context remain available after selecting a SQL ID.

**The result is a dashboard that will feel immediately familiar to any DBA who has used Oracle Enterprise Manager's ASH Analytics to investigate database performance.**
