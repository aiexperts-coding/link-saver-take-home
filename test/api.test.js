import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import request from 'supertest';

import { createApp } from '../src/app.js';
import { TitleFetchError } from '../src/fetch-page-title.js';
import { createLinkStore } from '../src/link-store.js';

async function withApp(run, fetchTitle = async (url) => ({
  url: new URL(url).href,
  title: 'Example Domain',
})) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'link-saver-api-'));

  try {
    const store = await createLinkStore(path.join(directory, 'links.json'));
    const app = createApp({ store, fetchTitle });
    await run({ app });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('creates, lists, and deletes a persisted link', async () => {
  await withApp(async ({ app }) => {
    const created = await request(app)
      .post('/api/links')
      .send({ url: 'https://example.com' })
      .expect(201);

    assert.equal(created.body.title, 'Example Domain');
    assert.equal(created.body.favourite, false);

    const listed = await request(app).get('/api/links').expect(200);
    assert.deepEqual(listed.body, [created.body]);

    await request(app).delete(`/api/links/${created.body.id}`).expect(204);

    const empty = await request(app).get('/api/links').expect(200);
    assert.deepEqual(empty.body, []);
  });
});

test('returns controlled fetch errors without saving a link', async () => {
  const fetchTitle = async () => {
    throw new TitleFetchError(
      'INVALID_URL',
      'Enter a complete HTTP or HTTPS URL.',
      400,
    );
  };

  await withApp(async ({ app }) => {
    const response = await request(app)
      .post('/api/links')
      .send({ url: 'bad' })
      .expect(400);

    assert.deepEqual(response.body, {
      error: {
        code: 'INVALID_URL',
        message: 'Enter a complete HTTP or HTTPS URL.',
      },
    });

    const listed = await request(app).get('/api/links').expect(200);
    assert.deepEqual(listed.body, []);
  }, fetchTitle);
});

test('returns 404 without mutation for an unknown delete ID', async () => {
  await withApp(async ({ app }) => {
    const response = await request(app)
      .delete('/api/links/missing')
      .expect(404);

    assert.deepEqual(response.body, {
      error: { code: 'LINK_NOT_FOUND', message: 'Link not found.' },
    });
  });
});

test('returns a controlled error for invalid JSON', async () => {
  await withApp(async ({ app }) => {
    const response = await request(app)
      .post('/api/links')
      .set('content-type', 'application/json')
      .send('{broken')
      .expect(400);

    assert.deepEqual(response.body, {
      error: {
        code: 'INVALID_JSON',
        message: 'Request body must contain valid JSON.',
      },
    });
  });
});
