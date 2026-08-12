import { getInput } from '@actions/core';
import { run } from './runner';
import path from 'path';
import * as github from '@actions/github';

const { pusher, repository } = github.context.payload;

const token = getInput('token') || process.env.GITHUB_TOKEN || '';
const branch = getInput('branch') || 'gh-pages';
const themeDirInput = getInput('theme_dir') || '';
const hostname = 'github.com';
const repositoryName = repository?.full_name || process.env.GITHUB_REPOSITORY || '';
const repoPath = process.env.GITHUB_WORKSPACE || path.join(__dirname, '../');
const outputDir = path.join(repoPath, 'output');
const bundledTheme = path.join(__dirname, '../theme');
const themeDir = themeDirInput
  ? path.isAbsolute(themeDirInput)
    ? themeDirInput
    : path.join(repoPath, themeDirInput)
  : bundledTheme;

run({
  token,
  pusherName: pusher?.name || process.env.GITHUB_PUSHER_NAME || 'github-actions[bot]',
  pusherEmail:
    pusher?.email ||
    process.env.GITHUB_PUSHER_EMAIL ||
    '41898282+github-actions[bot]@users.noreply.github.com',
  repositoryName,
  hostname,
  repoPath,
  repoUrl: `https://x-access-token:${token}@${hostname}/${repositoryName}.git`,
  outputDir,
  branch,
  themeDir
});
