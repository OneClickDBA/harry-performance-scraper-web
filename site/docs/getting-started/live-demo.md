---
title: Live Demo
sidebar_position: 0
description: Explore Harry's PostgreSQL-backed Grafana dashboards in the public interactive demo.
---

# Live Demo

The public Harry demo provides an interactive Grafana environment backed by a
running Harry deployment. It lets you inspect the product workflow and
dashboard behaviour without installing Oracle Database, PostgreSQL, Harry, or
Grafana locally.

<a
  className="button button--primary button--lg"
  href="https://demo.harryperformance.com"
  target="_blank"
  rel="noopener noreferrer">
  Open the Harry live demo
</a>

No account is required.

## What You Can Explore

The demo includes Harry's principal operational and troubleshooting views:

- Oracle Database Activity History (DAH)
- Oracle SQL Top Consumers
- Oracle SQL Performance
- Oracle Current Sessions and Blocking
- Oracle Operational Overview
- Oracle Alerting Overview
- Harry PostgreSQL Repository Health

Use Grafana's time-range controls, database selectors, SQL drill-downs, and
dashboard links to follow an investigation across the collected data.

The demo is a shared public environment. Its data, time ranges, database names,
and availability can change, and its observed workload must not be treated as a
production sizing baseline.

For dashboard descriptions, required PostgreSQL tables, and installation
instructions, continue with [Grafana Dashboards](./grafana-dashboards.md).
