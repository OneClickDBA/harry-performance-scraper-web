# Sample Monitoring User Creation Scripts

Run these statements as a privileged database administrator. Replace the sample
password before use.

## Non-PDB Database

Create a read-only monitoring user for a non-PDB Oracle database:

```sql
CREATE PROFILE monitoring_profile
    LIMIT
        FAILED_LOGIN_ATTEMPTS 10
        PASSWORD_LIFE_TIME UNLIMITED
        PASSWORD_REUSE_TIME UNLIMITED
        PASSWORD_REUSE_MAX UNLIMITED
        PASSWORD_VERIFY_FUNCTION NULL
        PASSWORD_LOCK_TIME 1
        PASSWORD_GRACE_TIME 7
        INACTIVE_ACCOUNT_TIME UNLIMITED;

CREATE USER monitoring_user
    IDENTIFIED BY replace_this_password
    PROFILE monitoring_profile;

GRANT CREATE SESSION TO monitoring_user;
```

Choose one of the following permission models.

### Catalog Role

This is the simpler option for operational deployments:

```sql
GRANT SELECT_CATALOG_ROLE TO monitoring_user;
```

To collect alert logs, also grant:

```sql
GRANT SELECT ON sys.v_$diag_alert_ext TO monitoring_user;
```

### Explicit Object Grants

Use these grants instead of `SELECT_CATALOG_ROLE` when a least-privilege setup is
required:

```sql
-- Shared by native performance and operational collectors
GRANT SELECT ON sys.gv_$instance TO monitoring_user;
GRANT SELECT ON sys.gv_$session TO monitoring_user;

-- Native performance collection
GRANT SELECT ON sys.gv_$sql TO monitoring_user;
GRANT SELECT ON sys.gv_$sqlstats TO monitoring_user;
GRANT SELECT ON sys.gv_$sql_plan TO monitoring_user;

-- Native operational collection
GRANT SELECT ON sys.dba_tablespace_usage_metrics TO monitoring_user;
GRANT SELECT ON sys.dba_tablespaces TO monitoring_user;
GRANT SELECT ON sys.dba_temp_free_space TO monitoring_user;
GRANT SELECT ON sys.dba_data_files TO monitoring_user;
GRANT SELECT ON sys.dba_temp_files TO monitoring_user;
GRANT SELECT ON sys.gv_$asm_diskgroup_stat TO monitoring_user;
GRANT SELECT ON sys.gv_$con_sysmetric TO monitoring_user;
GRANT SELECT ON sys.gv_$database TO monitoring_user;
GRANT SELECT ON sys.gv_$datafile TO monitoring_user;
GRANT SELECT ON sys.gv_$parameter TO monitoring_user;
GRANT SELECT ON sys.gv_$process TO monitoring_user;
GRANT SELECT ON sys.gv_$resource_limit TO monitoring_user;
GRANT SELECT ON sys.gv_$sga TO monitoring_user;
GRANT SELECT ON sys.gv_$pgastat TO monitoring_user;
GRANT SELECT ON sys.gv_$sysstat TO monitoring_user;
GRANT SELECT ON sys.gv_$sys_time_model TO monitoring_user;
GRANT SELECT ON sys.gv_$system_wait_class TO monitoring_user;
GRANT SELECT ON sys.product_component_version TO monitoring_user;
```

The operational grants cover database and instance state, session and process
capacity, configured resource limits, permanent and temporary tablespace
usage and allocation, ASM capacity, cumulative CPU/I/O and system counters,
observed SGA/PGA allocation, database product/version identity, wait classes,
and bounded system metrics. They are required when the default
`operational.enabled: true` setting is used.

To collect alert logs, also grant:

```sql
GRANT SELECT ON sys.v_$diag_alert_ext TO monitoring_user;
```

Additional permissions may be required for user-defined metric queries.

### Optional Oracle ASH Grant

:::warning  
Oracle Diagnostics Pack  
The Oracle ASH collector is **DISABLED by default**.   
Enabling it requires that **YOU verify your Oracle Diagnostics Pack licensing**.
:::


The default `performance.activity.source: session` does not need access to
`GV$ACTIVE_SESSION_HISTORY`. Only grant access when the deployment will
explicitly use `source: ash`:

```sql
GRANT SELECT ON sys.gv_$active_session_history TO monitoring_user;
```

## PDB Database

For a pluggable database, create the monitoring user and apply the selected
permission model inside the PDB that will be monitored:

```sql
ALTER SESSION SET CONTAINER = app_pdb;
```

Then run the profile, user creation, and grants from the non-PDB section. Configure
the scraper connection URL to use the corresponding PDB service:

```yaml
databases:
  production_app_pdb:
    username: monitoring_user
    password: ${DB_PASSWORD}
    url: db-host.example.com:1521/APP_PDB
```

A local PDB monitoring user only observes that PDB. Queries running in `CDB$ROOT`
or another PDB are outside its scope. To monitor multiple PDBs, configure one
scraper database entry per PDB.
