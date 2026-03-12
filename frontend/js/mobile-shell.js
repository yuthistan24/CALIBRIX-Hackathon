function updateAppHeight() {
  document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
}

function applyMobileMeta() {
  const manifestHref = '/manifest.webmanifest';
  if (!document.querySelector('link[rel="manifest"]')) {
    const manifest = document.createElement('link');
    manifest.rel = 'manifest';
    manifest.href = manifestHref;
    document.head.appendChild(manifest);
  }

  if (!document.querySelector('meta[name="theme-color"]')) {
    const themeColor = document.createElement('meta');
    themeColor.name = 'theme-color';
    themeColor.content = '#020617';
    document.head.appendChild(themeColor);
  }
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', async () => {
    try {
      await navigator.serviceWorker.register('/service-worker.js');
    } catch (_error) {
      // Keep the app usable even when service worker registration fails.
    }
  });
}

function applyDisplayModeClass() {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  document.documentElement.classList.toggle('is-standalone', Boolean(isStandalone));
}

applyMobileMeta();
applyDisplayModeClass();
updateAppHeight();
registerServiceWorker();

window.addEventListener('resize', updateAppHeight);
