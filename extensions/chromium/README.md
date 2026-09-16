# Linktracer Capture for Chromium

This small Manifest V3 extension sends the active HTTP/HTTPS tab to the Linktracer capture form.

## Install

1. Open `chrome://extensions` or `edge://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select this `extensions/chromium` directory.
5. Open the extension and set the Linktracer address, for example `http://localhost:8787/` or your LAN URL.

The address is stored only in the browser extension's local storage. The extension does not send page data to any third-party service.

## Capture

Open a page, click the extension, then choose **Save current page**. Linktracer opens the capture form with the page URL and title prefilled so the normal local-first save and sync flow remains unchanged.
