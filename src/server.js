import { fileURLToPath } from 'node:url';

import { createApp } from './app.js';
import { fetchPageTitle } from './fetch-page-title.js';
import { createLinkStore } from './link-store.js';

const dataFile = fileURLToPath(new URL('../data/links.json', import.meta.url));
const publicDirectory = fileURLToPath(new URL('../public', import.meta.url));
const store = await createLinkStore(dataFile);
const app = createApp({
  store,
  fetchTitle: fetchPageTitle,
  publicDirectory,
});
const port = Number.parseInt(process.env.PORT ?? '3000', 10);

app.listen(port, () => {
  console.log(`Link Saver is running at http://localhost:${port}`);
});
