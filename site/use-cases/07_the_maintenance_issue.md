---
title: "The maintenance issue: surviving a datacenter outage"
sidebar_position: 7
description: "How Harry isolates unavailable Oracle databases, preserves honest RED monitoring state, and continues collecting healthy targets during planned or unplanned infrastructure outages."
---

# The maintenance issue

Database monitoring is easiest when every target is reachable. The more useful
test is what happens when an entire part of the infrastructure disappears.

In one production deployment, all Oracle nodes in one datacenter were stopped
for infrastructure maintenance. Those databases were genuinely unavailable and
were expected to remain RED. Harry was still running and the PostgreSQL
repository was healthy, but repeated connection attempts to the stopped targets
began interfering with collection from databases in the other datacenters.

The immediate workaround was to remove the unavailable databases from Harry's
configuration. That restored the remaining collection, but it was the wrong
operational model:

- the stopped databases disappeared from monitoring instead of remaining RED;
- the configuration no longer represented the production inventory;
- operators had to edit and reload configuration at the beginning and end of
  maintenance;
- forgetting to restore an entry could leave a database permanently
  unmonitored;
- an unplanned network or datacenter failure would require the same manual
  intervention.

A monitoring system must tolerate failures in the systems it monitors. An
unreachable database is a result to report, not a reason to stop monitoring the
rest of the estate.

## Why unavailable targets affected collection

Harry runs high-frequency activity sampling independently from its scheduled
SQL, operational, and additional-metric collectors. Activity sampling normally
runs every two seconds, while the scheduled connectivity pass normally runs
every 15 seconds.

Before failure isolation was added, two details interacted badly:

1. Connection backoff recognized only a limited set of Oracle errors.
   Listener, routing, TCP, DNS, driver, and context-timeout failures do not all
   arrive as the same ORA error.
2. The activity cycle waited for all participating databases before writing
   the completed batch to PostgreSQL.

A database in a stopped datacenter could therefore consume its query timeout,
be attempted again on the next activity cycle, and repeatedly delay healthy
results. With several unavailable databases, the symptom looked like a problem
with Harry as a whole even though the real failure boundary was one group of
Oracle targets.

Retrying every two seconds was not useful. It could not make the datacenter
recover, and it increased connection, scheduler, logging, and diagnostic noise
exactly when operators needed clear information.

## Treat every failed ping as a connectivity failure

Harry now treats every failed Oracle `PingContext` as a connectivity failure.
The decision no longer depends on matching a short list of ORA codes. A failed
ping may report an Oracle Net error, a refused connection, an unreachable
network, a driver error, or a context deadline; operationally, the result is the
same: that database cannot currently be collected.

The failure opens a circuit breaker for that database using the configured
`metrics.connectionBackoff` period. The circuit is local to the database. It
does not pause a datacenter, a collector, or the Harry process.

```yaml
metrics:
  scrapeInterval: 15s
  connectionBackoff: 5m
```

The default five-minute backoff avoids connection storms during a prolonged
outage. Environments that prefer faster recovery detection can use a shorter
period such as `1m`, accepting the corresponding increase in failed connection
attempts while the target remains unavailable.

## Suspend expensive work, not monitoring state

Opening the circuit stops high-frequency activity queries for the unavailable
database. An activity query that fails first also suspends further activity
attempts until the scheduled connectivity path verifies recovery. This prevents
a two-second collector from continuously probing a dead network path.

Suspending collection does **not** make the database disappear:

- `oracle_latest_scrape_status` retains the database and its latest collector
  state;
- connectivity and scheduled collectors report failed status;
- activity status remains fresh and failed while the circuit is open;
- the Oracle Alerting Overview dashboard can continue showing the target as
  unavailable;
- Grafana or external alerting can continue firing a real connectivity alert;
- healthy databases continue their normal activity and scheduled collection.

Skipped activity cycles are persisted as failed collector state but are logged
only at debug level. The first real query or connectivity failure remains an
error. This preserves observability without generating one production error
message per unavailable database every two seconds.

Harry does not synthesize zero activity for a stopped database. Performance
tables contain a gap because no valid Oracle observation exists. Collector
status explains that gap as an availability failure rather than presenting
fabricated workload data.

## Automatic recovery

After the backoff expires, the normal scheduled collector tries the Oracle
connectivity probe again.

If the probe still fails, Harry reopens the per-database circuit and continues
monitoring the healthy estate. If it succeeds, Harry clears the circuit and
activity collection resumes automatically. No configuration edit, process
restart, or manual database re-registration is required.

With the default settings, recovery is normally detected within approximately
five minutes plus one scheduled scrape interval. The first failure can still
consume its configured timeout because Harry must observe a failure before it
can isolate the target.

Startup follows the same principle. Harry performs a bounded five-second
connectivity preflight before running database initialization SQL and warming
the connection pool. An inaccessible target therefore fails early instead of
consuming several initialization and pool-warmup timeouts.

## Find every affected database at once

Operators should not have to inspect 25 databases one by one. Current failed
connectivity state is available from the small, transactionally maintained
latest-status table:

```sql
select
    source_database,
    success,
    collected_at,
    now() - collected_at as status_age,
    duration_seconds,
    error_message
from oracle_latest_scrape_status
where collector = 'connectivity'
  and not success
order by collected_at, source_database;
```

This separates a fleet-wide Harry or PostgreSQL problem from a group of Oracle
targets sharing a failed listener, network, site, or maintenance event. The
Alerting Overview and Repository Health dashboards provide the same operational
view without requiring direct SQL access.

## Maintenance is not success

This design deliberately does not convert planned maintenance into a healthy
state. A database that is stopped is unavailable whether the outage was
expected or unexpected. Harry reports that fact accurately.

Alert notification policies may mute or route known maintenance events, but
collection state should remain truthful. Suppressing a notification is an
alerting decision; deleting the database from monitoring is an inventory and
observability failure.

The distinction also protects against maintenance overruns. When a planned
window ends, the database either reconnects and returns to successful
collection or remains RED. There is no temporary configuration entry to restore
and no false assumption that monitoring resumed.

## Operational result

The production requirement was not merely to reconnect eventually. Harry had
to preserve four properties during a partial infrastructure outage:

- unavailable databases remain visible and RED;
- healthy databases continue producing performance and operational data;
- failed targets are retried at a controlled rate;
- recovery requires no manual configuration change.

The per-database circuit breaker establishes the correct failure boundary. A
database, listener, network segment, or complete datacenter can fail without
turning that local outage into a fleet-wide monitoring outage.

That behavior is part of monitoring reliability: the monitoring system must be
designed to remain useful when the infrastructure is not healthy.
