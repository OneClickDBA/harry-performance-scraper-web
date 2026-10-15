---
title: Installation
sidebar_position: 1
---

# Installation

The scraper needs three services:

- Oracle Database, the source of monitoring data.
- PostgreSQL, the storage backend.
- Grafana, the visualization layer.

The scraper process itself can run as a container, in Docker Compose for local
testing, in Kubernetes, or as a normal Linux service. For production-like
installations, the standalone binary plus systemd is usually the clearest
deployment model.

## Database Permissions

Create the monitoring user in the PDB that you want to monitor. A user created
only in `CDB$ROOT` does not automatically monitor application PDB sessions.

For quick testing, `SELECT_CATALOG_ROLE` is the easiest grant:

```sql
create user scraperuser identified by "CHANGE_ME";
grant create session to scraperuser;
grant select_catalog_role to scraperuser;
```

For more controlled grants, the native operational and performance collectors
use these views:

```sql
grant select on sys.dba_tablespace_usage_metrics to scraperuser;
grant select on sys.dba_tablespaces to scraperuser;
grant select on sys.dba_temp_free_space to scraperuser;
grant select on sys.gv_$instance to scraperuser;
grant select on sys.gv_$system_wait_class to scraperuser;
grant select on sys.gv_$asm_diskgroup_stat to scraperuser;
grant select on sys.gv_$datafile to scraperuser;
grant select on sys.gv_$sysstat to scraperuser;
grant select on sys.gv_$process to scraperuser;
grant select on sys.gv_$session to scraperuser;
grant select on sys.gv_$resource_limit to scraperuser;
grant select on sys.gv_$parameter to scraperuser;
grant select on sys.gv_$database to scraperuser;
grant select on sys.gv_$sql to scraperuser;
grant select on sys.gv_$sqlstats to scraperuser;
grant select on sys.gv_$sql_plan to scraperuser;
grant select on sys.gv_$con_sysmetric to scraperuser;
grant select on sys.v_$diag_alert_ext to scraperuser; -- for alert logs only
```

Additional permissions may be required for user-defined metrics, depending on
the tables and views queried by their definition files.

:::warning  
Oracle Diagnostics Pack  
The Oracle ASH collector is **DISABLED by default**.   
Enabling it requires that **YOU verify your Oracle Diagnostics Pack licensing**.
:::

The default session activity collector does not need an ASH grant. Only for an
explicitly licensed `performance.activity.source: ash` deployment, add:

```sql
grant select on sys.gv_$active_session_history to scraperuser;
```

## PostgreSQL Setup

Create a PostgreSQL database and user for the scraper:

```sql
create database harry_monitoring;
create user harry_monitoring with encrypted password 'CHANGE_ME';
grant all privileges on database harry_monitoring to harry_monitoring;

\c harry_monitoring

grant all on schema public to harry_monitoring;
alter schema public owner to harry_monitoring;
```

The scraper can create its own tables and indexes when
`output.postgresql.autoMigrate: true` is set.

## Build The Binary

The default build uses `godror` and requires Oracle Instant Client at runtime:

```bash
go build -o harry-scraper ./
```

The no-CGO build uses the `go-ora` driver and does not require Oracle Instant
Client:

```bash
go build -tags goora -o harry-scraper ./
```

Install the binary:

```bash
sudo install -m 0755 harry-scraper /usr/local/bin/harry-scraper
sudo mkdir -p /etc/harry /var/log/harry
```

## Minimal Configuration

Create `/etc/harry/config.yaml`:

```yaml
databases:
  prod:
    username: ${ORACLE_USERNAME}
    password: ${ORACLE_PASSWORD}
    url: ${ORACLE_CONNECT_STRING}
    queryTimeout: 10
    connMaxLifetime: 30m
    connMaxIdleTime: 5m
    maxOpenConns: 10
    maxIdleConns: 10

metrics:
  scrapeInterval: 15s

operational:
  enabled: true
  interval: 1m
  queryTimeout: 10s

performance:
  activity:
    source: session
    interval: 2s
    queryTimeout: 2s
  sqlPlans:
    enabled: true
    interval: 2m
    topN: 20
    queryTimeout: 10s

output:
  postgresql:
    url: ${POSTGRES_URL}
    autoMigrate: true
    retention: 720h

log:
  level: info
  format: logfmt
  destination: /var/log/harry/alert.log
  interval: 15s
  disable: 1

web:
  listenAddresses: [':9161']
```

Keep `metrics.scrapeInterval` configured. The PostgreSQL-backed scraper is
designed for scheduled collection.

Create `/etc/harry/env`:

```bash
ORACLE_USERNAME=scraperuser
ORACLE_PASSWORD=CHANGE_ME
ORACLE_CONNECT_STRING=oracle-host.example.com:1521/APP_PDB
POSTGRES_URL=postgres://harry_monitoring:CHANGE_ME@127.0.0.1:5432/harry_monitoring?sslmode=disable
```

Lock it down:

```bash
sudo chown root:root /etc/harry/env
sudo chmod 0600 /etc/harry/env
```

## systemd Service

Create `/etc/systemd/system/harry-scraper.service`:

```ini
[Unit]
Description=Harry - Performance Scraper for Oracle Database
After=network-online.target postgresql.service
Wants=network-online.target

[Service]
Type=simple
User=harry
Group=harry
EnvironmentFile=/etc/harry/env
WorkingDirectory=/etc/harry
ExecStart=/usr/local/bin/harry-scraper --config.file=/etc/harry/config.yaml
Restart=always
RestartSec=5
TimeoutStopSec=30

NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Do not set one process-wide `ORA_SDTZ` when the scraper monitors databases in
different server time zones. Godror can log a discrepancy warning when an
Oracle session time zone differs from the database server operating-system time
zone; for Oracle `DATE` values populated from `SYSDATE`, godror uses the server
operating-system time zone. The scraper calculates its `GV$SQLSTATS`
`LAST_ACTIVE_TIME` lookback from each database's own `SYSDATE`, so the warning
does not require a global override.

Create the service user and start the service:

```bash
sudo useradd --system --home-dir /etc/harry --shell /sbin/nologin harry
sudo chown -R harry:harry /etc/harry /var/log/harry
sudo systemctl daemon-reload
sudo systemctl enable --now harry-scraper
```

Useful checks:

```bash
journalctl -u harry-scraper -f
curl http://127.0.0.1:9161/healthz
curl http://127.0.0.1:9161/readyz
```

`/healthz` confirms that the process is alive. `/readyz` confirms that this
instance owns HA leadership and has started collection. A standby intentionally
returns HTTP `503` from `/readyz`.

## Docker Compose

The `docker-compose/` stack is intended for local testing only. It starts test
Oracle databases, PostgreSQL, Grafana, and two Harry instances in one HA scope.

```bash
DB_PASSWORD='<choose-a-local-demo-password>' make docker-compose-up
```

The sample Oracle listeners are intended for localhost development. Do not
expose the Compose stack on a shared or public host.

Harry connects to each test database's `CDB$ROOT` service as the dedicated
common user `C##HARRY_MONITORING`. The initialization script grants that user
`SELECT_CATALOG_ROLE` and `CONTAINER_DATA=ALL`, allowing instance-level
`CON_ID = 0` CPU, time-model, and I/O telemetry while retaining visibility of
sessions and SQL running in `FREEPDB1`. Application schemas and local load
tests, including HR, remain inside `FREEPDB1`; the PDB is not registered as a
separate monitored database.

When the stack is running:

- First Harry instance: [http://localhost:9161/healthz](http://localhost:9161/healthz)
- Second Harry instance: [http://localhost:9162/healthz](http://localhost:9162/healthz)
- Grafana: [http://localhost:3000](http://localhost:3000)
- PostgreSQL: exposed according to the Compose file

Grafana is provisioned with the PostgreSQL datasource and the bundled
dashboards.

Both Harry containers use `highAvailability.scope: default`. Check leadership:

```bash
curl -s -o /dev/null -w 'harry-scraper: %{http_code}\n' \
  http://localhost:9161/readyz
curl -s -o /dev/null -w 'harry-scraper-secondary: %{http_code}\n' \
  http://localhost:9162/readyz
```

Exactly one endpoint should return `200`; the standby returns `503`. The
following test detects and kills the current leader, then waits for the standby
to take over:

```bash
if curl -fsS http://localhost:9161/readyz >/dev/null; then
  leader=harry-scraper
  standby_port=9162
else
  leader=harry-scraper-secondary
  standby_port=9161
fi

docker kill "$leader"
until curl -fsS "http://localhost:${standby_port}/readyz"; do sleep 1; done
```

Takeover normally occurs after the configured `retryInterval`. The Compose
scraper services intentionally have no automatic restart policy so `docker
kill` leaves the old leader down for this test.

Restart the killed container to verify that it rejoins as standby while the new
leader keeps the advisory lock:

```bash
docker start "$leader"
```

```bash
make docker-compose-down
```
