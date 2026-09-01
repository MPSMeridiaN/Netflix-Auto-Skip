/**
 * Netflix Auto Skip - browser bootstrap.
 * The engine is loaded immediately before this file by manifest.json.
 */
(() => {
  'use strict';

  if (
    typeof globalThis.NetflixAutoSkipEngine === 'undefined' ||
    typeof globalThis.NetflixAutoSkipEngine.createController !== 'function'
  ) {
    return;
  }

  const controller = globalThis.NetflixAutoSkipEngine.createController();
  const START_RETRY_DELAY_MS = 1000;
  const MAX_START_ATTEMPTS = 15;
  let startAttempts = 0;

  function scheduleStartRetry() {
    if (
      startAttempts >= MAX_START_ATTEMPTS ||
      typeof window === 'undefined' ||
      typeof window.setTimeout !== 'function'
    ) return;
    window.setTimeout(attemptStart, START_RETRY_DELAY_MS);
  }

  function attemptStart() {
    startAttempts += 1;
    Promise.resolve(controller.start()).then(() => {
      if (!controller.getDiagnostics().started) scheduleStartRetry();
    }).catch(() => {
      scheduleStartRetry();
    });
  }

  // Vivaldi can restore a Netflix tab before the extension context is ready.
  // Retry only the initial bootstrap; a later context invalidation is still
  // intentionally torn down by the engine and must not create a timer loop.
  attemptStart();
})();
