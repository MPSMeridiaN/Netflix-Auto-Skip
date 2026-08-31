# Architecture & Technical Design

Netflix Auto Skip is a small Manifest V3 extension. The browser content
script is a bootstrap over a production engine that owns all playback DOM
work, while the popup and service worker use the same storage service.

## Runtime layout

```text
shared/constants.js          Defaults, action types, cooldowns
shared/storage.js             Settings fallback and local statistics
content/engine.js             Playback detection, selectors, state, lifecycle
content/content.js            Browser-only engine bootstrap
popup/popup.js                Settings and statistics UI
background/service-worker.js  Install/update storage initialization
```

`content/engine.js` is dependency-injected at its browser boundary. This lets
the QA suite run the same selector, guard, state, and action code against DOM
fixtures without rebuilding the implementation in tests.

## Route and playback scope

The engine accepts only an exact `/watch` route (`/watch` or `/watch/<id>`),
not a broad pathname prefix. It then requires a visible video inside a
recognized Netflix player context such as `.watch-video` or a player
`data-uia` container. A video elsewhere on a catalog page, including a
preview/autoplay video, is not playback evidence.

While the exact watch route exists but the player has not mounted, a small
route-gated activation observer waits for the player-root video. It performs
no selector scan and does not start polling. Once playback evidence exists,
the engine observes the player root and starts a 1-second fallback poll.
Mutation work is batched with `requestAnimationFrame`.

## Selector and guard order

1. Explicit Netflix `data-uia` and player selectors are tried first.
2. Candidates must be connected, visible, enabled, and outside ignored UI
   regions.
3. Generic text matching is a last resort. Intro/recap text must be inside a
   player context; next-episode text must be inside post-play context.
4. Credit actions require valid media metadata, must not run during the first
   45 seconds, and require either near-end playback or post-play context.
5. Intro and recap actions are blocked after 60% playback progress.

Ignored regions include the bottom control bar, episode/season drawers,
audio/subtitle menus, and known non-action post-play controls such as Watch
Credits and Back to Browse. Every click uses one native `element.click()`.

## Episode lifecycle

The canonical route identity (`watch:<route-id>`) is the episode key. The
episode title is not part of the key because React can mount, unmount, or
temporarily change title DOM during a render. One-shot intro, recap, and
credits locks reset only when the canonical route changes or playback leaves
the watch route. Prompt actions use a 4-second cooldown instead of a
per-episode lock.

`pushState`, `replaceState`, `popstate`, and `hashchange` all enter the same
navigation handler. Autoplay transitions are also caught by the regular
mutation/media hooks and fallback poll. A route transition cancels the old
action lock so the next episode can start immediately, while a lifecycle
token prevents an in-flight action from clicking stale DOM.

## Ownership and teardown

Each engine instance owns:

- its singleton window slot and termination event listener;
- history wrappers, restored only when the wrapper is still the active owner;
- navigation, storage, DOM-ready, and media event listeners;
- activation/playback observers and polling interval;
- scheduled animation frames, action-lock timers, and toast timers.

Starting a new instance synchronously stops the previous instance. Stopping
an instance is idempotent, removes all owned resources, removes its HUD, and
does not overwrite a newer instance's globals. Every storage/observer callback
checks both extension-context validity and instance ownership.

## Storage contract

`shared/storage.js` is the only storage implementation used by the runtime:

- Settings are read/written in `chrome.storage.sync` when available.
- If sync is unavailable or fails, settings use `chrome.storage.local`.
- A small local fallback patch is migrated back to sync when sync becomes
  available again, preventing stale sync values from silently winning.
- Statistics are written only to `chrome.storage.local`, normalized to
  non-negative integers, and incremented through a serialized queue.
- Install/update initialization merges defaults without overwriting valid
  user values. Storage and quota failures are contained and do not interrupt
  playback actions.

Actions await the local statistics write before dispatching the native click,
so immediate Netflix navigation cannot discard the write. The click remains
best effort if storage is unavailable.

## Permissions and network behavior

The manifest requests only `storage` and matches only
`https://www.netflix.com/*`. The extension has no telemetry, analytics,
remote backend, or extension-initiated external network requests. Settings
may be synchronized by the browser profile; statistics remain local.
