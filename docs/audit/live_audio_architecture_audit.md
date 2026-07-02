# Phase 3: Live Audio Architecture Audit

## 1. Ephemeral Credentials Feasibility
**Question:** Does Gemini Live API support ephemeral session tokens that would allow browsers to connect directly without exposing permanent API keys?
**Finding:** *No.*
The Gemini Multimodal Live API requires authentication via standard Google Cloud mechanisms:
1. **API Keys** (Permanent, cannot be scoped to a single ephemeral user session easily without complex quota management that attackers could still drain).
2. **OAuth 2.0 / Service Accounts (ADC)**. While you can mint short-lived OAuth tokens via a Service Account, these tokens grant access to the GCP project's Vertex AI / Gemini API scopes globally. Passing an OAuth token to a frontend client would allow an attacker to bypass our MindFlow UI entirely and hit the Gemini API directly using our token until it expires (usually 1 hour).
**Conclusion:** A server-side proxy is **mandatory** to enforce per-user, per-minute quotas and prevent unauthorized usage of our underlying Gemini API credentials.

## 2. Actual Usage Economics
Based on typical metrics for similar AI voice companions:
- **Average Session Duration:** 3-7 minutes.
- **Data Throughput:** 16kHz PCM upload + 24kHz PCM download = ~600 kbps continuously.
- **Compute Impact:** Sustained WebSocket connections require event-loop polling and memory allocation per active connection. Serverless Edge Functions (like Supabase's Deno runtime) aggressively suspend idle executions and enforce hard time limits (e.g., 150 seconds).
**Conclusion:** 10,000 DAU doing one 5-minute session is 50,000 concurrent minutes. This requires a dedicated, stateful Node.js WebSocket cluster.

## 3. Render WebSocket Feasibility
**Platform:** Render Web Services (Free Tier)
- **Idle Timeout:** Render terminates connections after ~15 minutes of zero traffic. *Mitigation:* Audio streams are continuous, so idle timeouts won't trigger during active speaking, but we will enforce a strict 60s idle timeout manually to drop abandoned tabs.
- **Max Duration:** Render does not hard-kill active WebSockets unless the instance deploys or restarts.
- **Cold Starts:** ~30-60s on Free Tier. *Mitigation:* Frontend will show a "Waking up AI" state.

## 4. Reconnect Semantics & Session Recovery
**Question:** Does Gemini preserve conversation state after a WebSocket closure?
**Finding:** *No.* The Gemini Live API WebSocket is strictly bound to its connection lifecycle. If the socket closes, the short-term multimodal context buffer is flushed by Google.
**Mitigation Strategy:**
1. Proxy maintains a 30-second reconnect window for network drops (e.g., WiFi to LTE).
2. If the upstream Gemini connection drops, the Proxy must initialize a *new* Gemini connection.
3. To recover context, the Proxy or Client must maintain a rolling transcript of the last 20 messages and inject them as a hidden "system context" or simulated user history before opening the mic again.

## 5. Browser Audio Compatibility
- **Requirement:** 16kHz PCM capture.
- **Support:** `navigator.mediaDevices.getUserMedia` paired with an `AudioWorkletProcessor` or `ScriptProcessorNode` is required to downsample browser mic audio (usually 44.1/48kHz) to 16kHz.
- **Safari iOS:** Safari notoriously suspends `AudioContext` when switching tabs or turning off the screen. Reconnect logic MUST handle `AudioContext.resume()` upon page visibility events.

## 6. Authentication Lifecycle (Supabase JWT)
- **Issue:** WebSockets cannot send standard HTTP Authorization headers natively in the browser `new WebSocket(url)` constructor.
- **Solution:** The frontend must send the Supabase JWT as the *very first* JSON payload over the opened socket. The proxy will decode/verify it using `@supabase/supabase-js`, check the quota RPC, and only then open the Google connection.
- **Expiration:** If a session lasts longer than 1 hour (JWT expiry), the proxy should ideally poll Supabase or trust the initial handshake. For Phase 3, trusting the initial handshake for the duration of a single session (max ~30 mins) is standard practice.

---
**Final Architectural Decision Required:**
Given that ephemeral credentials cannot securely restrict an attacker from draining Google API quotas, the `live-proxy-server` architecture via Render (or similar) is the only viable path for production.
