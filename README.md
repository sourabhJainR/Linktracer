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
- Extract page title, description, hostname, final URL and readable source context when the laptop can reach the source URL.
- Classify captured pages into deterministic types such as article, code, documentation, paper, video, social, product or webpage.
- Generate deterministic suggested tags locally and on the server.
- Retry source enrichment after reconnect for links saved while offline.
- Search locally with free-text terms plus smart filters such as `tag:ai`, `type:article`, `domain:github.com`, `health:broken`, `duplicate:true`, `before:2026-09-01` and `after:2026-08-01`.
- Detect likely duplicates using normalized title and hostname in addition to exact canonical URL de-duplication.
- Check link health on demand and record HTTP status, final URL, response time and last-check time.
- Show library health counts for total links, possible duplicates, broken/unreachable links and unchecked links.
- Use a monotonic server change cursor instead of wall-clock timestamps, avoiding missed updates when devices have clock skew or multiple changes share a timestamp.
- Acknowledge individual outbox operations; rejected operations remain queued instead of being silently discarded.
- Trigger background sync where the browser supports the Background Sync API.
- Export and import a portable JSON backup directly from the browser.
- Install as a PWA on a phone or desktop.
- No external cloud database is required.

## Personal knowledge system

Linktracer goes beyond bookmark storage by preserving the context around why a link matters:

- **Saved Reader Mode:** retain a readable source excerpt locally so saved research remains useful when the original site is unavailable.
- **Highlights:** save important passages with an optional note.
- **Annotations:** attach private notes to a source without changing the original content.
- **Smart Collections:** persist any search expression as a reusable view.
- **Knowledge Radar:** a local intelligence layer that surfaces recurring topics, rediscovery candidates and evidence strength.
- **Deterministic knowledge connections:** links are related using tag overlap, title concepts and domain affinity. No cloud AI or API key is required.
- **Evidence scoring:** sources receive a transparent score based on captured source context, metadata, health, tags, highlights and annotations rather than an opaque model score.
- **Rediscovery signals:** older or less recently viewed material is surfaced so valuable research does not disappear into the archive.
- **Knowledge bundles:** export a focused Markdown bundle containing a source, its context, tags and related saved material.

The goal is a different interaction model from ordinary bookmark managers: **capture once, preserve context, connect what you already know, and rediscover it later.**

## Stage 1 search and intelligence

The application remains local-first: filtering and duplicate detection work against the IndexedDB copy even when the server is unavailable. Search syntax is intentionally simple:

```text
architecture tag:ai type:article
 domain:github.com health:healthy
 duplicate:true after:2026-08-01
```

The content classifier is deterministic and dependency-free. It uses URL/domain, title and extracted text signals, so classification does not require an AI provider. Link health checks are explicit user actions rather than a background crawler, keeping LAN traffic and external requests predictable.

## Design ideas adopted from open-source projects

Linktracer intentionally stays small, but its architecture follows proven patterns from local-first and bookmark-management projects. The moat is in combining these ideas around a no-cloud, offline-first knowledge workflow rather than copying a hosted bookmark product.

- **Local-first + durable mutation queue:** IndexedDB is the first write target and synchronization is asynchronous.
- **Stable operation IDs and deterministic convergence:** each queued mutation has a client-generated `changeId`; the server acknowledges individual operations and merges fields instead of treating a device as the source of truth.
- **Monotonic sync cursor:** SQLite sequence numbers prevent clock-skew sync gaps.
- **Automatic metadata extraction and tagging:** enrichment is helpful but never blocks capture.
- **Preservation and library health:** readable context, duplicate detection and health checks make the saved library more trustworthy.
- **Knowledge graph signals without a graph database:** relationships are derived locally from tags, concepts and domains, keeping deployment simple.

Recent open-source systems reinforce the value of this direction: Karakeep combines full-text search, local-model tagging, summaries, highlights and archival; Linklore combines SQLite with hybrid retrieval and private RAG; and local-first knowledge-graph projects expose relationships and agent access without requiring a hosted service.

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

This application is intended for a trusted home/private LAN. It does not provide authentication. Do not expose port 8787 directly to the public internet without adding authentication, HTTPS and appropriate request/URL-fetch protections. In particular, the metadata enrichment and link-health endpoints fetch supplied URLs from the laptop.
