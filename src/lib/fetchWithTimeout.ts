/**
 * A hardened fetch wrapper that enforces a strict timeout (default 15s) on HTTP requests.
 * This guarantees that requests resolve or reject, preventing the "Sleep Coma" infinite pending state
 * caused by dropped TCP sockets when the app is backgrounded.
 *
 * Supports AbortSignal.timeout() for modern browsers and falls back to a manual AbortController
 * for older WebViews / Capacitor environments.
 */

// Diagnostic counter to track requests
let requestIdCounter = 0;

export const fetchWithTimeout = (url: RequestInfo | URL, options?: RequestInit, timeoutMs: number = 15000) => {
  const reqId = `req_${++requestIdCounter}`;
  const urlStr = url.toString();

  console.log(`[Diagnostic] [${reqId}] fetchWithTimeout START: ${urlStr}`);

  // Combine an existing signal (if any) with our timeout signal
  const existingSignal = options?.signal;

  if (existingSignal) {
      console.log(`[Diagnostic] [${reqId}] existingSignal present. aborted pre-flight: ${existingSignal.aborted}`);
  }

  let timeoutSignal: AbortSignal;
  if (typeof AbortSignal.timeout === 'function') {
      timeoutSignal = AbortSignal.timeout(timeoutMs);
  } else {
      const controller = new AbortController();
      setTimeout(() => {
          console.log(`[Diagnostic] [${reqId}] manual timeout fired after ${timeoutMs}ms`);
          controller.abort(new Error('TimeoutError'));
      }, timeoutMs);
      timeoutSignal = controller.signal;
  }

  // If there's an existing signal, we must abort if either fires
  let finalSignal = timeoutSignal;
  if (existingSignal) {
      if (typeof AbortSignal.any === 'function') {
          finalSignal = AbortSignal.any([existingSignal, timeoutSignal]);
      } else {
          // Manual fallback if AbortSignal.any is missing (unlikely if .timeout exists, but safe)
          const combinedController = new AbortController();

          const onAbort = () => {
             console.log(`[Diagnostic] [${reqId}] combinedController onAbort triggered. existing: ${existingSignal.aborted}, timeout: ${timeoutSignal.aborted}`);
             combinedController.abort();
          }
          existingSignal.addEventListener('abort', onAbort);
          timeoutSignal.addEventListener('abort', onAbort);

          if (existingSignal.aborted || timeoutSignal.aborted) {
              console.log(`[Diagnostic] [${reqId}] Pre-aborted before listener attach. existing: ${existingSignal?.aborted}, timeout: ${timeoutSignal.aborted}`);
              combinedController.abort();
          }
          finalSignal = combinedController.signal;
      }
  }

  console.log(`[Diagnostic] [${reqId}] calling native fetch. finalSignal aborted pre-flight: ${finalSignal.aborted}`);

  return fetch(url, { ...options, signal: finalSignal })
    .then(res => {
        console.log(`[Diagnostic] [${reqId}] fetch RESOLVED with status ${res.status}`);
        return res;
    })
    .catch(err => {
        console.log(`[Diagnostic] [${reqId}] fetch REJECTED. Error: ${err.message}, finalSignal.aborted: ${finalSignal.aborted}`);
        throw err;
    });
};
