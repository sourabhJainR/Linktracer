const DEFAULT_ENDPOINT = `${location.origin}/`;

function safeValue(value) {
  return String(value || '').trim().slice(0, 4000);
}

function queryCapture() {
  const params = new URLSearchParams(location.search);
  const url = safeValue(params.get('url'));
  const title = safeValue(params.get('title'));
  const text = safeValue(params.get('text'));
  return { url, title, text };
}

function fillCaptureForm(capture) {
  if (!capture.url) return false;
  const url = document.querySelector('#url');
  const title = document.querySelector('#title');
  const description = document.querySelector('#description');
  const workspace = document.querySelector('#captureWorkspace');
  if (!url) return false;
  url.value = capture.url;
  if (title && capture.title) title.value = capture.title;
  if (description && capture.text) description.value = capture.text;
  workspace?.removeAttribute('hidden');
  workspace?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  url.focus();
  url.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}

function bookmarkletCode() {
  const target = `${location.origin}/`;
  const script = `const u=location.href,t=document.title,s=(window.getSelection&&String(window.getSelection()))||'';location.href=${JSON.stringify(target)}+'?url='+encodeURIComponent(u)+'&title='+encodeURIComponent(t)+'&text='+encodeURIComponent(s.slice(0,4000))`;
  return `javascript:(()=>{${script}})()`;
}

function render() {
  const host = document.querySelector('#captureEcosystem');
  if (!host) return;
  host.innerHTML = `
    <div class="captureTools">
      <div class="captureTool">
        <strong>Share to Linktracer</strong>
        <span>On a phone or desktop, use the PWA from your browser's Share menu. Linktracer opens the capture form with the shared URL and context.</span>
      </div>
      <div class="captureTool">
        <strong>Bookmarklet</strong>
        <span>Drag the button below to your browser bookmarks bar. It captures the current page without an extension.</span>
        <a class="captureBookmarklet" href="${bookmarkletCode().replace(/"/g, '&quot;')}">Save to Linktracer</a>
        <button id="copyBookmarklet" type="button" class="subtle">Copy bookmarklet</button>
        <span id="bookmarkletStatus" class="hint" role="status" aria-live="polite"></span>
      </div>
      <div class="captureTool">
        <strong>Chromium extension</strong>
        <span>For a toolbar and context-menu workflow, use <code>extensions/chromium</code> from the repository and set your Linktracer address once.</span>
        <a href="https://github.com/sourabhJainR/Linktracer/tree/main/extensions/chromium" target="_blank" rel="noreferrer">Extension instructions</a>
      </div>
    </div>`;
  document.querySelector('#copyBookmarklet')?.addEventListener('click', async () => {
    const status = document.querySelector('#bookmarkletStatus');
    try {
      await navigator.clipboard.writeText(bookmarkletCode());
      if (status) status.textContent = 'Bookmarklet copied.';
    } catch {
      if (status) status.textContent = 'Copy failed; drag the bookmarklet button instead.';
    }
  });
}

function cleanQuery() {
  const params = new URLSearchParams(location.search);
  if (!params.has('url') && !params.has('title') && !params.has('text')) return;
  params.delete('url');
  params.delete('title');
  params.delete('text');
  const next = `${location.pathname}${params.toString() ? `?${params}` : ''}${location.hash}`;
  history.replaceState({}, '', next);
}

function init() {
  render();
  const capture = queryCapture();
  if (fillCaptureForm(capture)) cleanQuery();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();

export { bookmarkletCode, fillCaptureForm, queryCapture, DEFAULT_ENDPOINT };
