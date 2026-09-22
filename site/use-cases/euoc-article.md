---
title: "Building Open-Source Oracle Database Performance History with PostgreSQL and Grafana"
sidebar_position: 2
description: "How Harry evolved from an Oracle metrics exporter into an open-source performance history platform using PostgreSQL and Grafana, with a focus on historical analysis, shared visibility, alerting and practical DBA-driven design."
---

# WHY — The problem

Oracle Database provides an extraordinary amount of performance information. As DBAs, we can inspect sessions, waits, SQL execution statistics, blocking sessions, execution plans and many other internal metrics through its dynamic performance views. When a problem is happening in real time, Oracle gives us plenty of information to investigate it. AWR and ASH are unbeatable when it comes to historical performance analysis, but both depend on Oracle Diagnostics Pack, and that licensing cost often limits where historical performance analysis is available. In many environments, Diagnostics Pack is licensed only for production, critical databases, or a subset of systems where the cost is justified. Development, test, staging and smaller production databases can still suffer from slow SQL, blocking sessions, unexpected load, plan changes or application issues, but the historical evidence needed to investigate them may simply not exist. And those non-production databases could give us evidence in advance of problems that may later cause slowness in production!

There is another limitation I have seen repeatedly over the years: access to Oracle Enterprise Manager is usually restricted to DBAs. There are good reasons for that: OEM is an administrative platform and can expose far more than performance information. The side effect is that developers, application owners and business teams depend on a DBA to tell them what the database is doing.

That creates an unnecessary bottleneck, because performance is rarely a database-only problem. Developers know when a release has changed application behaviour, application teams recognise unusual transaction patterns, and business users often notice abnormal activity before any technical threshold is crossed. Giving those teams visibility changes the equation: Grafana is usually available to the whole organisation, and a read-only dashboard can expose performance information without providing any ability to interfere with a production database. As a consequence, database performance becomes visible to hundreds or thousands of eyes, looking at systems they actually understand and often able to spot anomalies very quickly.

In one of my previous environments, people used to call sudden peaks in database activity “the Tourmalet”, after the famous mountain climb in the Tour de France. The important part was not the nickname, but the fact that people outside the DBA team could see the climb and recognise when something looked wrong. When developers, application teams and business users can see the same performance history, somebody will often notice that “Tourmalet” before the DBA team starts investigating it.

There was another consequence that I did not consider at the beginning. Once historical activity was being collected reliably, the same data could also be used to detect problems while they were happening. The original goal was retrospective: preserve enough information so that a DBA could investigate an incident after the event. However, if the data is already flowing continuously into Grafana, the same information can also be evaluated by Grafana alerting without requiring a separate alerting engine.

Finally, when you rely on one system for monitoring and alerting, what comes next is pure logic: High Availability. I would never trust an alerting system that is a SPOF by design, so this became a critical design point.

The problem I wanted to solve was therefore broader than simply storing performance samples. I wanted to preserve enough information to investigate what happened after an incident, make that information safely accessible beyond the DBA team, and reuse the same data for operational alerting where possible.

The idea itself remained simple: if Oracle already exposes most of the information we need in real time, why not sample it continuously, store it somewhere else, and make that performance history safely available through tools people already use?

# HOW — Building performance history

The first version of the project did not start as a new monitoring platform. It started from the existing Oracle AI Database Metrics Exporter.

That made perfect sense as a starting point. Exporters already know how to query Oracle, expose metrics and integrate with the observability ecosystem. But very quickly I hit a problem that is familiar to anybody who has worked with SQL-level telemetry: cardinality.

DBAs know that database performance data is not just CPU usage, memory consumption or a small fixed set of counters. SQL IDs proliferate, execution plans and `PLAN_HASH_VALUE`s change, sessions come and go — or `LOCK TABLE` forever — and `WAIT_CLASS` values constantly change. Objects, users, services, modules and applications all introduce dimensions. If every possible combination becomes a time-series label set, the number of series grows very quickly.

For infrastructure metrics, a time-series database (TSDB) is often an excellent fit. For detailed Oracle performance history, I was no longer sure it was the best model, and the reasoning for trying something else was almost embarrassingly simple: Oracle itself stores most of the information I was querying in relational structures. I was not inventing a new way of representing database performance data. In many ways, I was simply copying the same idea somewhere else.

The first implementation was still heavily influenced by the time-series model. Samples were written into a large table, with most of the information required to understand each observation stored alongside it.

It worked... until the volume increased. Storage usage grew faster than I liked. Queries from Grafana became more expensive. The same information appeared again and again, and data that changed slowly was being stored together with data changing every few seconds.

From a DBA point of view, the solution was obvious: normalize it. So the model gradually evolved into a relational schema, separating high-frequency samples from data that could be reused instead of duplicated continuously, and using our beloved foreign keys. None of this was particularly revolutionary. It was database design and optimisation: the same techniques DBAs have been using for decades.

Grafana became part of that optimisation loop. Every new dashboard and widget exposed something about the data model: a missing index, too much historical data being retrieved, expensive views... The data model was therefore not designed in isolation and then handed to Grafana afterwards. Both evolved together.

At roughly the same time, another architectural decision became increasingly important: not every type of performance information needs to be collected at the same frequency. Database activity is highly volatile. If sessions are sampled too slowly, short events disappear completely. SQL statistics can be collected less frequently. SQL text and execution plans usually change even more slowly. Operational information such as tablespace usage or database status can tolerate much longer intervals.

That led naturally to multiple scrapers running at different frequencies:

* The high-frequency collector became responsible for database activity history.
* Other collectors handled SQL statistics, sessions and blocking information at slower intervals.
* SQL text, execution plans and operational metrics could be collected even less frequently.

This reduced pressure on the Oracle database.

The end result is conceptually simple: Oracle exposes the current state of the database, lightweight collectors sample that state at different frequencies, PostgreSQL preserves the resulting history in a relational model, and Grafana turns that history into something humans can investigate.

And perhaps the most important point is that the source of that information is not exotic. I was not discovering a hidden Oracle interface or inventing a new performance methodology. I simply took the same kind of queries that almost every DBA already has somewhere in a file called `oracle_queries.txt`, ran them continuously, and started keeping the answers.

# WHAT — Harry

That experiment eventually became Harry — Performance Scraper for Oracle Database, an open-source project designed to preserve Oracle Database performance history using lightweight collectors, PostgreSQL and Grafana.

Harry is not intended to replace Oracle Enterprise Manager, AWR or ASH. Those tools solve broader problems and, when available, provide capabilities that Harry does not try to reproduce. Harry takes a more pragmatic approach: collect as much useful performance context as possible, at a reasonable cost, so that when somebody comes back hours or days later asking what happened, the DBA already has enough evidence to start answering the question.

That does not mean storing everything. Trying to preserve every possible piece of Oracle state at maximum frequency would quickly become expensive, noisy and unnecessary. Instead, Harry focuses on the information that is most useful during real performance investigations: activity, SQL execution statistics, waits, sessions, blocking, execution plans and the surrounding context required to correlate them.

The objective is simple: reduce the number of times a DBA has to answer, “I cannot tell you. We were not collecting that information.”

The central piece is Database Activity History, or DAH. DAH uses high-frequency sampled data to show how database activity evolves over time, in the way I had always wanted to see it as a DBA: active sessions, Top SQL, sessions, `SQL_ID`s and wait events presented in the simplest way I could imagine, because I want to see “The Tourmalet” almost instantly. Instead of looking only at the current state of `V$SESSION`, that information becomes a historical dataset that can also be explored later.

But active sessions are only one part of the picture. Harry also collects SQL execution statistics, allowing SQL activity to be compared across different periods. SQL text is stored separately so that large statements do not need to be duplicated with every sample, while execution-plan information makes it possible to inspect how a statement was executed and whether its plan changed over time.

The Top Consumers dashboards combine this information to identify expensive SQL statements and provide context such as execution statistics, SQL text and execution plans. This is particularly useful when the interesting question is not simply “What is slow now?”, but “What was consuming the database between 02:00 and 02:15?”

Session history provides another perspective. Connections can be inspected by user, service, application module or other attributes exposed by Oracle. Blocking information is also sampled, allowing locking incidents to be investigated even when the blocking session disappeared long before the DBA was called.

The same principle applies throughout the project: if a useful piece of Oracle performance state is transient, preserve enough of it to make it historical.

On the storage side, PostgreSQL keeps the different datasets related to one another rather than flattening everything into independent time series. High-frequency samples remain small, while information such as SQL text and execution plans can be reused instead of stored repeatedly. The result is a dataset that can be queried directly with SQL as well as visualised through Grafana.

Grafana is an important part of the design. It provides the interface through which DBAs, developers and other technical teams can explore the same performance history without requiring administrative access to Oracle. A developer can investigate the behaviour of a SQL statement after a deployment, an application team can correlate a traffic spike with database activity, and a DBA can inspect waits, blocking, SQL statistics and execution plans around the same point in time. They are all looking at the same data, but from different perspectives.

Grafana also provides the alerting layer. The same continuously collected data used for historical investigation can be evaluated while it is being collected, allowing conditions such as abnormal activity, blocking or other operational problems to generate alerts without requiring Harry to implement its own alerting engine.

This is one of the reasons Harry is intentionally not designed as another database administration console. It is an observability tool. The Oracle connection used by the collectors requires only the privileges necessary to read the relevant performance information, while Grafana users interact with the stored history rather than with the production database itself.

That separation makes it possible to expose database performance information much more widely without exposing database administration capabilities. It also means that the monitoring architecture itself can be designed with availability in mind instead of necessarily depending on a single monitoring server.

Harry is still evolving. New collectors and dashboards tend to appear in response to real troubleshooting questions rather than from an attempt to reproduce every metric Oracle can expose.

The rule is simple: if a DBA would normally execute a query during an incident and later wish they had run that query ten minutes earlier, that information is a good candidate for Harry.

In that sense, Harry is less about inventing a new way to analyse Oracle performance and more about preserving the evidence DBAs already know how to use. The queries were already there; Harry simply started running them before somebody needed the answer.

