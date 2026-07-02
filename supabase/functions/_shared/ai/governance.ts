import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface GovernanceConfig {
    is_enabled: boolean;
    free_daily_limit: number;
    premium_daily_limit: number;
    model_chain: string[];
    cache_enabled: boolean;
}

export async function checkQuotaAndConfig(
    supabaseAdmin: SupabaseClient,
    userId: string,
    featureName: string
): Promise<{ config: GovernanceConfig, isPremium: boolean }> {
    // We now use an atomic RPC to prevent race conditions and double-spending
    const { data, error } = await supabaseAdmin
        .rpc('check_and_increment_ai_quota', {
            p_user_id: userId,
            p_feature: featureName
        });

    if (error) {
        if (error.message.includes('quota_exceeded')) {
            throw new Error("quota_exceeded");
        }
        if (error.message.includes('kill_switch_active')) {
            throw new Error("kill_switch_active");
        }
        console.error(`Quota RPC error for ${featureName}:`, error);
        throw new Error("system_configuration_error");
    }

    if (!data || !data.config) {
        throw new Error("system_configuration_error");
    }

    return {
        config: data.config as GovernanceConfig,
        isPremium: data.isPremium as boolean
    };
}
