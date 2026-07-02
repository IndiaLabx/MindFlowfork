import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkQuotaAndConfig } from "../_shared/ai/governance.ts";
import { logTelemetry } from "../_shared/ai/telemetry.ts";
import { fetchGeminiStream } from "../_shared/ai/providers/gemini.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_PAYLOAD_SIZE = 100000; // ~100k chars to prevent oversized prompt attacks

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    let parsedBody: any = {};
    const requestStartTime = Date.now();

    let telemetryData = {
        user_id: null as string | null,
        feature: 'chat',
        provider: 'google',
        model: null as string | null,
        input_tokens: 0,
        output_tokens: 0,
        latency_ms: 0,
        cache_hit: false,
        fallback_depth: 0,
        error_type: null as string | null,
        estimated_cost_usd: 0,
        request_type: 'streaming',
        response_status: 'failure',
        session_id: null as string | null
    };

    let supabaseAdmin: any = null;

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
        );

        supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const { data: { user } } = await supabaseClient.auth.getUser();

        if (!user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 });
        }

        telemetryData.user_id = user.id;

        // Prevent oversize payload attacks
        const textBody = await req.text();
        if (textBody.length > MAX_PAYLOAD_SIZE) {
            return new Response(JSON.stringify({ error: 'Payload too large' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 413 });
        }
        parsedBody = JSON.parse(textBody);
        const { messages, sessionId, requestedModel } = parsedBody;

        if (!messages || !Array.isArray(messages)) {
            return new Response(JSON.stringify({ error: 'Invalid payload: messages required' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
        }

        telemetryData.session_id = sessionId;

        // --- GOVERNANCE (Atomic RPC) ---
        let config;
        try {
            const governanceResult = await checkQuotaAndConfig(supabaseAdmin, user.id, 'chat');
            config = governanceResult.config;
        } catch (error: any) {
            telemetryData.error_type = error.message;
            telemetryData.response_status = 'quota_rejected';
            // Fire and forget telemetry
            logTelemetry(supabaseAdmin, telemetryData).catch(() => {});

            return new Response(JSON.stringify({ success: false, error: error.message }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: error.message === 'quota_exceeded' ? 429 : 503,
            });
        }

        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) {
            throw new Error("Backend AI Key not configured.");
        }

        let targetModel = requestedModel && config.model_chain.includes(requestedModel)
            ? requestedModel
            : config.model_chain[0];

        const geminiMessages = messages.map((msg: any) => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
        }));

        const systemInstruction = "You are MindFlow AI, a highly adaptive, knowledgeable, and helpful assistant.";
        const requestBody = {
            contents: geminiMessages,
            systemInstruction: { parts: [{ text: systemInstruction }] },
        };

        // Fallback Logic with Timeouts
        let geminiResponse;
        let finalModelUsed = targetModel;

        for (let i = 0; i < config.model_chain.length; i++) {
            const modelToTry = config.model_chain[i];
            try {
                 const controller = new AbortController();
                 const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s strict budget per provider

                 geminiResponse = await fetchGeminiStream({
                     apiKey: geminiApiKey,
                     model: modelToTry,
                     body: requestBody,
                     signal: controller.signal
                 });
                 clearTimeout(timeoutId);

                 if (geminiResponse.ok) {
                     finalModelUsed = modelToTry;
                     telemetryData.fallback_depth = i;
                     break;
                 } else {
                     console.warn(`Model ${modelToTry} failed with status ${geminiResponse.status}`);
                 }
            } catch (e: any) {
                console.warn(`Model ${modelToTry} failed: ${e.message}`);
            }
        }

        if (!geminiResponse || !geminiResponse.ok) {
             throw new Error(`All models failed. Primary model requested: ${targetModel}`);
        }

        telemetryData.model = finalModelUsed;
        telemetryData.response_status = 'success';
        telemetryData.latency_ms = Date.now() - requestStartTime;

        // Fire and forget telemetry
        logTelemetry(supabaseAdmin, telemetryData).catch(() => {});

        return new Response(geminiResponse.body, {
            headers: {
                ...corsHeaders,
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            },
            status: 200
        });

    } catch (error: any) {
        console.error("Chat Gateway Error:", error);

        if (supabaseAdmin) {
            telemetryData.error_type = error.message.substring(0, 255);
            telemetryData.response_status = 'failure';
            logTelemetry(supabaseAdmin, telemetryData).catch(() => {});
        }

        return new Response(JSON.stringify({ success: false, error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
});
