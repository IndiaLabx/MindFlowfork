require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const pino = require('pino');
const { createClient } = require('@supabase/supabase-js');

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;

if (!supabaseUrl || !supabaseServiceKey || !geminiApiKey) {
    logger.fatal("Missing required environment variables. Ensure SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and GEMINI_API_KEY are set.");
    process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const MAX_SESSION_MINUTES = 20;
const IDLE_TIMEOUT_MS = 60 * 1000;
const RECONNECT_WINDOW_MS = 30 * 1000;
const HEARTBEAT_INTERVAL_MS = 15 * 1000;
const MAX_TRANSCRIPT_LENGTH = 20;

const sessionRegistry = new Map();

class LiveSession {
    constructor(userId, initialWs) {
        this.userId = userId;
        this.clientSocket = initialWs;
        this.geminiSocket = null;
        this.createdAt = Date.now();
        this.lastActivity = Date.now();
        this.transcript = [];
        this.connectionState = 'connecting';

        this.remainingMinutes = 0;
        this.usedMinutes = 0;
        this.inputTokens = 0;
        this.outputTokens = 0;
        this.audioInputBytes = 0;
        this.audioOutputBytes = 0;
        this.reconnectCount = 0;

        this.idleTimeoutTimer = null;
        this.reconnectTimer = null;
        this.pingTimer = null;
        this.isAlive = true;

        this.initHeartbeat();
        this.resetIdleTimeout();
    }

    async initGeminiConnection() {
        const host = "generativelanguage.googleapis.com";
        const model = "gemini-2.5-flash-native-audio-preview";
        const url = `wss://${host}/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${geminiApiKey}`;

        return new Promise((resolve, reject) => {
            this.geminiSocket = new WebSocket(url);

            this.geminiSocket.on('open', () => {
                logger.info({ userId: this.userId }, "Gemini WebSocket connected.");
                const setupMessage = {
                    setup: {
                        model: `models/${model}`,
                        generationConfig: {
                            responseModalities: ["AUDIO"],
                            speechConfig: {
                                voiceConfig: {
                                    prebuiltVoiceConfig: { voiceName: "Aoede" }
                                }
                            }
                        },
                        systemInstruction: {
                            parts: [{ text: "You are MindFlow AI, a helpful voice assistant. Keep answers concise." }]
                        }
                    }
                };
                this.geminiSocket.send(JSON.stringify(setupMessage));
                this.connectionState = 'active';
                resolve();
            });

            this.geminiSocket.on('message', (data) => {
                this.recordActivity();
                try {
                    const msg = JSON.parse(data.toString());
                    if (msg.serverContent?.modelTurn?.parts) {
                        for (const part of msg.serverContent.modelTurn.parts) {
                            if (part.inlineData && part.inlineData.data) {
                                this.audioOutputBytes += part.inlineData.data.length;
                            }
                            if (part.text) {
                                this.appendTranscript('model', part.text);
                            }
                        }
                    }
                    if (this.clientSocket && this.clientSocket.readyState === WebSocket.OPEN) {
                        this.clientSocket.send(data.toString());
                    }
                } catch (e) {
                    logger.error({ err: e }, "Error parsing Gemini response");
                }
            });

            this.geminiSocket.on('close', (code, reason) => {
                logger.info({ userId: this.userId, code, reason: reason.toString() }, "Gemini WebSocket closed");
                this.handleDisconnect('gemini_closed');
            });

            this.geminiSocket.on('error', (err) => {
                logger.error({ err, userId: this.userId }, "Gemini WebSocket error");
                reject(err);
            });
        });
    }

    recordActivity() {
        this.lastActivity = Date.now();
        this.resetIdleTimeout();
    }

    appendTranscript(role, text) {
        if (!text) return;
        this.transcript.push({ role, text });
        if (this.transcript.length > MAX_TRANSCRIPT_LENGTH) {
            this.transcript.shift();
        }
    }

    resetIdleTimeout() {
        if (this.idleTimeoutTimer) clearTimeout(this.idleTimeoutTimer);
        this.idleTimeoutTimer = setTimeout(() => {
            logger.info({ userId: this.userId }, "Session idle timeout reached.");
            this.close('idle_timeout');
        }, IDLE_TIMEOUT_MS);
    }

    initHeartbeat() {
        this.pingTimer = setInterval(() => {
            if (!this.isAlive) {
                logger.info({ userId: this.userId }, "Heartbeat failed.");
                this.handleDisconnect('ping_timeout');
                return;
            }
            this.isAlive = false;
            if (this.clientSocket && this.clientSocket.readyState === WebSocket.OPEN) {
                this.clientSocket.send(JSON.stringify({ type: 'ping' }));
            }
        }, HEARTBEAT_INTERVAL_MS);
    }

    handleClientPong() {
        this.isAlive = true;
    }

    handleClientMessage(data) {
        this.recordActivity();
        try {
            const msg = JSON.parse(data.toString());

            if (msg.type === 'pong') {
                this.handleClientPong();
                return;
            }

            if (msg.realtimeInput?.mediaChunks) {
                for (const chunk of msg.realtimeInput.mediaChunks) {
                    if (chunk.data) this.audioInputBytes += chunk.data.length;
                }
            }
            if (msg.clientContent?.turns) {
                for (const turn of msg.clientContent.turns) {
                    for (const part of turn.parts) {
                        if (part.text) this.appendTranscript('user', part.text);
                    }
                }
            }

            if (this.geminiSocket && this.geminiSocket.readyState === WebSocket.OPEN) {
                this.geminiSocket.send(data.toString());
            }
        } catch (e) {
            logger.error({ err: e }, "Error handling client message");
        }
    }

    handleDisconnect(reason) {
        if (this.connectionState === 'closed') return;

        logger.info({ userId: this.userId, reason }, "Client disconnected, starting reconnect window.");
        this.connectionState = 'disconnected';

        if (this.geminiSocket && this.geminiSocket.readyState === WebSocket.OPEN) {
            this.geminiSocket.close();
            this.geminiSocket = null;
        }

        if (this.pingTimer) clearInterval(this.pingTimer);

        this.reconnectTimer = setTimeout(() => {
            logger.info({ userId: this.userId }, "Reconnect window expired.");
            this.close(reason);
        }, RECONNECT_WINDOW_MS);
    }

    async reattach(newWs) {
        logger.info({ userId: this.userId }, "Client reattached.");
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectCount++;

        this.clientSocket = newWs;
        this.connectionState = 'active';
        this.isAlive = true;
        this.initHeartbeat();
        this.resetIdleTimeout();

        try {
            await this.initGeminiConnection();
            this.clientSocket.send(JSON.stringify({ type: 'system', status: 'reconnected' }));
        } catch (e) {
            logger.error({ err: e }, "Failed to re-init Gemini on reattach");
            this.close('gemini_reinit_failed');
        }
    }

    async close(reason) {
        if (this.connectionState === 'closed') return;
        this.connectionState = 'closed';

        logger.info({ userId: this.userId, reason }, "Closing session");

        if (this.pingTimer) clearInterval(this.pingTimer);
        if (this.idleTimeoutTimer) clearTimeout(this.idleTimeoutTimer);
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

        if (this.clientSocket && this.clientSocket.readyState === WebSocket.OPEN) {
            this.clientSocket.send(JSON.stringify({ type: 'system', status: 'closed', reason }));
            this.clientSocket.close();
        }
        if (this.geminiSocket && this.geminiSocket.readyState === WebSocket.OPEN) {
            this.geminiSocket.close();
        }

        sessionRegistry.delete(this.userId);

        const durationMs = Date.now() - this.createdAt;
        const minutesUsed = Math.ceil(durationMs / 60000);
        const inTokens = Math.floor(this.audioInputBytes / 4);
        const outTokens = Math.floor(this.audioOutputBytes / 4);

        try {
            await supabaseAdmin.rpc('flush_live_audio_usage', {
                p_user_id: this.userId,
                p_minutes_used: Math.min(minutesUsed, MAX_SESSION_MINUTES),
                p_input_tokens: inTokens,
                p_output_tokens: outTokens
            });

            await supabaseAdmin.from('ai_request_logs').insert({
                user_id: this.userId,
                feature: 'live_talk',
                provider: 'google',
                model: 'gemini-2.5-flash-native-audio-preview',
                session_duration_ms: durationMs,
                audio_input_bytes: this.audioInputBytes,
                audio_output_bytes: this.audioOutputBytes,
                disconnect_reason: reason,
                reconnect_count: this.reconnectCount,
                session_success: true,
                request_type: 'live_audio',
                response_status: 'closed'
            });
        } catch (e) {
            logger.error({ err: e, userId: this.userId }, "Failed to flush telemetry on close");
        }
    }
}

wss.on('connection', (ws, req) => {
    logger.info("New WebSocket connection established, waiting for auth...");

    let isHandshakeComplete = false;
    let userId = null;

    const authTimeout = setTimeout(() => {
        if (!isHandshakeComplete) {
            ws.close(1008, "Auth timeout");
        }
    }, 5000);

    ws.on('message', async (data) => {
        if (!isHandshakeComplete) {
            try {
                const msg = JSON.parse(data.toString());
                if (msg.type !== 'auth' || !msg.token) {
                    throw new Error("Invalid auth payload");
                }

                const { data: authData, error: authErr } = await supabaseAdmin.auth.getUser(msg.token);
                if (authErr || !authData.user) {
                    throw new Error("Invalid JWT");
                }

                userId = authData.user.id;
                clearTimeout(authTimeout);

                const { data: quotaData, error: quotaErr } = await supabaseAdmin.rpc('check_live_audio_quota', { p_user_id: userId });
                if (quotaErr) {
                    throw new Error(quotaErr.message);
                }

                isHandshakeComplete = true;

                const existingSession = sessionRegistry.get(userId);

                if (existingSession) {
                    if (existingSession.connectionState === 'disconnected') {
                        await existingSession.reattach(ws);
                    } else {
                        ws.send(JSON.stringify({ type: 'error', error: 'live_session_already_active' }));
                        ws.close(1008, "Concurrent session rejected");
                    }
                    return;
                }

                const session = new LiveSession(userId, ws);
                session.remainingMinutes = quotaData.remaining_minutes;

                try {
                    await session.initGeminiConnection();
                    sessionRegistry.set(userId, session);
                    ws.send(JSON.stringify({ type: 'system', status: 'connected', remaining_minutes: session.remainingMinutes }));
                } catch (e) {
                    ws.send(JSON.stringify({ type: 'error', error: 'gemini_connection_failed' }));
                    ws.close(1011, "Gemini failed");
                }

            } catch (err) {
                logger.warn({ err: err.message }, "Auth failed");
                ws.send(JSON.stringify({ type: 'error', error: err.message }));
                ws.close(1008, "Auth failed");
            }
            return;
        }

        const session = sessionRegistry.get(userId);
        if (session) {
            session.handleClientMessage(data);
        }
    });

    ws.on('close', () => {
        if (isHandshakeComplete && userId) {
            const session = sessionRegistry.get(userId);
            if (session && session.clientSocket === ws) {
                session.handleDisconnect('client_closed');
            }
        }
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    logger.info(`Live Proxy Server listening on port ${PORT}`);
});
