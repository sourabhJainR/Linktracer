const endpointInput = document.querySelector('#endpoint');
const status = document.querySelector('#status');

function cleanEndpoint(value) {
  const url = new URL(value || 'http://localhost:8787/');
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Use an HTTP or HTTPS Linktracer address.');
  return `${url.origin}/`;
}

async function init() {
  const stored = await chrome.storage.local.get({ endpoint: 'http://localhost:8787/' });
  endpointInput.value = stored.endpoint;
}

document.querySelector('#save').addEventListener('click', async () => {
  try {
    const endpoint = cleanEndpoint(endpointInput.value);
    await chrome.storage.local.set({ endpoint });
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url || !/^https?:/i.test(tab.url)) throw new Error('The active tab is not an HTTP/HTTPS page.');
    const target = new URL(endpoint);
    target.searchParams.set('url', tab.url);
    if (tab.title) target.searchParams.set('title', tab.title);
    window.open(target.toString(), '_blank');
    status.textContent = 'Capture form opened in Linktracer.';
  } catch (error) {
    status.textContent = error.message || 'Capture failed.';
  }
});

init().catch(() => { status.textContent = 'Could not load extension settings.'; });
