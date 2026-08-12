import ejs from 'ejs';
import dayjs from 'dayjs';
import slugify from 'slugify';
import showdown from 'showdown';
import fm, { FrontMatterResult } from 'front-matter';
import path from 'path';
import fsExtra from 'fs-extra';
import fs from 'fs';
import { info, warning } from '@actions/core';
import { ConfigurationType } from './git';

type FrontMatterType = {
  title?: string;
  date?: string;
  permalink?: string;
  externalUrl?: string;
  draft?: boolean | string;
  description?: string;
};

type PostType = {
  title: string;
  date: string;
  dateRaw: string;
  sortValue: number;
  permalink: string;
  externalUrl?: string;
  html: string;
  description: string;
};

type SiteConfigType = {
  title: string;
  subtitle?: string;
  baseUrl?: string;
  url?: string;
  owner?: {
    name?: string;
    email?: string;
  };
  social?: {
    github?: string;
    twitter?: string;
    medium?: string;
  };
  seo?: {
    title?: string;
    description?: string;
    author?: string;
    keywords?: string[];
  };
  cname?: string;
  favicon?: string;
  ogImage?: string;
  newsletterHtml?: string;
};

export function parseJsonc<T = unknown>(text: string): T {
  const stripped = text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/,\s*([}\]])/g, '$1');
  return JSON.parse(stripped) as T;
}

export function quoteUnsafeYamlScalars(frontmatter: string): string {
  return frontmatter.replace(/^([A-Za-z0-9_-]+):\s*(.+)$/gm, (line, key, value) => {
    const trimmed = value.trim();
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
      /^(true|false|null|\d+(\.\d+)?)$/i.test(trimmed)
    ) {
      return line;
    }
    if (/[:#{}[\],&*?|>!%@`]/.test(trimmed)) {
      return `${key}: "${trimmed.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    }
    return line;
  });
}

export function startOfTodayUtc(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

export function isFutureDate(value?: string): boolean {
  if (!value) return false;
  const d = dayjs(value);
  if (!d.isValid()) return false;
  const postDay = Date.UTC(d.year(), d.month(), d.date());
  return postDay > startOfTodayUtc();
}

export function isDraft(attributes: FrontMatterType, fileName: string): boolean {
  if (fileName.startsWith('_')) return true;
  const draft = attributes.draft;
  if (draft === true || draft === 'true' || draft === 'yes') return true;
  return false;
}

export function shouldPublishPost(attributes: FrontMatterType, fileName: string): boolean {
  if (!fileName.endsWith('.md')) return false;
  if (isDraft(attributes, fileName)) return false;
  if (isFutureDate(attributes.date)) return false;
  return true;
}

export function sortPostsByDateDesc(posts: { sortValue: number }[]): void {
  posts.sort((a, b) => b.sortValue - a.sortValue);
}

function createMarkdownConverter(): showdown.Converter {
  return new showdown.Converter({
    tables: true,
    strikethrough: true,
    tasklists: true,
    ghCompatibleHeaderId: true,
    simplifiedAutoLink: true,
    literalMidWordUnderscores: true,
    ghCodeBlocks: true,
    emoji: true,
    openLinksInNewWindow: false,
    encodeEmails: false
  });
}

function excerptFromMarkdown(body: string, fallback = ''): string {
  const text = body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`\[\]!()\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (text || fallback).slice(0, 160);
}

function resolveSiteUrl(siteConfig: SiteConfigType): string {
  if (siteConfig.url) return siteConfig.url.replace(/\/$/, '');
  if (siteConfig.cname) return `https://${siteConfig.cname.replace(/\/$/, '')}`;
  return '';
}

function resolveThemePath(configuration: ConfigurationType): string {
  if (configuration.themeDir && fs.existsSync(configuration.themeDir)) {
    return configuration.themeDir;
  }

  const contentTheme = path.join(configuration.repoPath, 'theme');
  if (fs.existsSync(contentTheme) && fs.existsSync(path.join(contentTheme, 'index.ejs'))) {
    info(`Using content-repo theme at ${contentTheme}`);
    return contentTheme;
  }

  return path.join(__dirname, '../theme');
}

export async function prepareTheme(configuration: ConfigurationType): Promise<void> {
  const outputDir = configuration.outputDir;
  const repoPath = configuration.repoPath;
  const themePath = resolveThemePath(configuration);
  const htmlConverter = createMarkdownConverter();

  const siteConfigRaw = fs.readFileSync(path.join(repoPath, 'site.json'), 'utf8');
  const siteConfig = parseJsonc<SiteConfigType>(siteConfigRaw);
  siteConfig.url = resolveSiteUrl(siteConfig);
  siteConfig.baseUrl = (siteConfig.baseUrl || '').replace(/\/$/, '');
  siteConfig.seo = siteConfig.seo || {
    title: siteConfig.title,
    description: siteConfig.subtitle || '',
    author: siteConfig.owner?.name || '',
    keywords: []
  };
  siteConfig.favicon = siteConfig.favicon || '/favicon.svg';
  siteConfig.ogImage = siteConfig.ogImage || '/og.png';

  async function prepareThemeFiles(): Promise<void> {
    info('Preparing theme files');
    const nonPageFiles = fs
      .readdirSync(themePath)
      .filter(file => !file.endsWith('.ejs') && !file.startsWith('_'));

    nonPageFiles.forEach(nonPageFileName => {
      const nonPageFilePath = path.join(themePath, nonPageFileName);
      const outputPath = path.join(outputDir, nonPageFileName);
      fsExtra.copySync(nonPageFilePath, outputPath);
    });

    if (siteConfig.cname) {
      fs.writeFileSync(path.join(outputDir, 'CNAME'), siteConfig.cname);
    }

    fs.writeFileSync(path.join(outputDir, '.nojekyll'), '');
  }

  async function prepareBlogPosts(): Promise<PostType[]> {
    info('Preparing blog posts');
    const postsDir = path.join(repoPath, './posts');
    if (!fs.existsSync(postsDir)) {
      warning('No posts/ directory found');
      return [];
    }

    const postFiles = fs.readdirSync(postsDir);
    const posts: PostType[] = [];

    for (const contentFile of postFiles) {
      const contentFilePath = path.join(postsDir, contentFile);
      if (!fs.statSync(contentFilePath).isFile() || !contentFile.endsWith('.md')) {
        continue;
      }

      const content = fs.readFileSync(contentFilePath, 'utf8');
      const normalized = content.replace(/^---\r?\n([\s\S]*?)\r?\n---/, (_, fmBlock) => {
        return `---\n${quoteUnsafeYamlScalars(fmBlock)}\n---`;
      });
      const parsed = fm(normalized) as FrontMatterResult<FrontMatterType>;
      const attributes = (parsed.attributes || {}) as FrontMatterType;

      if (!shouldPublishPost(attributes, contentFile)) {
        info(`Skipping unpublished post: ${contentFile}`);
        continue;
      }

      let { title, date, permalink, externalUrl, description } = attributes;
      title = title || path.basename(contentFile, '.md');

      const dateRaw = date || dayjs().format('YYYY-MM-DD');
      const parsedDate = dayjs(dateRaw);
      const displayDate = parsedDate.isValid()
        ? parsedDate.format('ddd, MMMM DD, YYYY')
        : dayjs().format('ddd, MMMM DD, YYYY');
      const sortValue = parsedDate.isValid() ? parsedDate.valueOf() : Date.now();

      const postHtml = htmlConverter.makeHtml(parsed.body);
      const fullFileName = (permalink || slugify(title).toLowerCase()).replace(/^\//, '');
      const fullFileNameParts = fullFileName.replace(/\/$/, '').split('/');
      const fileName = fullFileNameParts.pop() || '';
      const nestedPostDir = fullFileNameParts.join('/');

      if (nestedPostDir) {
        fsExtra.ensureDirSync(path.join(outputDir, nestedPostDir));
      }

      const postMeta: PostType = {
        title,
        date: displayDate,
        dateRaw,
        sortValue,
        permalink: path.posix.join('/', nestedPostDir, fileName),
        externalUrl,
        html: postHtml,
        description: description || excerptFromMarkdown(parsed.body, siteConfig.seo?.description || '')
      };

      const populatedTemplate = await ejs.renderFile(path.join(themePath, 'post.ejs'), {
        post: postMeta,
        siteConfig
      });

      fs.writeFileSync(path.join(outputDir, nestedPostDir, `${fileName}.html`), populatedTemplate);
      posts.push(postMeta);
    }

    return posts;
  }

  async function prepareAbout(): Promise<void> {
    info('Preparing about page');
    const aboutPath = path.join(repoPath, 'about.md');
    const aboutContent = fs.existsSync(aboutPath) ? fs.readFileSync(aboutPath, 'utf8') : '';
    const html = htmlConverter.makeHtml(aboutContent);

    const populatedTemplate = await ejs.renderFile(path.join(themePath, 'about.ejs'), {
      siteConfig,
      html
    });

    fs.writeFileSync(path.join(outputDir, 'about.html'), populatedTemplate);
  }

  async function prepareStaticPages(): Promise<void> {
    info('Preparing 404 page');
    const populatedTemplate = await ejs.renderFile(path.join(themePath, '404.ejs'), { siteConfig });
    fs.writeFileSync(path.join(outputDir, '404.html'), populatedTemplate);
  }

  async function prepareHome(posts: PostType[]): Promise<void> {
    info('Preparing homepage');
    sortPostsByDateDesc(posts);

    const groupedPosts = posts.reduce((aggMap, postItem) => {
      const year = dayjs(postItem.dateRaw).isValid()
        ? dayjs(postItem.dateRaw).format('YYYY')
        : dayjs(postItem.date).format('YYYY');
      aggMap.set(year, [...(aggMap.get(year) || []), postItem]);
      return aggMap;
    }, new Map<string, PostType[]>());

    const homeHtml = await ejs.renderFile(path.join(themePath, 'index.ejs'), {
      siteConfig,
      groupedPosts
    });

    fs.writeFileSync(path.join(outputDir, 'index.html'), homeHtml);
  }

  async function prepareSitemap(posts: PostType[]): Promise<void> {
    info('Preparing sitemap');
    const siteUrl = siteConfig.url;
    if (!siteUrl) {
      warning('No site url/cname set — skipping sitemap.xml');
      return;
    }

    const urls: { loc: string; priority: string; lastmod?: string }[] = [
      { loc: `${siteUrl}/`, priority: '1.0' },
      { loc: `${siteUrl}/about.html`, priority: '0.6' },
      ...posts.map(post => ({
        loc: `${siteUrl}${post.permalink}.html`,
        priority: '0.8',
        lastmod: dayjs(post.dateRaw).isValid() ? dayjs(post.dateRaw).format('YYYY-MM-DD') : undefined
      }))
    ];

    const body = urls
      .map(entry => {
        const lastmod = entry.lastmod ? `\n    <lastmod>${entry.lastmod}</lastmod>` : '';
        return `  <url>\n    <loc>${entry.loc}</loc>${lastmod}\n    <priority>${entry.priority}</priority>\n  </url>`;
      })
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
    fs.writeFileSync(path.join(outputDir, 'sitemap.xml'), xml);
  }

  async function copyStaticAssets(): Promise<void> {
    info('Copying static assets');
    const staticAssetsPath = path.join(repoPath, 'static');
    if (fs.existsSync(staticAssetsPath)) {
      fsExtra.copySync(staticAssetsPath, outputDir);
    }
  }

  fsExtra.removeSync(configuration.outputDir);
  fsExtra.ensureDirSync(configuration.outputDir);

  await prepareThemeFiles();
  await prepareAbout();
  await prepareStaticPages();
  const posts = await prepareBlogPosts();
  await prepareHome(posts);
  await prepareSitemap(posts);
  await copyStaticAssets();
}
