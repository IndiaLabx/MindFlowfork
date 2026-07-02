import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface TelemetryData {
    user_id: string | null;
    feature: string;
    provider: string | null;
    model: string | null;
    input_tokens: number;
    output_tokens: number;
    latency_ms: number;
    cache_hit: boolean;
    fallback_depth: number;
    error_type: string | null;
    estimated_cost_usd: number;
    request_type: string;
    response_status: string;
    session_id?: string | null;
}

export async function logTelemetry(
    supabaseAdmin: SupabaseClient,
    data: TelemetryData
) {
    try {
        const { error } = await supabaseAdmin
            .from('ai_request_logs')
            .insert({
                user_id: data.user_id,
                feature: data.feature,
                provider: data.provider,
                model: data.model,
                input_tokens: data.input_tokens,
                output_tokens: data.output_tokens,
                latency_ms: data.latency_ms,
                cache_hit: data.cache_hit,
                fallback_depth: data.fallback_depth,
                error_type: data.error_type,
                estimated_cost_usd: data.estimated_cost_usd,
                request_type: data.request_type,
                response_status: data.response_status,
                session_id: data.session_id || null
            });

        if (error) {
            console.error("Failed to insert telemetry log:", error);
        }
    } catch (e) {
        console.error("Telemetry error:", e);
    }
}
