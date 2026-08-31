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
  void controller.start();
})();
