export const initSWDiagnostics = () => {
    if (!('serviceWorker' in navigator)) return;

    console.log('[Diagnostic-SW] Service Worker is supported.');

    navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log(`[Diagnostic-SW] controllerchange fired! New controller:`, navigator.serviceWorker.controller?.scriptURL);
    });

    navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('[Diagnostic-SW] Message received from SW:', event.data);
    });

    navigator.serviceWorker.ready.then((registration) => {
        console.log('[Diagnostic-SW] SW Registration Ready. Active script:', registration.active?.scriptURL);

        registration.addEventListener('updatefound', () => {
            console.log('[Diagnostic-SW] updatefound fired. Installing new worker:', registration.installing?.scriptURL);

            const newWorker = registration.installing;
            if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                    console.log(`[Diagnostic-SW] New worker state changed to: ${newWorker.state}`);
                });
            }
        });
    });
};
