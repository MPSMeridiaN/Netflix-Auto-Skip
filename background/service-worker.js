/**
 * Netflix Auto Skip - Background Service Worker (Manifest V3)
 * Initializes the shared storage contract on install and update.
 */

importScripts('../shared/constants.js', '../shared/storage.js');

const storage = globalThis.NetflixAutoSkipStorage.createStorage(chrome);

async function initializeStorage() {
  await storage.initializeSettings();
  await storage.initializeStats();
}

chrome.runtime.onInstalled.addListener(() => {
  void initializeStorage();
});
