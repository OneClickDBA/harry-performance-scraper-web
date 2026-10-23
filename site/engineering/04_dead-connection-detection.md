---
title: "Dead Connection Detection: isolating unavailable databases without stopping the scraper"
sidebar_position: 4
slug: "dead-connection-detection"
description: "How Harry quarantines unreachable Oracle Database targets, keeps healthy collection running, and restores recovered databases through one serialized recovery scheduler."
---

# Dead Connection Detection

A database scraper has to work when databases do not.

That statement sounds obvious, but it changes the architecture. A scraper that
monitors one database can wait for a failed connection and try again. Harry can
monitor dozens of Oracle Database targets from one process, potentially across
several datacenters. If one datacenter is stopped for maintenance, repeatedly
retrying every unavailable target inside the normal collection loops can delay
healthy databases, occupy connection resources, and fill the logs with failures
that no retry can repair.

Harry 0.5.0 introduced **Dead Connection Detection**, or **DCD**, to make
database availability an explicit state rather than an accidental side effect
of every collector.

:::note 
The name

Dead Connection Detection is the name I am proud to give this feature. It says
exactly what it does, it gives the architecture some personality, and it makes
the visual concept unavoidable (you'll notice at the end of this article).

:::

# The history behind

After facing a datacenter _[maintenance](/use-cases/the_maintenance_issue)_ tasks and while implementing the new DataGuard monitoring.  
I consider that the way Harry handle connection and re-connection issues was not the best one.  


The design came from a real maintenance event. Every Oracle node in one
datacenter was stopped, while databases in the other datacenters remained
available. Harry still had every target in its configuration, as it should, but
the normal activity and scheduled collectors continued encountering connection
failures.

The unavailable databases created three related problems:

- a two-second activity collector could repeatedly encounter the same dead
  network path;
- connection recovery competed with normal collection work;
- a cycle that waited for many failed targets could delay results from healthy
  databases.

Editing the configuration to remove databases under maintenance made the
symptom disappear, but it was operationally wrong. Monitoring configuration
should describe what must be monitored, not what happens to be available at
this moment. It would also require another manual edit when the datacenter
returned.

## Separate detection, isolation, and recovery

DCD treats connectivity as a small state machine for each configured database:

```text
STARTING -> ACTIVE -> QUARANTINED -> PROBING -> ACTIVE
                                  \-> QUARANTINED
```

- `STARTING` means initial connection setup has not completed.
- `ACTIVE` allows all normal collectors to use the database.
- `QUARANTINED` removes an unavailable database from normal collection and
  places it in the logical DCD queue.
- `PROBING` means DCD has exclusively claimed that database for one recovery
  attempt.

The queue is not an additional list that can accumulate duplicate entries. It
is the set of configured databases whose current state is `QUARANTINED`.

This creates one clear ownership rule:

> Normal collectors detect connectivity failure and quarantine the target.
> Only DCD can reconstruct its session and warm its connection pool.

Activity, performance, operational, additional-metric, and alert-log collectors
skip quarantined or probing targets. They continue processing every active
database. Recovery work can no longer appear independently in several
collector paths.

## One recovery point, one connection at a time

Microsoft's transient-fault guidance warns against duplicated retry layers and
recommends periodically testing a service at longer intervals after continual
failures. Its Circuit Breaker pattern similarly isolates a dependency that is
likely to keep failing, then permits a controlled probe to discover recovery.
The [Microsoft transient fault handling guidance](https://learn.microsoft.com/en-us/azure/architecture/best-practices/transient-faults),
[Circuit Breaker pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker),
and [Retry Storm antipattern](https://learn.microsoft.com/en-us/azure/architecture/antipatterns/retry-storm/)
describe the failure amplification DCD is intended to avoid.

Amazon reaches a compatible conclusion from large distributed systems:
retries consume more of the failing service's resources, retries at several
layers multiply, and low-cost retries should have one owner. The Amazon
Builders' Library article
[Timeouts, retries, and backoff with jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)
is particularly useful background for this decision.

Harry applies those principles conservatively:

1. Each normal collector fails fast for a quarantined database.
2. DCD is the single runtime recovery point.
3. DCD probes databases strictly one at a time.
4. Every probe has a bounded timeout.
5. A slow recovery pass never overlaps another pass.
6. Recovery attempts and outcomes are observable.

Serialization is intentional. If 100 configured targets become unreachable,
Harry does not open 100 simultaneous Oracle connections five minutes later. It
checks one target, completes or times out that attempt, and then advances to the
next. Healthy collection remains independent from this recovery pass.

## Why DCD uses a fixed interval

General-purpose retry guidance commonly recommends exponential backoff and
jitter. That is the right default for request retries under transient load, but
DCD is not an inline request retry mechanism:

- the failed database has already been removed from normal work;
- the default interval is five minutes, not milliseconds or seconds;
- one active Harry HA leader owns recovery;
- probes are serialized rather than released as a concurrent retry wave;
- an unavailable database may remain offline intentionally for hours or days;
- operators need a predictable upper bound for detecting its return.

For this workload, increasing the interval from five minutes to ten, twenty,
forty, and eventually several hours would reduce recovery load only slightly
while making failover or maintenance recovery unnecessarily slow and
unpredictable.

DCD therefore uses a configurable fixed interval, with no exponential backoff.
The timer is reset after a pass completes. If checking a large queue takes more
than five minutes, Harry finishes that pass and waits another complete interval
instead of immediately processing a delayed timer event. This avoids overlap
and catch-up bursts.

This is a contextual engineering decision, not a claim that exponential
backoff is generally wrong. If Harry used concurrent probes, ran many active
recovery workers, or retried interactive operations, backoff and jitter would
need to be reconsidered.

## Failure classification

Not every Oracle error means that the connection is dead.

DCD quarantine is appropriate for connection and service availability
failures, including closed driver connections, broken or reset network paths,
listener and Oracle Net failures, and database startup or shutdown conditions
such as `ORA-01033`. A failed explicit connectivity ping is also sufficient:
whatever the underlying error text, Harry cannot currently use that target.

SQL syntax errors, missing object privileges, and ordinary collector-query
timeouts do not automatically prove that the database connection is dead.
Those remain collector failures and stay visible without unnecessarily
rebuilding the pool.

This classification can evolve as production environments expose additional
driver and Oracle Net failure forms. The important boundary is stable: DCD
handles inability to use the database connection, not every error returned by
Oracle.

`ORA-01033` is not treated as proof that a target is a physical standby. Harry
does not need that inference. The endpoint is currently unavailable, so it
remains quarantined until a later probe succeeds.

## Data Guard without Active Data Guard

That last behavior provides a useful operational property. A mounted physical
standby without Active Data Guard may reject Harry's monitoring login. The
standby endpoint can still remain in Harry's configuration:

1. Startup cannot use the service and quarantines it.
2. DCD checks it on the normal fixed schedule.
3. After switchover or failover, the promoted database opens.
4. Once its configured Clusterware service is registered and usable, DCD
   rebuilds the pool and returns it to active collection.
5. The former primary enters quarantine when a normal collector detects that
   its service is no longer usable.

Harry does not repair listener registration, Clusterware service placement,
DNS, or connect descriptors. Those remain Oracle DBA and infrastructure
responsibilities. DCD makes Harry react correctly after those components expose
a working database service.

## In-memory state is deliberate

The DCD queue is not a durable PostgreSQL work queue. It is reconstructed from
the configured databases whenever Harry starts or a new HA leader takes over.
Every target goes through bounded initialization; successful targets become
active and failures become quarantined.

Persisting ownership of recovery work would add distributed coordination for
state that is cheap and safer to rediscover. PostgreSQL stores observability,
not control-plane ownership:

- `harry_database_connection_state` keeps one current row per configured
  database;
- `oracle_scrape_status` stores historical DCD attempts and outcomes;
- `harry_runtime_samples` stores cycle duration, attempted targets, recovered
  targets, failures, and missed intervals.

The current-state table makes the queue visible without turning it into a
second source of truth.

## Monitoring recovery instead of hiding failure

Quarantine does not make a database disappear. Harry keeps reporting why data
is absent and exposes the recovery mechanism itself.

The Repository Health dashboard shows:

- current connection and activity state;
- how long a database has been queued;
- its last connection failure;
- the latest probe time, duration, and error;
- probe attempt count and recovery time;
- fleet-wide DCD queue size.

The Operational Overview exposes the selected database's current DCD state and
recovery-cycle history. Existing connectivity alerts continue to report the
unavailable target. A performance gap is therefore explained as missing source
data, never replaced with synthetic zero activity.

This distinction also prevents a misleading dashboard state. A database can be
currently `ACTIVE` while the selected historical window still contains failed
activity cycles. Harry presents that as `RECOVERED`, retaining the failures for
reliability analysis without implying that the connection remains dead.

## Configuration and defaults

DCD is enabled by default:

```yaml
metrics:
  deadConnectionDetection:
    enabled: true
    interval: 5m
    probeTimeout: 5s
```

The defaults deliberately optimize for predictable fleet recovery rather than
immediate reconnection. Operators can change the interval and timeout for their
network and database-service characteristics. Disabling DCD disables automatic
runtime reconnection: a quarantined target then remains unavailable to normal
collectors until Harry restarts and initializes it successfully.

## Trade-offs

DCD adds connection-state transitions, synchronization, and another scheduler.
That is more complex than retrying wherever an error happens. The complexity
buys a stronger failure boundary:

- unavailable databases cannot monopolize normal collector cycles;
- recovery cannot create a parallel connection burst;
- one component owns session reconstruction;
- a recovered target returns automatically;
- HA leadership and process restarts rebuild state safely;
- operators can observe both failure and recovery.

A recovered database can wait up to the configured interval before detection,
and a large serialized queue can take longer than one interval to process.
Those are explicit, measurable costs. For a performance-history scraper, they
are preferable to increasing load on an unavailable Oracle estate or delaying
healthy databases every few seconds.

## Result

Dead Connection Detection turns a fleet outage from a scraper-wide scheduling
problem into isolated per-database state. Harry continues collecting every
healthy target, unavailable databases remain visible, and recovery happens
automatically through one bounded and observable path.

The feature is serious because monitoring software is most valuable during
failure. The name is memorable because engineering does not have to be
anonymous. When a dead connection returns to active collection, Zombie Harry
has done his job.

## References

- Microsoft Azure Architecture Center:
  [Best practices for transient fault handling](https://learn.microsoft.com/en-us/azure/architecture/best-practices/transient-faults)
- Microsoft Azure Architecture Center:
  [Circuit Breaker pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker)
- Microsoft Azure Architecture Center:
  [Retry Storm antipattern](https://learn.microsoft.com/en-us/azure/architecture/antipatterns/retry-storm/)
- Amazon Builders' Library:
  [Timeouts, retries, and backoff with jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)
- Harry documentation:
  [Configuration file reference](/docs/configuration/config-file)
- Harry use case:
  [The maintenance issue](/use-cases/the_maintenance_issue)
