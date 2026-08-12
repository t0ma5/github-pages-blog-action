import { expect, test, describe } from '@jest/globals';
import {
  isDraft,
  isFutureDate,
  parseJsonc,
  shouldPublishPost,
  sortPostsByDateDesc,
  startOfTodayUtc
} from '../src/theme';

describe('parseJsonc', () => {
  test('allows trailing commas and comments', () => {
    const parsed = parseJsonc<{ title: string; social: { github: string } }>(`{
      // blog title
      "title": "blogMD",
      "social": {
        "github": "t0ma5",
      },
    }`);
    expect(parsed.title).toBe('blogMD');
    expect(parsed.social.github).toBe('t0ma5');
  });
});

describe('scheduling and drafts', () => {
  test('detects future dates', () => {
    const tomorrow = new Date(startOfTodayUtc() + 24 * 60 * 60 * 1000);
    const yyyy = tomorrow.getUTCFullYear();
    const mm = String(tomorrow.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(tomorrow.getUTCDate()).padStart(2, '0');
    expect(isFutureDate(`${yyyy}-${mm}-${dd}`)).toBe(true);
    expect(isFutureDate('2000-01-01')).toBe(false);
  });

  test('draft detection', () => {
    expect(isDraft({ draft: true }, 'post.md')).toBe(true);
    expect(isDraft({ draft: 'true' }, 'post.md')).toBe(true);
    expect(isDraft({}, '_hidden.md')).toBe(true);
    expect(isDraft({}, 'post.md')).toBe(false);
  });

  test('shouldPublishPost gates drafts and future dates', () => {
    expect(shouldPublishPost({ title: 'A', date: '2000-01-01' }, 'a.md')).toBe(true);
    expect(shouldPublishPost({ title: 'A', draft: true, date: '2000-01-01' }, 'a.md')).toBe(false);

    const tomorrow = new Date(startOfTodayUtc() + 24 * 60 * 60 * 1000);
    const yyyy = tomorrow.getUTCFullYear();
    const mm = String(tomorrow.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(tomorrow.getUTCDate()).padStart(2, '0');
    expect(shouldPublishPost({ title: 'A', date: `${yyyy}-${mm}-${dd}` }, 'a.md')).toBe(false);
  });
});

describe('sortPostsByDateDesc', () => {
  test('sorts by full timestamp not day-of-month', () => {
    const posts = [
      { sortValue: Date.parse('2024-01-05') },
      { sortValue: Date.parse('2026-03-01') },
      { sortValue: Date.parse('2025-12-20') }
    ];
    sortPostsByDateDesc(posts);
    expect(posts.map(p => p.sortValue)).toEqual([
      Date.parse('2026-03-01'),
      Date.parse('2025-12-20'),
      Date.parse('2024-01-05')
    ]);
  });
});
