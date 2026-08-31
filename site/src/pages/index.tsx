import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import {ArrowRight, BookOpen, Check, Code2, MonitorPlay} from 'lucide-react';
import HomepageFeatures from '@site/src/components/HomepageFeatures';

import styles from './index.module.css';

const benefits = [
  {
    title: 'Long-term history',
    description: 'Keep years of performance data with retention policies.',
  },
  {
    title: 'Deep troubleshooting',
    description: 'Correlate waits, SQL, sessions, blocking and more.',
  },
  {
    title: 'Grafana-native alerting',
    description: 'Create alerts directly from Harry’s PostgreSQL data using Grafana’s native alerting support.',
  },
  {
    title: 'Native high availability',
    description: 'Deploy multiple Harry instances with automatic leader election and failover.',
  },
];

function HomepageHeader() {
  const harry = useBaseUrl('/img/harry/harry.png');

  return (
    <header className={styles.heroBanner}>
      <div className={clsx('container', styles.heroGrid)}>
        <div className={styles.heroCopy}>
          <Heading as="h1">Performance Scraper for Oracle Database</Heading>
          <p className={styles.heroEyebrow}>
            Open performance data pipeline for Oracle databases.
          </p>
          <Heading as="h2">Collect once. Investigate from anywhere.</Heading>
          <p className={styles.heroDescription}>
            Store SQL, sessions, waits, blocking and ASH samples in PostgreSQL,
            then visualize with Grafana or query directly with SQL.
          </p>
          <div className={styles.heroActions}>
            <a
              className={styles.demoAction}
              href="https://demo.harryperformance.com"
              target="_blank"
              rel="noopener noreferrer">
              <MonitorPlay size={18} aria-hidden="true" />
              Explore the live demo
            </a>
            <a
              className={styles.secondaryAction}
              href="https://github.com/OneClickDBA/harry-performance-scraper"
              target="_blank"
              rel="noopener noreferrer">
              <Code2 size={18} aria-hidden="true" />
              View on GitHub
            </a>
            <Link className={styles.primaryAction} to="/docs/intro">
              <BookOpen size={18} aria-hidden="true" />
              Read the documentation
            </Link>
          </div>
        </div>

        <figure className={styles.heroVisual}>
          <img
            src={harry}
            alt="Mascot of Harry - Performance Scraper for Oracle Database"
          />
          <figcaption className={styles.heroMascotName}>
            <strong>Harry</strong>
            <span>The Performance Scraper</span>
          </figcaption>
        </figure>

        <ul className={styles.benefitList}>
          {benefits.map(({title, description}) => (
            <li key={title}>
              <span className={styles.checkIcon}>
                <Check size={15} aria-hidden="true" />
              </span>
              <div>
                <strong>{title}</strong>
                <span>{description}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}

function Connector({direction, label}: {direction: 'left' | 'right'; label: string}) {
  return (
    <div
      className={clsx(
        styles.connector,
        direction === 'left' ? styles.connectorLeft : styles.connectorRight,
      )}>
      <span>{label}</span>
      <i aria-hidden="true" />
    </div>
  );
}

function ArchitectureDiagram() {
  const harry = useBaseUrl('/img/harry/harry.png');
  const oracleLogo = useBaseUrl('/img/architecture/oracle.svg');
  const postgresqlLogo = useBaseUrl('/img/architecture/postgresql.png');
  const grafanaLogo = useBaseUrl('/img/architecture/grafana.svg');
  const dashboard = useBaseUrl('/img/screenshots/dah.png');

  return (
    <section className={styles.architecture}>
      <div className="container">
        <span className={styles.sectionLabel}>Open performance data pipeline</span>
        <div className={styles.architectureGrid}>
          <div
            className={styles.pipeline}
            role="img"
            aria-label="The scraper collects performance data from Oracle Database, persists it to PostgreSQL, and makes it available to Grafana dashboards and direct SQL queries.">
            <div className={styles.systemNode}>
              <img className={styles.oracleLogo} src={oracleLogo} alt="Oracle" />
              <strong>Oracle Database</strong>
              <small>Performance source</small>
            </div>

            <Connector direction="left" label="Collects" />

            <div className={clsx(styles.systemNode, styles.scraperNode)}>
              <img src={harry} alt="" />
              <strong>Scraper</strong>
              <small>Scheduled collection</small>
            </div>

            <Connector direction="right" label="Persists" />

            <div className={styles.systemNode}>
              <img
                className={styles.postgresqlLogo}
                src={postgresqlLogo}
                alt="PostgreSQL"
              />
              <strong>PostgreSQL</strong>
              <small>Performance repository</small>
            </div>

            <Connector direction="left" label="Queries" />

            <div className={styles.consumers}>
              <div className={styles.consumerNode}>
                <img src={grafanaLogo} alt="Grafana" />
                <div>
                  <strong>Grafana</strong>
                  <small>Dashboards</small>
                </div>
              </div>
              <div className={styles.consumerNode}>
                <span className={styles.sqlMark} aria-hidden="true">SQL</span>
                <div>
                  <strong>Direct queries</strong>
                  <small>SQL analysis</small>
                </div>
              </div>
            </div>
          </div>

          <a
            className={styles.dashboardPreviewLink}
            href="https://demo.harryperformance.com"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open the Harry live Grafana demo">
            <figure className={styles.dashboardPreview}>
              <img
                src={dashboard}
                alt="Grafana Database Activity History dashboard powered by scraper data"
              />
              <figcaption>Open the live Grafana demo</figcaption>
            </figure>
          </a>
        </div>
      </div>
    </section>
  );
}

function DocumentationCta() {
  const harry = useBaseUrl('/img/harry/harry.png');

  return (
    <section className={styles.ctaSection}>
      <div className={clsx('container', styles.ctaContainer)}>
        <img src={harry} alt="" />
        <div className={styles.ctaCopy}>
          <Heading as="h2">Ready to start digging?</Heading>
          <p>Get started in minutes and build your performance history.</p>
        </div>
        <Link className={styles.ctaLink} to="/docs/intro">
          See all documentation
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
        <Link className={styles.ctaButton} to="/docs/getting-started/basics">
          View quickstart guide
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  return (
    <Layout
      title="Harry - Performance Scraper for Oracle Database"
      description="Open performance data pipeline for Oracle databases. Collect once. Investigate from anywhere.">
      <HomepageHeader />
      <main>
        <ArchitectureDiagram />
        <HomepageFeatures />
        <DocumentationCta />
      </main>
    </Layout>
  );
}
