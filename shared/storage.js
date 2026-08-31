/**
 * Shared storage service.
 *
 * Settings use sync storage when it is available and writable, with local
 * storage as a fallback. Statistics are local-only by design. The service
 * serializes increments within a context so rapid DOM events cannot lose
 * updates, while keeping storage ownership in one small module.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./constants.js'));
  } else {
    root.NetflixAutoSkipStorage = factory(root.NetflixAutoSkipConstants);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (constants) {
  if (!constants) {
    throw new Error('Netflix Auto Skip constants must load before storage service');
  }

  const {
    DEFAULT_SETTINGS,
    DEFAULT_STATS,
    SETTING_KEYS,
    STAT_KEYS
  } = constants;
  const SETTINGS_FALLBACK_KEY = '__netflixAutoSkipSettingsFallback';

  function cloneDefaults(defaults) {
    return { ...defaults };
  }

  function normalizeSettings(values) {
    const normalized = cloneDefaults(DEFAULT_SETTINGS);
    if (!values || typeof values !== 'object') return normalized;

    for (const key of SETTING_KEYS) {
      if (typeof values[key] === 'boolean') {
        normalized[key] = values[key];
      }
    }
    return normalized;
  }

  function normalizeStats(values) {
    const normalized = cloneDefaults(DEFAULT_STATS);
    if (!values || typeof values !== 'object') return normalized;

    for (const key of STAT_KEYS) {
      const value = Number(values[key]);
      if (Number.isFinite(value) && value >= 0) {
        normalized[key] = Math.floor(value);
      }
    }
    return normalized;
  }

  function createStorage(chromeApi) {
    const storageApi = chromeApi && chromeApi.storage;
    let statsQueue = Promise.resolve();

    async function read(area, defaults) {
      if (!area || typeof area.get !== 'function') return null;
      try {
        return await area.get(defaults);
      } catch {
        return null;
      }
    }

    async function write(area, values) {
      if (!area || typeof area.set !== 'function') return false;
      try {
        await area.set(values);
        return true;
      } catch {
        return false;
      }
    }

    async function remove(area, keys) {
      if (!area || typeof area.remove !== 'function') return false;
      try {
        await area.remove(keys);
        return true;
      } catch {
        return false;
      }
    }

    async function readFallbackSettings() {
      const values = await read(storageApi && storageApi.local, {
        [SETTINGS_FALLBACK_KEY]: null
      });
      const fallback = values && values[SETTINGS_FALLBACK_KEY];
      return fallback && typeof fallback === 'object' ? fallback : null;
    }

    async function clearFallbackSettings() {
      await remove(storageApi && storageApi.local, SETTINGS_FALLBACK_KEY);
    }

    async function getSettings() {
      const syncValues = await read(storageApi && storageApi.sync, DEFAULT_SETTINGS);
      if (syncValues !== null) {
        // If sync previously failed, local contains the last fallback patch.
        // Prefer that patch until it can be migrated back to sync, otherwise a
        // later successful sync read would silently resurrect stale settings.
        const fallback = await readFallbackSettings();
        if (fallback) {
          const merged = normalizeSettings({ ...syncValues, ...fallback });
          if (await write(storageApi && storageApi.sync, merged)) await clearFallbackSettings();
          return merged;
        }
        return normalizeSettings(syncValues);
      }

      const localValues = await read(storageApi && storageApi.local, DEFAULT_SETTINGS);
      return localValues === null ? cloneDefaults(DEFAULT_SETTINGS) : normalizeSettings(localValues);
    }

    async function setSettings(values) {
      const patch = {};
      if (values && typeof values === 'object') {
        for (const key of SETTING_KEYS) {
          if (typeof values[key] === 'boolean') patch[key] = values[key];
        }
      }
      if (Object.keys(patch).length === 0) return true;

      const fallback = await readFallbackSettings();
      const syncValues = await read(storageApi && storageApi.sync, DEFAULT_SETTINGS);
      if (syncValues !== null) {
        const syncPatch = fallback
          ? normalizeSettings({ ...syncValues, ...fallback, ...patch })
          : patch;
        if (await write(storageApi && storageApi.sync, syncPatch)) {
          await clearFallbackSettings();
          return true;
        }
      } else if (!fallback && await write(storageApi && storageApi.sync, patch)) {
        return true;
      }

      return write(storageApi && storageApi.local, {
        ...patch,
        [SETTINGS_FALLBACK_KEY]: {
          ...(fallback || {}),
          ...patch
        }
      });
    }

    async function initializeSettings() {
      const current = await getSettings();
      if (await write(storageApi && storageApi.sync, current)) {
        await clearFallbackSettings();
        return true;
      }

      const local = storageApi && storageApi.local;
      const localValues = await read(local, DEFAULT_SETTINGS);
      return write(local, localValues === null ? cloneDefaults(DEFAULT_SETTINGS) : normalizeSettings(localValues));
    }

    async function getStats() {
      const values = await read(storageApi && storageApi.local, DEFAULT_STATS);
      return values === null ? cloneDefaults(DEFAULT_STATS) : normalizeStats(values);
    }

    async function setStats(values) {
      return write(storageApi && storageApi.local, normalizeStats(values));
    }

    function incrementStat(skipType) {
      const statKeyByType = {
        intro: 'introsSkipped',
        recap: 'recapsSkipped',
        credits: 'creditsSkipped',
        prompt: 'promptsDismissed'
      };
      const statKey = statKeyByType[skipType];
      if (!statKey || !STAT_KEYS.includes(statKey)) {
        return Promise.resolve(false);
      }

      const task = statsQueue.then(async () => {
        const stats = await getStats();
        stats.totalSkipped += 1;

        stats[statKey] += 1;

        return setStats(stats);
      });

      // Keep the queue usable after a storage failure and never leak a
      // rejected promise into an observer callback.
      statsQueue = task.catch(() => false);
      return task.catch(() => false);
    }

    function resetStats() {
      const task = statsQueue.then(() => setStats(DEFAULT_STATS));
      statsQueue = task.catch(() => false);
      return task.catch(() => false);
    }

    async function initializeStats() {
      const current = await getStats();
      return setStats(current);
    }

    return {
      getSettings,
      setSettings,
      initializeSettings,
      getStats,
      setStats,
      incrementStat,
      resetStats,
      initializeStats,
      normalizeSettings,
      normalizeStats
    };
  }

  return { createStorage, normalizeSettings, normalizeStats };
});
