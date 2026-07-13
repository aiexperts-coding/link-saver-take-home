# Key AI Prompts

These were the three working instructions used at the main implementation checkpoints. Routine follow-ups such as running a focused test or showing a diff are omitted. I treated every response as a proposal: I checked it through tests, source review, Git diffs, and the running application before committing it.

## 1. Build the working baseline

```text
Implement Part A of the Link Saver take-home as a deliberately small Node.js
application. Use Node 20+, Express, Cheerio, a JSON file, and plain browser
JavaScript; do not introduce React, a database, Docker, authentication, or
deployment.

First build only the baseline required by the brief: add a complete HTTP(S)
URL, fetch its real page title on the server, show title/URL/saved time, list
saved links after a restart, and delete exactly one requested link. Do not add
or pre-wire favourites yet; that must remain a separate later change.

Use test-driven steps. Cover missing storage, persistence after reload,
destructive deletion, malformed data, invalid/unsupported URLs, non-2xx and
non-HTML responses, missing titles, network errors, timeout, API error shapes,
and safe DOM rendering. Keep runtime data and secrets out of Git. After each
slice, run focused tests, then the full suite, and show the exact diff before
committing.
```

Why it mattered: it set explicit scope boundaries, defined observable failure behaviour, and prevented a framework-heavy implementation.

How I evaluated it: I watched the persistence, fetcher, API, and UI tests fail before their implementations existed, then pass. I also saved and deleted a real `https://example.com` link, refreshed the page, restarted the process, checked the mobile layout, and tested malformed input.

## 2. Review the baseline adversarially

```text
Review the current working Link Saver baseline as an adversarial maintainer.
Do not rewrite the architecture or add new product features.

Inspect the current diff, tests, and runtime behaviour for malformed URLs,
unsupported protocols, upstream 4xx/5xx responses, network failures, timeouts,
missing page titles, invalid JSON request bodies, unknown IDs, unsafe
rendering, and destructive deletion.

For each problem, state the concrete triggering input and impact. Add only the
smallest tests and code changes needed to make the existing behaviour
predictable. Also verify that no favourite data, hidden control, or dormant
feature code exists before the separate favourite change. Run the focused
tests, full suite, dependency audit, and manual baseline workflow. Report what
changed after review and what remains deliberately outside scope.
```

Why it mattered: it asked the AI to challenge its own output against inputs and invariants instead of merely polishing code.

How I evaluated it: the review exposed two concrete issues. The initial HTML relied on native `type="url"` validation, which prevented the server's clearer invalid-URL response from appearing; adding `novalidate` made the intended error path reachable. It also found hidden favourite controls and a premature `favourite` field in the baseline, which I removed and locked down with regression tests before starting the feature.

## 3. Add favourites as a separate feature

```text
Starting from the verified add/list/delete baseline, add exactly one small
feature: mark or unmark a link as a favourite and filter the list to favourites
only. Keep the existing stack and API style; do not refactor unrelated code.

Begin with failing tests. The persisted record should expose `favourite: false`
for new and older baseline records. Add a store update that returns null for an
unknown ID and a PATCH endpoint that accepts only a boolean, returns the
updated link, and gives controlled 400/404 errors. In the UI, add an accessible
toggle with `aria-pressed`, a favourites-only checkbox, and a useful empty
state. Render all external text through DOM text properties.

Verify toggle on/off, filtering, the no-favourites state, persistence across a
real server restart, existing delete behaviour, and the responsive layout.
List every touched file so the README can identify the feature precisely.
```

Why it mattered: it kept the requested change traceable and defined backwards compatibility for data created before the feature.

How I evaluated it: five focused assertions failed before implementation. After the change, all 19 automated tests passed; manual browser checks covered both toggle directions, filtering, the filtered empty state, and a favourite surviving a Node process restart.
