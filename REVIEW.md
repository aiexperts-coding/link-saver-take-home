# Part B: Existing Code Review

The supplied snippet has one immediately destructive bug and several reliability and security problems. I would fix the deletion path first, then prevent unsafe or failed fetches from reaching persistence, and finally make startup and storage predictable.

## Findings

| Severity | Finding | Trigger and impact | Correction |
|---|---|---|---|
| Critical | The delete predicate is reversed and compares different types. | `DELETE /links/123` compares numeric `l.id` with string `req.params.id` using `===`, so every comparison is false and the array becomes empty. Even if types matched, `===` inside `filter` would retain the requested link and delete every other link. | Locate the requested ID as a string, return 404 when absent, and filter with `!==`. |
| High | Arbitrary URLs are fetched without validation. | Missing values, malformed URLs, `file:`-style schemes, loopback/private hosts, or cloud metadata destinations can fail unpredictably or create SSRF exposure when the server is network-reachable. | Require a non-empty HTTP(S) URL. Production code must additionally block resolved private/metadata addresses on every redirect and restrict egress. |
| High | Fetch and response failures are unhandled. | DNS errors, timeouts, refused connections, non-2xx pages, or a rejected promise escape the async handler; depending on the Express/runtime version this can produce a 500, an unhandled rejection, or a hanging request. | Add a timeout, check `response.ok`, and route controlled failures through error middleware. |
| High | Title extraction assumes one exact regex match. | `<TITLE>`, attributes, whitespace/newlines, multiple tags, or a missing title make the regex incorrect or make `[1]` throw. Greedy `.*` can also consume too much. | Parse HTML and explicitly reject an empty title. |
| High | Storage initialization can crash the process. | A missing, empty, malformed, unreadable, or non-array `links.json` fails at module startup before the server listens. The relative path also depends on the launch directory. | Resolve a stable path, create a missing file, validate the root value, and report malformed storage instead of silently erasing it. |
| High | There is no read endpoint. | After a page load or server restart, a client has no route that returns the saved collection, so the core “show saved links” behaviour cannot work. | Add `GET /links` with a stable JSON response. |
| Medium | `Date.now()` is not a safe identifier. | Two saves within the same millisecond can receive the same ID, making later mutations ambiguous. | Use `crypto.randomUUID()`. |
| Medium | The delete endpoint reports success for an unknown ID. | Clients cannot distinguish a deletion from a typo or stale UI state. | Return 404 without mutating storage when the ID is absent; return 204 on success. |
| Medium | Synchronous file I/O blocks the event loop and writes are not coordinated. | A slow disk pauses all requests; overlapping future mutations or multiple processes can lose changes. A crash during a direct write can leave truncated JSON. | Use asynchronous writes and serialize mutations in this small process. A growing service should use transactional storage and atomic replacement. |
| Low | Persistence silently changes the date type. | `savedAt` starts as a `Date` but becomes a string after JSON reload, so behaviour differs before and after restart. | Store an ISO string intentionally and keep the API shape stable. |

## Corrected code

This is a proportionate correction of the supplied CommonJS snippet. It keeps a JSON file and a single process to preserve the original scope. The fuller Part A implementation in this repository separates these responsibilities and includes tests.

```js
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const express = require('express');
const { load } = require('cheerio');

const app = express();
const dataFile = path.join(__dirname, 'links.json');

app.use(express.json({ limit: '10kb' }));

async function loadLinks() {
  try {
    const parsed = JSON.parse(await fs.readFile(dataFile, 'utf8'));
    if (!Array.isArray(parsed)) throw new Error('Root value must be an array');
    return parsed;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await fs.writeFile(dataFile, '[]\n', 'utf8');
    return [];
  }
}

let links;
let writeQueue = Promise.resolve();

function saveLinks() {
  writeQueue = writeQueue.then(() =>
    fs.writeFile(dataFile, `${JSON.stringify(links, null, 2)}\n`, 'utf8'),
  );
  return writeQueue;
}

async function getPage(urlValue) {
  if (typeof urlValue !== 'string' || urlValue.trim() === '') {
    throw Object.assign(new Error('A URL is required'), { status: 400 });
  }

  let url;
  try {
    url = new URL(urlValue.trim());
  } catch {
    throw Object.assign(new Error('The URL is invalid'), { status: 400 });
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw Object.assign(new Error('Only HTTP(S) URLs are supported'), {
      status: 400,
    });
  }

  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw Object.assign(new Error(`Upstream returned ${response.status}`), {
      status: 502,
    });
  }

  const $ = load(await response.text());
  const title = $('title').first().text().replace(/\s+/g, ' ').trim();
  if (!title) {
    throw Object.assign(new Error('The page has no usable title'), {
      status: 422,
    });
  }

  return { url: url.href, title };
}

app.get('/links', (_req, res) => {
  res.json(links);
});

app.post('/links', async (req, res, next) => {
  try {
    const page = await getPage(req.body?.url);
    const link = {
      id: crypto.randomUUID(),
      ...page,
      savedAt: new Date().toISOString(),
    };

    links.push(link);
    await saveLinks();
    res.status(201).json(link);
  } catch (error) {
    next(error);
  }
});

app.delete('/links/:id', async (req, res, next) => {
  try {
    const exists = links.some((link) => String(link.id) === req.params.id);
    if (!exists) return res.status(404).json({ error: 'Link not found' });

    links = links.filter((link) => String(link.id) !== req.params.id);
    await saveLinks();
    return res.sendStatus(204);
  } catch (error) {
    return next(error);
  }
});

app.use((error, _req, res, _next) => {
  const status = Number.isInteger(error.status) ? error.status : 500;
  res.status(status).json({
    error: status === 500 ? 'Unexpected server error' : error.message,
  });
});

loadLinks()
  .then((storedLinks) => {
    links = storedLinks;
    app.listen(3000, () => console.log('Listening on http://localhost:3000'));
  })
  .catch((error) => {
    console.error('Could not initialize storage:', error);
    process.exitCode = 1;
  });
```

## Remaining production concern

The corrected review code validates the scheme but does not claim to solve SSRF completely. Correct protection requires DNS resolution and IP-range checks before connection, re-validation after every redirect, protection against DNS rebinding, and preferably network-level egress rules. That is important for a deployed multi-user service but would be misleading to represent as a few lines in this time-boxed review.
