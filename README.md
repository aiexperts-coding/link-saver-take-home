# Link Saver

A small single-page application that saves links, fetches each page's real title on the server, records when it was saved, and persists the collection across restarts. Links can be deleted, marked as favourites, and filtered to show favourites only.

## Run locally

Requirements: Node.js 20 or newer and network access to the pages whose titles are fetched.

```bash
npm install
npm start
```

Open `http://localhost:3000`.

To run the automated checks:

```bash
npm test
```

Runtime data is created in `data/links.json`. The file is intentionally ignored by Git.

## Assumptions and decisions

- A URL must include `http://` or `https://`.
- The server follows redirects while fetching and saves the normalized submitted URL together with the first usable HTML `<title>`.
- A link is not saved if the URL is invalid, the request fails or times out, the response is not successful HTML, or no usable title is present.
- Duplicate URLs are allowed because the brief does not define duplicate handling and separate saves may still be meaningful.
- JSON-file persistence is sufficient for a time-boxed, single-user exercise. Writes are serialized within the process so overlapping mutations do not overwrite one another.
- Dates are stored as ISO strings and formatted in the browser using the user's locale.

## Favourite feature change

The add/list/delete baseline was completed before favourites were introduced. The favourite change touched exactly these files:

- `src/link-store.js` — added the persisted boolean and update operation, including compatibility with earlier records;
- `src/app.js` — added the validated `PATCH /api/links/:id/favourite` endpoint;
- `public/index.html` — added the favourite control, filter, and filtered empty state;
- `public/app.js` — added toggle/filter behaviour and accessible button state;
- `public/styles.css` — added styles for the new controls;
- `test/link-store.test.js` — added persistence and unknown-ID coverage;
- `test/api.test.js` — added endpoint success and validation coverage;
- `test/ui.test.js` — added a check that the controls are served.

Commit `bde614a` contains this feature as a separate change.

## Why this stack

Node.js and Express keep the application to one process and let the server fetch external pages without browser CORS restrictions. Plain browser JavaScript avoids adding a framework for a small interface, while Cheerio parses titles more reliably than a regular expression and Node's built-in test runner keeps the test setup small.

If the code had to grow, I would separate HTTP handlers from application services and put persistence behind a repository interface. I would then replace the JSON file with a transactional database and introduce configuration, structured logging, and integration boundaries without changing the browser contract.

## Deliberately left out

- Authentication, multiple users, deployment, Docker, pagination, search, and duplicate detection are outside the requested scope.
- Production-grade SSRF protection is not implemented. An internet-facing version must resolve and block private, loopback, link-local, and cloud metadata destinations on every redirect, with network egress controls as a second layer.
- The server does not impose a downloaded-body size limit. A production fetcher should stream and cap the response before parsing it.
- File writes are not a substitute for database transactions across multiple server processes.
- The UI uses the browser's current locale for timestamps rather than a user-configurable timezone.

## AI-assisted workflow

The three most consequential working prompts and the way their output was checked are recorded in [AI_PROMPTS.md](AI_PROMPTS.md). The generated baseline was not accepted as final: tests and browser review exposed premature favourite wiring and a native form-validation conflict, and both were corrected before the feature commit.

## Part B

[REVIEW.md](REVIEW.md) ranks the supplied snippet's defects by severity, explains the triggering inputs and impact, and includes a corrected version.

## Questions I would have asked

Before starting, I would have asked whether this tool is assumed to be trusted and single-user or exposed to arbitrary users, because that changes the required SSRF controls and persistence choice. I would also have clarified whether duplicate URLs should be rejected, whether redirects should update the displayed URL, and whether a page without a `<title>` should be saved using the hostname or rejected. For this submission I chose the smallest defensible behaviour and documented it above.

## Screen recording

The three-minute walkthrough link will be added after the final local review. The recording will show save, restart persistence, favourite filtering, deletion, one bad-URL path, and the decision to use a server-side fetcher with JSON persistence for the exercise.
