# github-pages-blog-action

Builds a static markdown blog and deploys it to GitHub Pages. Read more on the [LIVE BLOG](https://t0ma5.github.io/how-this-blog-works.html)

Fork of [nilbuild/github-pages-blog-action](https://github.com/nilbuild/github-pages-blog-action) maintained for [blogMD](https://github.com/t0ma5/t0ma5.github.io)

## Features

- Markdown posts with frontmatter (`title`, `date`, `permalink`, `draft`, `description`)
- **Scheduled posts** — future `date` values are skipped until that UTC day
- **Drafts** — `draft: true` or `_filename.md` are never published
- Tolerant `site.json` (comments + trailing commas)
- GFM-friendly markdown (tables, task lists, strikethrough, autolinks)
- Amber dark theme by default (zoom + share controls)
- Date rendered under the post title
- Favicon + Open Graph / Twitter meta from `site.json`
- Canonical URLs + `sitemap.xml` when `url` or `cname` is set
- Optional custom theme via `theme_dir` input or a content-repo `theme/` folder
- Revue newsletter removed (optional `newsletterHtml` if you need a custom block)
- Runs on **Node 20**

## Usage

```yaml
- uses: t0ma5/github-pages-blog-action@v0.1.0
  with:
    branch: gh-pages
    # theme_dir: theme   # optional custom theme in the content repo
```

## Frontmatter

```md
---
title: "My post"
date: 2026-09-01
permalink: /my-post
draft: false
description: "Optional excerpt for SEO/social"
---
```

## site.json

```json
{
  "title": "blogMD",
  "subtitle": "Notes",
  "url": "https://t0ma5.github.io",
  "owner": { "name": "t0+" },
  "social": { "github": "t0ma5" },
  "seo": {
    "title": "blogMD",
    "description": "Random things I find interesting",
    "keywords": ["blog", "markdown"]
  },
  "favicon": "/favicon.svg",
  "ogImage": "/og.png",
  "cname": "t0ma5.github.io"
}
```

## Develop

```bash
npm install
npm run all   # build + package + test
```

Tag releases after packaging so consumers can pin versions (`v0.1.0`, …).
