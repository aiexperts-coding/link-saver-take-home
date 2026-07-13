import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

function cloneLink(link) {
  return { ...link };
}

function normalizeStoredLink(link, index) {
  const hasValidFields = link
    && typeof link === 'object'
    && !Array.isArray(link)
    && typeof link.id === 'string'
    && link.id.trim() !== ''
    && typeof link.url === 'string'
    && typeof link.title === 'string'
    && link.title.trim() !== ''
    && typeof link.savedAt === 'string'
    && !Number.isNaN(Date.parse(link.savedAt))
    && (link.favourite === undefined || typeof link.favourite === 'boolean');

  let hasSupportedUrl = false;

  if (hasValidFields) {
    try {
      hasSupportedUrl = ['http:', 'https:'].includes(new URL(link.url).protocol);
    } catch {
      hasSupportedUrl = false;
    }
  }

  if (!hasValidFields || !hasSupportedUrl) {
    throw new SyntaxError(`Stored link ${index + 1} is invalid.`);
  }

  return {
    ...link,
    favourite: link.favourite === true,
  };
}

export async function createLinkStore(filePath) {
  await mkdir(path.dirname(filePath), { recursive: true });

  let links;

  try {
    const raw = await readFile(filePath, 'utf8');
    links = JSON.parse(raw);

    if (!Array.isArray(links)) {
      throw new SyntaxError('The root value must be an array.');
    }

    links = links.map(normalizeStoredLink);
  } catch (error) {
    if (error.code === 'ENOENT') {
      links = [];
      await writeFile(filePath, '[]\n', 'utf8');
    } else if (error instanceof SyntaxError) {
      throw new Error(`Could not parse the link data file: ${error.message}`);
    } else {
      throw error;
    }
  }

  let mutationQueue = Promise.resolve();

  function enqueueMutation(createMutation) {
    const operation = mutationQueue.then(async () => {
      const { nextLinks, result } = createMutation(links);

      if (nextLinks) {
        await writeFile(
          filePath,
          `${JSON.stringify(nextLinks, null, 2)}\n`,
          'utf8',
        );
        links = nextLinks;
      }

      return result;
    });

    mutationQueue = operation.then(
      () => undefined,
      () => undefined,
    );

    return operation;
  }

  return {
    async list() {
      return links.map(cloneLink);
    },

    async add({ url, title }) {
      return enqueueMutation((currentLinks) => {
        const link = {
          id: randomUUID(),
          url,
          title,
          savedAt: new Date().toISOString(),
          favourite: false,
        };

        return {
          nextLinks: [link, ...currentLinks],
          result: cloneLink(link),
        };
      });
    },

    async setFavourite(id, favourite) {
      return enqueueMutation((currentLinks) => {
        const index = currentLinks.findIndex((link) => link.id === id);

        if (index === -1) {
          return { nextLinks: null, result: null };
        }

        const updated = { ...currentLinks[index], favourite };

        return {
          nextLinks: currentLinks.with(index, updated),
          result: cloneLink(updated),
        };
      });
    },

    async remove(id) {
      return enqueueMutation((currentLinks) => {
        const nextLinks = currentLinks.filter((link) => link.id !== id);

        if (nextLinks.length === currentLinks.length) {
          return { nextLinks: null, result: false };
        }

        return { nextLinks, result: true };
      });
    },
  };
}
