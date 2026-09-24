---
title: "Workload visibility without ASH"
sidebar_position: 1
---

import comparison01 from '@site/static/img/use-cases/workload-visibility-without-ash/comparison_vs_OEM_01.png';
import comparison02 from '@site/static/img/use-cases/workload-visibility-without-ash/comparison_vs_OEM_02.png';
import comparison03 from '@site/static/img/use-cases/workload-visibility-without-ash/comparison_vs_OEM_03.png';
import comparison04 from '@site/static/img/use-cases/workload-visibility-without-ash/comparison_vs_OEM_04.png';

# ASH-like workload visibility. Without querying ASH.

Oracle Active Session History is powerful. It is also tied to the Oracle
Diagnostics Pack and is normally explored through Oracle Enterprise Manager.

**Harry the Performance Scraper** takes a different approach: it periodically
samples live session data, stores the observations in PostgreSQL, and makes
them available through Grafana. It does **not** query
`V$ACTIVE_SESSION_HISTORY` or `DBA_HIST_ACTIVE_SESS_HISTORY`.

The following comparisons show Harry and the ASH Analytics view in Oracle
Enterprise Manager 24ai for the same databases and time ranges.

<a href={comparison01} target="_blank" rel="noopener noreferrer">
  <img
    src={comparison01}
    alt="Harry compared with Oracle Enterprise Manager ASH Analytics: sustained database workload"
  />
</a>

The visual result speaks for itself. Harry identifies the same:

- workload start and end;
- peaks and changes in database activity;
- dominant wait classes;
- top SQL identifiers;
- top sessions responsible for the activity.

The charts are not expected to be pixel-for-pixel identical. Harry and ASH use
different sampling intervals and aggregation methods. What matters during an
investigation is that the relevant workload pattern—and the sessions and SQL
behind it—is clearly visible in both.

<a href={comparison02} target="_blank" rel="noopener noreferrer">
  <img
    src={comparison02}
    alt="Harry compared with Oracle Enterprise Manager ASH Analytics: intermittent activity peaks"
  />
</a>

## Same workload, clearer workflow

Returning to Enterprise Manager after working with Grafana makes the usability
difference difficult to ignore.

Grafana provides fast time-range selection, zooming, refresh controls,
consistent dashboard variables and several correlated views on the same
screen. Harry uses that experience to place the activity timeline, Top SQL,
Top Sessions, SQL activity over time and the underlying samples together.

Instead of navigating through multiple OEM screens, the investigation starts
with a single question:

> What happened in the database, when did it happen, and who was responsible?

<a href={comparison03} target="_blank" rel="noopener noreferrer">
  <img
    src={comparison03}
    alt="Harry compared with Oracle Enterprise Manager ASH Analytics: several distinct workload periods"
  />
</a>

## Useful visibility without licensed ASH data

ASH remains a valuable Oracle diagnostic feature. Harry is not attempting to
pretend otherwise.

Its goal is to provide practical historical workload visibility in
environments where querying ASH is unavailable, undesirable, or difficult to
justify. These side-by-side captures show that external session sampling is
not merely a simplified activity counter: it can preserve the workload shape
and retain the evidence needed to identify the main SQL and sessions involved.

<a href={comparison04} target="_blank" rel="noopener noreferrer">
  <img
    src={comparison04}
    alt="Harry compared with Oracle Enterprise Manager ASH Analytics: matching workload spikes and dominant SQL"
  />
</a>

The result is a lightweight and accessible starting point for Oracle
performance analysis:

**the workload pattern, the responsible SQL, and the responsible sessions—all
visible without querying ASH.**
