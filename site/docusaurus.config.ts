import type * as Preset from '@docusaurus/preset-classic';
import type {Config} from '@docusaurus/types';
import {themes as prismThemes} from 'prism-react-renderer';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const config: Config = {
  title : 'Harry - Performance Scraper for Oracle Database',
  tagline :
      'Open performance data pipeline for Oracle databases. Collect once. Investigate from anywhere.',
  favicon : 'img/harry/harry_favicon.png',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future : {
    v4 : true, // Improve compatibility with the upcoming Docusaurus v4
  },

  url : 'https://harryperformance.com',
  // The custom GitHub Pages domain serves this site from its root path.
  baseUrl : '/',

  clientModules : [ './matomo.js' ],

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName : 'OneClickDBA',
  projectName : 'harry-performance-scraper-web',

  onBrokenLinks : 'throw',
  markdown : {
    hooks : {
      onBrokenMarkdownLinks : 'warn',
    },
  },

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n : {
    defaultLocale : 'en',
    locales : [ 'en' ],
  },

  presets : [
    [
      'classic',
      {
        docs : {
          sidebarPath : './sidebars.ts',
          // Please change this to your repo.
          // Remove this to remove the "edit this page" links.
          editUrl :
              'https://github.com/OneClickDBA/harry-performance-scraper-web/tree/main/site/',
        },
        theme : {
          customCss : './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins : [
    [
      '@docusaurus/plugin-content-docs',
      {
        id : 'useCases',
        path : 'use-cases',
        routeBasePath : 'use-cases',
        sidebarPath : './sidebarsUseCases.ts',
        editUrl :
            'https://github.com/OneClickDBA/harry-performance-scraper-web/tree/main/site/',
      },
    ],
  ],

  themeConfig : {
    // Replace with your project's social card
    image : 'img/harry/harry_mini.png',
    navbar : {
      title : 'Harry - Performance Scraper for Oracle Database',
      logo : {
        alt : 'Harry - Performance Scraper for Oracle Database logo',
        src : 'img/harry/harry.png',
      },
      items : [
        {
          type : 'docSidebar',
          sidebarId : 'tutorialSidebar',
          position : 'left',
          label : 'Docs',
        },
        {
          to : '/docs/getting-started/basics',
          label : 'Tutorial',
          position : 'left',
        },
        {
          type : 'docSidebar',
          sidebarId : 'useCasesSidebar',
          docsPluginId : 'useCases',
          position : 'left',
          label : 'Use Cases',
        },
        {
          href : 'https://demo.harryperformance.com',
          label : 'Live Demo',
          position : 'right',
          className : 'navbar-demo-button',
        },
        {
          href : 'https://github.com/OneClickDBA/harry-performance-scraper',
          label : 'GitHub',
          position : 'right',
          className : 'navbar-github-button',
        },
        {
          to : '/docs/intro',
          label : 'Read the documentation',
          position : 'right',
          className : 'navbar-docs-button',
        },
      ],
    },
    footer : {
      style : 'dark',
      links : [
        {
          title : 'Docs',
          items : [
            {
              label : 'Live Demo',
              href : 'https://demo.harryperformance.com',
            },
            {
              label : 'Tutorial',
              to : '/docs/intro',
            },
          ],
        },
        {
          title : 'Issues',
          items : [
            {
              label : 'GitHub Issue tracking',
              href :
                  'https://github.com/OneClickDBA/harry-performance-scraper/issues',
            },
          ],
        },
        {
          title : 'More',
          items : [
            {
              label : 'Professional support',
              href : 'https://www.oneclickdba.com/harry/',
            },
            {
              label : 'GitHub',
              href : 'https://github.com/OneClickDBA/harry-performance-scraper',
            },
          ],
        },
      ],
      copyright : `Copyright © ${
          new Date()
              .getFullYear()}, Jorge Holgado, Oracle and/or its affiliates, and other contributors. Built with Docusaurus.`,
    },
    prism : {
      theme : prismThemes.github,
      darkTheme : prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
