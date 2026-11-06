/* Public Firebase web identifiers. No server credentials belong in this file. */
(() => {
  if (window.gostoreFirebaseReady) return;
  if (["localhost", "127.0.0.1"].includes(location.hostname) && !window.__GOSTORE_FIREBASE_TEST__) { window.gostoreFirebaseReady = Promise.resolve(false); return; }
  window.gostoreFirebaseReady = new Promise(resolve => {
    const start = () => setTimeout(async () => {
      try {
        const [{ initializeApp, getApps }, { initializeAnalytics, isSupported, logEvent }] = await Promise.all([
          import('https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js'),
          import('https://www.gstatic.com/firebasejs/13.2.0/firebase-analytics.js')
        ]);
        if (!(await isSupported())) return resolve(false);
        const config = {
          apiKey: 'AIzaSyDsxJTDTydcHlBPMgLE7DtzT8HgMZOpj1U',
          authDomain: 'gostore-27172.firebaseapp.com', projectId: 'gostore-27172',
          storageBucket: 'gostore-27172.firebasestorage.app', messagingSenderId: '428447938231',
          appId: '1:428447938231:web:10eca85dc14a7696bfff32', measurementId: 'G-44TMZT4X1E'
        };
        const app = getApps().find(a => a.name === 'gostore-web') || initializeApp(config, 'gostore-web');
        // Existing GA remains a separate property. This stream gets exactly one explicit page view.
        const analytics = initializeAnalytics(app, { config: { send_page_view: false } });
        logEvent(analytics, 'page_view', { page_location: location.origin + location.pathname, page_title: document.title });
        resolve(true);
      } catch { resolve(false); } // Analytics must never interrupt shopping or login.
    }, 1200);
    if (document.readyState === 'complete') start(); else addEventListener('load', start, { once: true });
  });
})();
