let swRegistration: ServiceWorkerRegistration | null = null;

export async function registerSW(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.log('Service workers not supported');
    return null;
  }

  try {
    const swPath = `${import.meta.env.BASE_URL || '/'}sw.js`;
    const registration = await navigator.serviceWorker.register(swPath, {
      scope: '/',
    });

    swRegistration = registration;

    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('New service worker available');
          }
        });
      }
    });

    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'SYNC_TRIGGERED') {
        window.dispatchEvent(new CustomEvent('sw-sync-triggered'));
      }
    });

    console.log('Service worker registered');
    return registration;
  } catch (error) {
    console.error('Service worker registration failed:', error);
    return null;
  }
}

export async function triggerSync(): Promise<boolean> {
  if (!swRegistration) {
    return false;
  }

  if ('sync' in swRegistration) {
    try {
      await (swRegistration as any).sync.register('jobrunner-sync');
      return true;
    } catch (error) {
      console.error('Background sync registration failed:', error);
    }
  }

  if (swRegistration.active) {
    swRegistration.active.postMessage('SYNC_NOW');
    return true;
  }

  return false;
}

export async function checkForUpdate(): Promise<boolean> {
  if (!swRegistration) {
    return false;
  }

  try {
    await swRegistration.update();
    return swRegistration.waiting !== null;
  } catch (error) {
    console.error('Service worker update check failed:', error);
    return false;
  }
}

export function skipWaiting(): void {
  if (swRegistration?.waiting) {
    swRegistration.waiting.postMessage('SKIP_WAITING');
  }
}

export function getRegistration(): ServiceWorkerRegistration | null {
  return swRegistration;
}
