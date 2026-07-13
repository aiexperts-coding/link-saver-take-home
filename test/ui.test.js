import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import request from 'supertest';

import { createApp } from '../src/app.js';

const publicDirectory = fileURLToPath(new URL('../public', import.meta.url));

const store = {
  async list() {
    return [];
  },
  async add() {
    throw new Error('not used');
  },
  async remove() {
    return false;
  },
};

test('serves an accessible single-page link saver interface', async () => {
  const app = createApp({
    store,
    fetchTitle: async () => ({ url: 'https://example.com/', title: 'Example' }),
    publicDirectory,
  });

  const response = await request(app).get('/').expect(200);

  assert.match(response.headers['content-type'], /text\/html/);
  assert.match(response.text, /id="link-form"/);
  assert.match(response.text, /<form[^>]+id="link-form"[^>]+novalidate/);
  assert.match(response.text, /aria-live="polite"/);
  assert.match(response.text, /id="link-list"/);
  assert.match(response.text, /rel="noopener noreferrer"/);
  assert.match(response.text, /id="favourites-filter"/);
  assert.match(response.text, /favourite-button/);
});

test('renders external data through DOM text properties', async () => {
  const clientSource = await readFile(
    fileURLToPath(new URL('../public/app.js', import.meta.url)),
    'utf8',
  );

  assert.match(clientSource, /\.textContent\s*=/);
  assert.doesNotMatch(clientSource, /\.innerHTML\s*=/);
});
