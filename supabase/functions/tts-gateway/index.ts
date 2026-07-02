import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkQuotaAndConfig } from "../_shared/ai/governance.ts";
import { logTelemetry } from "../_shared/ai/telemetry.ts";
import { fetchGemini } from "../_shared/ai/providers/gemini.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_PAYLOAD_SIZE = 50000; // ~50k chars max for TTS

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    let parsedBody: any = {};
    const requestStartTime = Date.now();

    let telemetryData = {
        user_id: null as string | null,
        feature: 'tts',
        provider: 'google',
        model: 'gemini-2.5-flash-preview-tts',
        input_tokens: 0,
        output_tokens: 0,
        latency_ms: 0,
        cache_hit: false,
        fallback_depth: 0,
        error_type: null as string | null,
        estimated_cost_usd: 0,
        request_type: 'tts',
        response_status: 'failure'
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

        const textBody = await req.text();
        if (textBody.length > MAX_PAYLOAD_SIZE) {
            return new Response(JSON.stringify({ error: 'Payload too large' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 413 });
        }
        parsedBody = JSON.parse(textBody);
        const { text, voice = 'Aoede' } = parsedBody;

        if (!text) {
            return new Response(JSON.stringify({ error: 'Invalid payload: text required' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
        }

        telemetryData.input_tokens = text.length;

        // --- GOVERNANCE (Atomic RPC) ---
        let config;
        try {
            const governanceResult = await checkQuotaAndConfig(supabaseAdmin, user.id, 'tts');
            config = governanceResult.config;
        } catch (error: any) {
            telemetryData.error_type = error.message;
            telemetryData.response_status = 'quota_rejected';
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

        const targetModel = config.model_chain[0] || 'gemini-2.5-flash-preview-tts';
        telemetryData.model = targetModel;

        const requestBody = {
            contents: [{ parts: [{ text: text }] }],
            generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: {
                            voiceName: voice
                        }
                    }
                }
            }
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s budget for audio generation

        let geminiResponse;
        try {
            geminiResponse = await fetchGemini({
                 apiKey: geminiApiKey,
                 model: targetModel,
                 body: requestBody,
                 signal: controller.signal
            });
        } finally {
            clearTimeout(timeoutId);
        }

        if (!geminiResponse.ok) {
             const errText = await geminiResponse.text();
             throw new Error(`Gemini API Error: ${geminiResponse.status} ${errText}`);
        }

        const responseData = await geminiResponse.json();
        const audioPart = responseData.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData && p.inlineData.mimeType.startsWith('audio/'));

        if (!audioPart) {
            throw new Error("No audio data returned from Gemini.");
        }

        const base64Audio = audioPart.inlineData.data;

        telemetryData.response_status = 'success';
        telemetryData.latency_ms = Date.now() - requestStartTime;
        telemetryData.output_tokens = base64Audio.length;

        logTelemetry(supabaseAdmin, telemetryData).catch(() => {});

        return new Response(JSON.stringify({
            success: true,
            audioBase64: base64Audio,
            mimeType: audioPart.inlineData.mimeType
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        });

    } catch (error: any) {
        console.error("TTS Gateway Error:", error);

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
