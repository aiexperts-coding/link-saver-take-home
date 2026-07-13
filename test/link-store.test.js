import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createLinkStore } from '../src/link-store.js';

async function withStore(run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'link-saver-'));
  const filePath = path.join(directory, 'links.json');

  try {
    await run({ filePath });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('creates empty storage when the data file is missing', async () => {
  await withStore(async ({ filePath }) => {
    const store = await createLinkStore(filePath);

    assert.deepEqual(await store.list(), []);
    assert.deepEqual(JSON.parse(await readFile(filePath, 'utf8')), []);
  });
});

test('persists links across store reloads', async () => {
  await withStore(async ({ filePath }) => {
    const firstStore = await createLinkStore(filePath);
    const created = await firstStore.add({
      url: 'https://example.com/',
      title: 'Example Domain',
    });

    assert.equal(created.favourite, false);

    const secondStore = await createLinkStore(filePath);

    assert.deepEqual(await secondStore.list(), [created]);
  });
});

test('persists favourite changes across store reloads', async () => {
  await withStore(async ({ filePath }) => {
    const firstStore = await createLinkStore(filePath);
    const created = await firstStore.add({
      url: 'https://example.com/',
      title: 'Example Domain',
    });

    const updated = await firstStore.setFavourite(created.id, true);

    assert.equal(updated.favourite, true);
    assert.equal(await firstStore.setFavourite('missing-id', true), null);

    const secondStore = await createLinkStore(filePath);
    assert.deepEqual(await secondStore.list(), [updated]);
  });
});

test('removes only the requested link', async () => {
  await withStore(async ({ filePath }) => {
    const store = await createLinkStore(filePath);
    const first = await store.add({ url: 'https://one.example/', title: 'One' });
    const second = await store.add({ url: 'https://two.example/', title: 'Two' });

    assert.equal(await store.remove(first.id), true);
    assert.deepEqual(await store.list(), [second]);
    assert.equal(await store.remove('missing-id'), false);
    assert.deepEqual(await store.list(), [second]);
  });
});

test('rejects malformed JSON instead of silently erasing it', async () => {
  await withStore(async ({ filePath }) => {
    await writeFile(filePath, '{broken', 'utf8');

    await assert.rejects(
      () => createLinkStore(filePath),
      /Could not parse the link data file/,
    );
  });
});

test('rejects stored records that do not match the link schema', async () => {
  await withStore(async ({ filePath }) => {
    await writeFile(filePath, '[{}]\n', 'utf8');

    await assert.rejects(
      () => createLinkStore(filePath),
      /Could not parse the link data file: Stored link 1 is invalid/,
    );
  });
});

test('keeps memory unchanged after a failed write and recovers on the next mutation', async () => {
  await withStore(async ({ filePath }) => {
    const store = await createLinkStore(filePath);

    await rm(filePath);
    await mkdir(filePath);

    await assert.rejects(() => store.add({
      url: 'https://failed.example/',
      title: 'Failed write',
    }));
    assert.deepEqual(await store.list(), []);

    await rm(filePath, { recursive: true });
    await writeFile(filePath, '[]\n', 'utf8');

    const saved = await store.add({
      url: 'https://saved.example/',
      title: 'Saved write',
    });

    assert.deepEqual(await store.list(), [saved]);
    assert.deepEqual(
      await createLinkStore(filePath).then((reloaded) => reloaded.list()),
      [saved],
    );
  });
});
