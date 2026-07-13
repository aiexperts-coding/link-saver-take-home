const form = document.querySelector('#link-form');
const urlInput = document.querySelector('#url');
const submitButton = document.querySelector('#save-button');
const status = document.querySelector('#status');
const count = document.querySelector('#link-count');
const emptyState = document.querySelector('#empty-state');
const list = document.querySelector('#link-list');
const template = document.querySelector('#link-template');

let links = [];

function setStatus(message, type = '') {
  status.textContent = message;
  status.dataset.type = type;
}

function formatSavedAt(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function render() {
  list.replaceChildren();
  count.textContent = `${links.length} saved ${links.length === 1 ? 'link' : 'links'}`;
  emptyState.hidden = links.length !== 0;

  for (const link of links) {
    const row = template.content.firstElementChild.cloneNode(true);
    const anchor = row.querySelector('.link-title');

    anchor.textContent = link.title;
    anchor.href = link.url;
    row.querySelector('.link-url').textContent = link.url;
    row.querySelector('.link-date').textContent = `Saved ${formatSavedAt(link.savedAt)}`;
    row.querySelector('.delete-button').addEventListener('click', (event) => {
      removeLink(link.id, event.currentTarget);
    });

    list.append(row);
  }
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const body = response.status === 204 ? null : await response.json();

  if (!response.ok) {
    throw new Error(body?.error?.message ?? 'The request failed.');
  }

  return body;
}

async function loadLinks() {
  try {
    links = await requestJson('/api/links');
    render();
  } catch (error) {
    setStatus(error.message, 'error');
  }
}

async function removeLink(id, button) {
  button.disabled = true;

  try {
    await requestJson(`/api/links/${id}`, { method: 'DELETE' });
    links = links.filter((link) => link.id !== id);
    render();
    setStatus('Link deleted.', 'success');
  } catch (error) {
    button.disabled = false;
    setStatus(error.message, 'error');
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  submitButton.disabled = true;
  setStatus('Fetching the page title…');

  try {
    const link = await requestJson('/api/links', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: urlInput.value }),
    });

    links = [link, ...links];
    form.reset();
    render();
    setStatus('Link saved.', 'success');
    urlInput.focus();
  } catch (error) {
    setStatus(error.message, 'error');
  } finally {
    submitButton.disabled = false;
  }
});

loadLinks();
