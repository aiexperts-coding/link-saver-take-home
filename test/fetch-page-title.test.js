import assert from 'node:assert/strict';
import test from 'node:test';

import { fetchPageTitle, TitleFetchError } from '../src/fetch-page-title.js';

test('fetches and normalizes the first page title', async () => {
  const fetchImpl = async () => new Response(
    '<html><head><TITLE>  Example\n  Domain </TITLE></head></html>',
    {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    },
  );

  assert.deepEqual(
    await fetchPageTitle('https://example.com', { fetchImpl }),
    { url: 'https://example.com/', title: 'Example Domain' },
  );
});

test('rejects malformed and unsupported URLs', async () => {
  await assert.rejects(
    () => fetchPageTitle('not-a-url'),
    (error) => error instanceof TitleFetchError && error.status === 400,
  );

  await assert.rejects(
    () => fetchPageTitle('ftp://example.com'),
    (error) => error instanceof TitleFetchError && error.status === 400,
  );
});

test('maps an unsuccessful upstream response to a controlled error', async () => {
  const fetchImpl = async () => new Response('Not found', { status: 404 });

  await assert.rejects(
    () => fetchPageTitle('https://example.com', { fetchImpl }),
    (error) => error instanceof TitleFetchError && error.status === 502,
  );
});

test('rejects a non-HTML response', async () => {
  const fetchImpl = async () => new Response('{}', {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

  await assert.rejects(
    () => fetchPageTitle('https://example.com', { fetchImpl }),
    (error) => error instanceof TitleFetchError && error.status === 422,
  );
});

test('rejects an HTML page without a usable title', async () => {
  const fetchImpl = async () => new Response('<html><body>No title</body></html>', {
    status: 200,
    headers: { 'content-type': 'text/html' },
  });

  await assert.rejects(
    () => fetchPageTitle('https://example.com', { fetchImpl }),
    (error) => error instanceof TitleFetchError && error.status === 422,
  );
});

test('maps a network failure to a controlled error', async () => {
  const fetchImpl = async () => {
    throw new TypeError('fetch failed');
  };

  await assert.rejects(
    () => fetchPageTitle('https://example.com', { fetchImpl }),
    (error) => error instanceof TitleFetchError && error.status === 502,
  );
});

test('aborts a slow upstream request', async () => {
  const fetchImpl = async (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });

  await assert.rejects(
    () => fetchPageTitle('https://example.com', { fetchImpl, timeoutMs: 5 }),
    (error) => error instanceof TitleFetchError && error.status === 504,
  );
});
