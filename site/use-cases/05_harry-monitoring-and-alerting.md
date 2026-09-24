---
title: "Harry detects stale Oracle performance ingestion before you get a call at 2 AM"
sidebar_position: 5
description: "True story: an accidental configuration change triggered Harry’s self-monitoring exactly as designed."
---

# Harry detects stale Oracle performance ingestion before you get a call at 2am

*True story*: while updating Harry to v0.3.0, Grafana suddenly started `/cry`ing with a couple of nice *firing* alerts.

I was not testing alerting. Which made it even better. 😆

## The accidental test

While preparing Harry's version 0.3.0, I renamed the source databases in the scraper configuration. It was just a configuration update in the demo environment.

On the next dashboard refresh, Grafana started firing alerts!!

The previous source database labels had stopped receiving ingestion updates, and Harry's health checks correctly identified that their accounting and scraper data had become stale.

In other words: the system noticed that the data pipeline had stopped advancing for those sources.

## What happened

After the rename, the new source database names started to appear normally, while the old ones remained present in the repository without receiving fresh data.

Harry's alerting detected two different but related symptoms:

- **Harry repository ingestion accounting is stale**
- **Oracle scraper data is stale**

This is useful because those alerts cover different layers of the monitoring path:

```text
Oracle database
   ↓
Harry scraper
   ↓
PostgreSQL repository
   ↓
Grafana dashboards and alerts
```

If a dashboard still shows old data, but no new samples are arriving, that is dangerous. A stale dashboard can look calm and healthy while actually hiding a broken ingestion path. That is why stale-data detection matters.

## Repository ingestion accounting alerts

Harry keeps track of repository ingestion activity so it can detect when expected flushes are no longer happening.

In this case, the alert fired with the message:

> No ingestion accounting flush has completed for more than fifteen minutes. Verify Harry leadership, PostgreSQL writes, and scraper logs. Accounting normally flushes every five minutes.

That alert is not only saying "something is wrong", it also points directly to the areas worth checking first:

* Harry leadership
* PostgreSQL writes
* scraper logs

## Oracle scraper data stale alerts

At the same time, Grafana also raised an alert showing that Oracle scraper data itself had become stale for the old source database labels.

This gives a second confirmation that the data pipeline is no longer advancing as expected.

Together, these alerts help distinguish between:

* a dashboard issue
* a repository issue
* a collection issue
* or a broader scraper/runtime problem

## Why this matters

For me, this is one of the most important parts of observability: the monitoring system itself must also be monitored. It is not enough to monitor Oracle database performance if the monitoring pipeline itself can silently stop, slow down, or freeze.

I do not want a beautiful green dashboard if the data behind it stopped moving twenty minutes ago, only to get a call at 2 AM because something is *really* wrong.

Harry is designed to reduce that risk by exposing operational health and alerting on stale ingestion behaviour.

## Harry 0.3.0 and self-monitoring

This fits perfectly with Harry 0.3.0, which introduces Scraper pressure self-monitoring.

The goal is simple: Harry should not only collect Oracle performance data, but also provide visibility into its own runtime behaviour.

That includes detecting situations such as:

* stale scraper output
* delayed repository ingestion
* ingestion surges or drops
* runtime pressure conditions that may affect collection quality

This makes Harry more trustworthy in real operational environments, because the system can tell you not only what Oracle is doing, but also whether Harry itself is collecting and storing data in a healthy way.

## Demo improvements

This incident also exposed a practical issue in the public demo: the alerting dashboard showed active alerts, but did not give proper read-only access to Grafana Alerting itself. That has now been fixed.

The demo now includes read-only access to the relevant alerting view, making it easier to understand how Harry's alerting is structured and how these health checks behave in practice.

## See it in action

You can explore Harry here:

Website: https://harryperformance.com

Demo: https://demo.harryperformance.com

And if you are interested in how Harry approaches Oracle performance history without depending on Oracle Diagnostics Pack, take a look at the rest of the project documentation and use cases.
