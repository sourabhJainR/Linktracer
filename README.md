# Linktracer

Linktracer is an offline-first personal link library designed to run on a laptop and be reachable by phones, tablets and other computers on the same LAN.

## What it does

- Capture URLs with a description and manual tags.
- Normalize URLs so tracking parameters do not create duplicate entries.
- Store everything locally in the browser using IndexedDB.
- Continue working when the laptop/server or internet is unavailable after the app has been opened once.
- Queue every local change in a durable outbox and retry automatically.
- Merge the same link captured or edited on different devices instead of overwriting data.
- Union tags across devices.
- Preserve distinct descriptions from different devices and de-duplicate identical descriptions.
- Extract page title, description and hostname when the laptop can reach the source URL.
- Generate deterministic suggested tags locally and on the server.
- Retry source enrichment after reconnect for links saved while offline.
- Use a monotonic server change cursor instead of wall-clock timestamps, avoiding missed updates when devices have clock skew or multiple changes share a timestamp.
- Acknowledge individual outbox operations; rejected operations remain queued instead of being silently discarded.
- Trigger background sync where the browser supports the Background Sync API.
- Export and import a portable JSON backup directly from the browser.
- Install as a PWA on a phone or desktop.
- No external cloud database is required.

## Design ideas adopted from open-source projects

Linktracer intentionally stays small, but its architecture follows proven patterns from local-first and bookmark-management projects:

- **Local-first + durable mutation queue:** the UI writes to IndexedDB first, then syncs in the background. This follows the local-first architecture described by the open-source offline-first PWA/CRDT reference project.
- **Stable operation IDs and deterministic convergence:** every queued mutation has a client-generated `changeId`; the server acknowledges individual operations and merges fields instead of treating a device as the source of truth.
- **Monotonic sync cursor:** server changes are tracked with a SQLite sequence so synchronization does not depend on client clocks.
- **Automatic metadata extraction and tagging:** inspired by Karakeep/Hoarder's automatic title, description and AI-tagging workflow, Linktracer enriches saved URLs without making enrichment a prerequisite for saving.
- **Preservation mindset:** inspired by Linkwarden's focus on link rot and content preservation, the next natural extension is optional page snapshots/readable copies. The current release deliberately keeps the core storage lightweight.

References: [Karakeep/Hoarder](https://github.com/karakeep/hoarder), [Linkwarden](https://github.com/linkwarden/linkwarden), and [offline-first-pwa-crdt-sync](https://github.com/alihamzazaka/offline-first-pwa-crdt-sync).

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

For the best mobile experience, open the LAN URL once while the laptop is available and install/add Linktracer to the home screen. The service worker caches the application shell and IndexedDB keeps captured links available offline.

## Offline and sync model

The browser is the first local store. The server is the shared LAN store.

Every device has a stable random device ID. A save is written to IndexedDB before any network operation. A copy is also placed in an outbox. Sync sends the outbox to the laptop and then pulls server changes using a monotonic cursor.

For the same canonical URL:

- Tags are set-unioned.
- Descriptions are appended and de-duplicated case-insensitively.
- Existing useful titles are retained when a new capture has no title.
- Source context is merged.
- Repeating a sync is safe because operations have stable IDs and merged descriptions/tags are de-duplicated.
- Invalid operations are reported individually and remain in the local outbox for retry or inspection.

This is deliberately a field-level merge rather than last-write-wins. If phone A adds `architecture` and phone B adds `design`, both survive. If A writes one description and B writes another, both survive. This is the important no-information-loss property for Linktracer's core use case.

## Backup and restore

Use **Export** from the application to create a JSON backup of the browser's local link library. **Import** merges the backup into the local store and queues the imported records for synchronization. This provides a second recovery path in addition to the SQLite server database.

## Important offline limitation

A device must load the application at least once while the laptop is reachable so that the PWA shell is cached. After that, capture and search work without the laptop. Source-page enrichment happens when the laptop/server becomes reachable again.

## Data

Server data is stored in `data/linktracer.db` using SQLite. SQLite WAL mode is enabled for better concurrent read/write behavior on the LAN. The database directory is created automatically and should be backed up if the saved links are important.

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

This application is intended for a trusted home/private LAN. It does not provide authentication. Do not expose port 8787 directly to the public internet without adding authentication, HTTPS and appropriate request/URL-fetch protections. In particular, the metadata enrichment endpoint fetches the supplied URL from the laptop.
