export const initNativeFetchDiagnostic = () => {
    const originalFetch = window.fetch;

    // Counter for raw fetch tracking
    let rawFetchId = 0;

    window.fetch = async function(...args) {
        const id = ++rawFetchId;
        const [resource, config] = args;
        const urlStr = typeof resource === 'string' ? resource : ('url' in resource ? resource.url : resource.toString());

        console.log(`[Diagnostic-NativeFetch] [RawID_${id}] START: ${urlStr}`);

        try {
            const response = await originalFetch.apply(this, args);
            console.log(`[Diagnostic-NativeFetch] [RawID_${id}] RESOLVED: ${response.status}`);
            return response;
        } catch (error: any) {
            console.log(`[Diagnostic-NativeFetch] [RawID_${id}] REJECTED: ${error.message}`);
            throw error;
        }
    };

    console.log('[Diagnostic-NativeFetch] globalThis.fetch successfully monkey-patched.');
};
