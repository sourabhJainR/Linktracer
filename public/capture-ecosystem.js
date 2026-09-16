const runtimeLocation = typeof location !== 'undefined' ? location : { origin: '', search: '' };
const DEFAULT_ENDPOINT = runtimeLocation.origin ? `${runtimeLocation.origin}/` : '';

function safeValue(value) {
  return String(value || '').trim().slice(0, 4000);
}

function extractSharedUrl(text) {
  const match = safeValue(text).match(/https?:\/\/[^\s<>'"`]+/i);
  return match ? match[0].replace(/[),.;!?]+$/, '') : '';
}

function queryCapture(search = runtimeLocation.search) {
  const params = new URLSearchParams(search || '');
  const text = safeValue(params.get('text'));
  const url = safeValue(params.get('url')) || extractSharedUrl(text);
  const title = safeValue(params.get('title'));
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
  workspace?.classList.add('smartPanelOpen');
  workspace?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  url.focus();
  url.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}

function bookmarkletCode(origin = runtimeLocation.origin) {
  const target = `${origin}/`;
  const script = `const u=location.href,t=document.title,s=(window.getSelection&&String(window.getSelection()))||'';location.href=${JSON.stringify(target)}+'?url='+encodeURIComponent(u)+'&title='+encodeURIComponent(t)+'&text='+encodeURIComponent(s.slice(0,4000))`;
  return `javascript:(()=>{${script}})()`;
}

function installStyles() {
  if (document.querySelector('#captureEcosystemStyles')) return;
  const style = document.createElement('style');
  style.id = 'captureEcosystemStyles';
  style.textContent = `.captureTools{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:12px}.captureTool{display:flex;flex-direction:column;gap:7px;padding:14px;border:1px solid var(--line,#e2e8f0);border-radius:14px;background:rgba(248,250,252,.72);font-size:12px}.captureTool strong{font-size:13px}.captureTool span{color:var(--muted,#64748b);line-height:1.5}.captureTool a{color:#4338ca;font-weight:700;text-decoration:none}.captureBookmarklet{display:inline-flex;width:max-content;padding:7px 10px;border-radius:9px;background:#eef2ff;color:#3730a3!important}.captureTool button{width:max-content}.captureTool code{font-size:11px}@media(max-width:820px){.captureTools{grid-template-columns:1fr 1fr}}@media(max-width:560px){.captureTools{grid-template-columns:1fr}}`;
  document.head.appendChild(style);
}

function render() {
  const host = document.querySelector('#captureEcosystem');
  if (!host) return;
  installStyles();
  const href = bookmarkletCode().replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  host.innerHTML = `
    <div class="captureTools">
      <div class="captureTool">
        <strong>Share to Linktracer</strong>
        <span>On a phone or desktop, use the PWA from your browser's Share menu. Linktracer opens the capture form with the shared URL and context.</span>
      </div>
      <div class="captureTool">
        <strong>Bookmarklet</strong>
        <span>Drag the button below to your browser bookmarks bar. It captures the current page without an extension.</span>
        <a class="captureBookmarklet" href="${href}">Save to Linktracer</a>
        <button id="copyBookmarklet" type="button" class="subtle">Copy bookmarklet</button>
        <span id="bookmarkletStatus" class="hint" role="status" aria-live="polite"></span>
      </div>
      <div class="captureTool">
        <strong>Chromium extension</strong>
        <span>For a toolbar workflow, use <code>extensions/chromium</code> from the repository and set your Linktracer address once.</span>
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
  const params = new URLSearchParams(runtimeLocation.search);
  if (!params.has('url') && !params.has('title') && !params.has('text')) return;
  params.delete('url');
  params.delete('title');
  params.delete('text');
  const next = `${runtimeLocation.pathname || '/'}${params.toString() ? `?${params}` : ''}${runtimeLocation.hash || ''}`;
  history.replaceState({}, '', next);
}

function init() {
  render();
  const capture = queryCapture();
  if (fillCaptureForm(capture)) cleanQuery();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
}

export { bookmarkletCode, extractSharedUrl, fillCaptureForm, queryCapture, DEFAULT_ENDPOINT };
