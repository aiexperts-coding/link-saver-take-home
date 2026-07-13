# Link Saver

A small take-home project demonstrating structured AI-assisted development, pragmatic scoping, and careful review of generated and existing code.

## Planning checkpoint

Implementation has not started yet. This first checkpoint records the decisions that will guide the build before application code is introduced.

## Scope

The finished application will:

- save a complete HTTP or HTTPS URL;
- fetch the page title on the server;
- display the title, URL, and saved date/time;
- persist links across server restarts;
- delete one selected link;
- add favourites as a separate change after the baseline works;
- filter the list to favourites only;
- return clear errors for malformed URLs and failed page fetches.

## Technical decisions

- Node.js 20+, Express, Cheerio, and plain browser JavaScript.
- One local process and one documented start command.
- JSON persistence is sufficient for the time-boxed, single-user exercise.
- The server owns external page fetching to avoid browser CORS restrictions.
- Focused automated tests will cover persistence, destructive mutations, URL handling, and API errors.
- React, a database, Docker, deployment, authentication, and production-grade SSRF protection are deliberately outside the exercise scope.

## Assumptions

- URLs must include `http://` or `https://`.
- Duplicate URLs are allowed.
- A link is not saved when a usable page title cannot be retrieved.
- Runtime data is created locally and is not committed.
- Full private-network and redirect-target validation would be required before production use.

## Planned delivery sequence

1. Build and verify the persistent add/list/delete baseline.
2. Add the single-page interface.
3. Harden bad-input and upstream-failure behavior.
4. Add favourites as a separate reviewed change.
5. Complete the legacy-code review and submission documentation.
6. Verify installation, tests, startup, restart persistence, and the manual workflow from a clean clone.
