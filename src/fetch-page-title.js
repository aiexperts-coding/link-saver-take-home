import { load } from 'cheerio';

export class TitleFetchError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = 'TitleFetchError';
    this.code = code;
    this.status = status;
  }
}

function parseUrl(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TitleFetchError(
      'INVALID_URL',
      'Enter a complete HTTP or HTTPS URL.',
      400,
    );
  }

  let url;

  try {
    url = new URL(value.trim());
  } catch {
    throw new TitleFetchError(
      'INVALID_URL',
      'Enter a complete HTTP or HTTPS URL.',
      400,
    );
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new TitleFetchError(
      'INVALID_URL',
      'Only HTTP and HTTPS URLs are supported.',
      400,
    );
  }

  return url;
}

export async function fetchPageTitle(
  value,
  { fetchImpl = fetch, timeoutMs = 5000 } = {},
) {
  const url = parseUrl(value);

  try {
    const response = await fetchImpl(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': 'LinkSaver/1.0',
      },
    });

    if (!response.ok) {
      throw new TitleFetchError(
        'UPSTREAM_RESPONSE_ERROR',
        `The page returned HTTP ${response.status}.`,
        502,
      );
    }

    const contentType = response.headers.get('content-type');

    if (contentType && !contentType.toLowerCase().includes('text/html')) {
      throw new TitleFetchError(
        'UNSUPPORTED_CONTENT',
        'The URL did not return an HTML page.',
        422,
      );
    }

    const $ = load(await response.text());
    const title = $('title').first().text().replace(/\s+/g, ' ').trim();

    if (!title) {
      throw new TitleFetchError(
        'TITLE_NOT_FOUND',
        'The page does not contain a usable title.',
        422,
      );
    }

    return { url: url.href, title };
  } catch (error) {
    if (error instanceof TitleFetchError) {
      throw error;
    }

    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      throw new TitleFetchError(
        'UPSTREAM_TIMEOUT',
        'The page took too long to respond.',
        504,
      );
    }

    throw new TitleFetchError(
      'UPSTREAM_FETCH_ERROR',
      'The page could not be fetched.',
      502,
    );
  }
}
