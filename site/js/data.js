/* Tiny data loader.
 * Data files are plain scripts (data/<key>.js) that call window.DT.set("<key>", {...}),
 * so the page works from a static host *and* when index.html is opened from disk (file://),
 * where fetch() / ES modules are blocked by the browser.
 */
(function () {
  'use strict';
  const store = {};
  const waiting = {};

  window.DT = {
    version: '',
    set(key, value) {
      store[key] = value;
      (waiting[key] || []).forEach(w => w.resolve(value));
      delete waiting[key];
    },
    get(key) { return store[key]; },
    load(key) {
      if (key in store) return Promise.resolve(store[key]);
      return new Promise((resolve, reject) => {
        const list = (waiting[key] = waiting[key] || []);
        list.push({ resolve, reject });
        if (list.length > 1) return;                       // already being fetched
        const s = document.createElement('script');
        s.src = `data/${key}.js${window.DT.version ? '?v=' + window.DT.version : ''}`;
        s.onerror = () => {
          const l = waiting[key] || [];
          delete waiting[key];
          l.forEach(w => w.reject(new Error(`Could not load data/${key}.js`)));
        };
        document.head.appendChild(s);
      });
    },
  };
})();
