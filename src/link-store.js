import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

function cloneLink(link) {
  return { ...link };
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

  let writeQueue = Promise.resolve();

  function persist() {
    writeQueue = writeQueue
      .catch(() => undefined)
      .then(() => writeFile(filePath, `${JSON.stringify(links, null, 2)}\n`, 'utf8'));

    return writeQueue;
  }

  return {
    async list() {
      return links.map(cloneLink);
    },

    async add({ url, title }) {
      const link = {
        id: randomUUID(),
        url,
        title,
        savedAt: new Date().toISOString(),
        favourite: false,
      };

      links = [link, ...links];
      await persist();

      return cloneLink(link);
    },

    async remove(id) {
      const nextLinks = links.filter((link) => link.id !== id);

      if (nextLinks.length === links.length) {
        return false;
      }

      links = nextLinks;
      await persist();

      return true;
    },
  };
}
