import type {ReactNode} from 'react';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import {
  ArrowRight,
  BriefcaseBusiness,
  ExternalLink,
  GitPullRequest,
  HandCoins,
  Lightbulb,
} from 'lucide-react';

import styles from './sponsor.module.css';

const sourceRepository =
  'https://github.com/OneClickDBA/harry-performance-scraper';
const issueTracker = `${sourceRepository}/issues`;

export default function Sponsor(): ReactNode {
  return (
    <Layout
      title="Support Harry"
      description="Support the continued development of Harry through donations, sponsored features, professional services, testing, and open-source contributions.">
      <main>
        <header className={styles.hero}>
          <div className="container">
            <span className={styles.eyebrow}>Independent open-source development</span>
            <Heading as="h1">Support Harry</Heading>
            <p>
              Harry is independently developed and freely available. If it
              helps you investigate Oracle performance, operate your
              databases, or preserve evidence for later analysis, you can help
              sustain its continued development.
            </p>
            <div className={styles.heroActions}>
              <a
                className={styles.primaryButton}
                href="https://liberapay.com/Harry-Performance/"
                target="_blank"
                rel="noopener noreferrer">
                Support Harry on Liberapay
                <ExternalLink size={17} aria-hidden="true" />
              </a>
              <a className={styles.secondaryButton} href="#ways-to-support">
                Compare support options
                <ArrowRight size={17} aria-hidden="true" />
              </a>
            </div>
          </div>
        </header>

        <section className={styles.optionsSection} id="ways-to-support">
          <div className="container">
            <div className={styles.sectionHeading}>
              <span className={styles.sectionLabel}>Choose the right path</span>
              <Heading as="h2">Three ways to provide financial support</Heading>
              <p>
                A donation supports the project generally. Feature sponsorship
                funds an agreed development effort. Professional services help
                an organization deploy, integrate, or operate Harry.
              </p>
            </div>

            <div className={styles.optionGrid}>
              <article className={styles.optionCard}>
                <span className={styles.optionIcon} aria-hidden="true">
                  <HandCoins size={27} />
                </span>
                <Heading as="h3">Support ongoing development</Heading>
                <p>
                  Liberapay contributions support Harry as a whole, including
                  development, maintenance, testing, documentation, releases,
                  dashboards, and public project resources.
                </p>
                <p className={styles.boundary}>
                  A donation does not include a support agreement or guarantee
                  that a particular feature will enter the roadmap.
                </p>
                <a
                  className={styles.cardAction}
                  href="https://liberapay.com/Harry-Performance/"
                  target="_blank"
                  rel="noopener noreferrer">
                  Support through Liberapay
                  <ExternalLink size={16} aria-hidden="true" />
                </a>
              </article>

              <article className={styles.optionCard}>
                <span className={styles.optionIcon} aria-hidden="true">
                  <Lightbulb size={27} />
                </span>
                <Heading as="h3">Sponsor a feature</Heading>
                <p>
                  If your organization needs a collector, dashboard,
                  integration, deployment option, or operational capability,
                  we can first evaluate whether it fits Harry's architecture
                  and open-source direction.
                </p>
                <p className={styles.boundary}>
                  Development begins only after feasibility, scope, trade-offs,
                  delivery expectations, and funding have been agreed.
                </p>
                <a
                  className={styles.cardAction}
                  href="mailto:dodger@oneclickdba.com?subject=Harry%20feature%20sponsorship">
                  Discuss a feature
                  <ArrowRight size={16} aria-hidden="true" />
                </a>
              </article>

              <article className={styles.optionCard}>
                <span className={styles.optionIcon} aria-hidden="true">
                  <BriefcaseBusiness size={27} />
                </span>
                <Heading as="h3">Hire OneClickDBA</Heading>
                <p>
                  Organizations can obtain professional services with direct
                  involvement from Harry's developer, including architecture,
                  deployment, integration, upgrades, customization,
                  troubleshooting, and performance analysis.
                </p>
                <p className={styles.boundary}>
                  This is contracted commercial work for your environment and
                  is separate from making a project donation.
                </p>
                <a
                  className={styles.cardAction}
                  href="https://www.oneclickdba.com/harry/"
                  target="_blank"
                  rel="noopener noreferrer">
                  Explore professional support
                  <ExternalLink size={16} aria-hidden="true" />
                </a>
              </article>
            </div>

            <p className={styles.paymentNote}>
              Donations are processed by Liberapay. Harry does not collect or
              store payment-card information on this website.
            </p>
          </div>
        </section>

        <section className={styles.explanationSection}>
          <div className={styles.explanationGrid + ' container'}>
            <div>
              <span className={styles.sectionLabel}>Project support</span>
              <Heading as="h2">What general sponsorship supports</Heading>
              <p>
                General sponsorship gives the project more capacity for the
                work required between visible feature releases.
              </p>
              <ul className={styles.checkList}>
                <li>Designing and implementing new project capabilities</li>
                <li>Maintaining compatibility and testing release changes</li>
                <li>Improving documentation, dashboards, and use cases</li>
                <li>Maintaining releases and public project resources</li>
              </ul>
            </div>
            <aside className={styles.commitment}>
              <Heading as="h2">Open-source direction</Heading>
              <p>
                Sponsorship supports development of the open-source project. A
                contribution does not purchase roadmap control, exclusive
                functionality, or a support service-level agreement.
              </p>
              <p>
                When a sponsored capability fits the project, the intended
                default is to contribute it to the open-source codebase so it
                can be reviewed, documented, and maintained with the rest of
                Harry.
              </p>
            </aside>
          </div>
        </section>

        <section className={styles.communitySection}>
          <div className={styles.communityContainer + ' container'}>
            <span className={styles.communityIcon} aria-hidden="true">
              <GitPullRequest size={31} />
            </span>
            <div>
              <span className={styles.sectionLabel}>Contribute without funding</span>
              <Heading as="h2">Other ways to help</Heading>
              <p>
                Reproducible issue reports, testing, documentation fixes,
                operational experience, and technically grounded use cases all
                improve Harry.
              </p>
            </div>
            <div className={styles.communityActions}>
              <a
                className={styles.secondaryButton}
                href={issueTracker}
                target="_blank"
                rel="noopener noreferrer">
                Report an issue
                <ExternalLink size={16} aria-hidden="true" />
              </a>
              <a
                className={styles.primaryButton}
                href={sourceRepository}
                target="_blank"
                rel="noopener noreferrer">
                Contribute on GitHub
                <ExternalLink size={16} aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
