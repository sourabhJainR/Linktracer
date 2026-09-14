# Linktracer

Linktracer is an offline-first personal link library designed to run on a laptop and be reachable by phones, tablets and other computers on the same LAN.

## What it does

- Capture URLs with a description and manual tags.
- Normalize URLs so tracking parameters do not create duplicate entries.
- Store everything locally in the browser using IndexedDB.
- Continue working when the laptop/server or internet is unavailable.
- Queue every offline change and sync automatically when connectivity returns.
- Merge the same link captured on different devices instead of overwriting data.
- Union tags across devices.
- Preserve distinct descriptions from different devices and show the merged description.
- Extract page title, description and hostname when the laptop can reach the source URL.
- Generate deterministic suggested tags locally and on the server.
- Install as a PWA on a phone or desktop.
- No external cloud database is required.

## Run on the laptop

Requires Node.js 20+.

```bash
npm install
npm start
```

The server listens on all network interfaces at port `8787`.

On the laptop open:

`http://localhost:8787`

Find the laptop's LAN IP and open:

`http://<laptop-ip>:8787`

from another device on the same Wi-Fi/LAN. Allow Node.js through the laptop firewall for private networks if prompted.

For the best mobile experience, open the LAN URL once while the laptop is available and install/add Linktracer to the home screen. The service worker then caches the application shell and IndexedDB keeps captured links available offline.

## Offline and sync model

The browser is the first local store. The server is the shared LAN store.

Every device has a stable random device ID. A save is written to IndexedDB before any network operation. A copy is also placed in an outbox. Sync sends the outbox to the laptop and then pulls newer server records.

For the same canonical URL:

- Tags are set-unioned.
- Descriptions are appended and de-duplicated case-insensitively.
- Existing useful titles are retained when a new capture has no title.
- Source context is merged.
- Repeating a sync is safe because merged descriptions/tags are de-duplicated.

This means an interrupted sync can be retried without deliberately discarding either device's information.

## Important offline limitation

A device must load the application at least once while the laptop is reachable so that the PWA shell is cached. After that, the capture and search experience works without the laptop. Source-page enrichment happens when the laptop/server becomes reachable again.

## Data

Server data is stored in `data/linktracer.db` using SQLite. The database directory is created automatically and should be backed up if the saved links are important.

The server never needs to expose the database directly to clients.

## Useful environment variable

```bash
PORT=8787 npm start
```

## Development

```bash
npm run dev
npm test
```

## Security note

This application is intended for a trusted home/private LAN. It does not provide authentication. Do not expose port 8787 directly to the public internet without adding authentication, HTTPS and appropriate request/URL-fetch protections.
