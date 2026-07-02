-- Migration: Atomic Quota Check

-- We are modifying the flow to prevent race conditions.
-- The previous trigger incremented usage AFTER the log was inserted.
-- However, we need a transactional lock BEFORE allowing the AI request.

CREATE OR REPLACE FUNCTION public.check_and_increment_ai_quota(
    p_user_id uuid,
    p_feature text
) RETURNS jsonb AS $$
DECLARE
    v_config public.ai_feature_config;
    v_usage public.ai_user_usage_daily;
    v_is_premium boolean;
    v_daily_limit integer;
    v_today date := current_date;
BEGIN
    -- 1. Get Config
    SELECT * INTO v_config
    FROM public.ai_feature_config
    WHERE feature_name = p_feature;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Feature not found';
    END IF;

    IF NOT v_config.is_enabled THEN
        RAISE EXCEPTION 'kill_switch_active';
    END IF;

    -- 2. Get Subscription Status
    SELECT (subscription_status IN ('premium', 'pro')) INTO v_is_premium
    FROM public.profiles
    WHERE id = p_user_id;

    v_is_premium := COALESCE(v_is_premium, false);

    IF v_is_premium THEN
        v_daily_limit := v_config.premium_daily_limit;
    ELSE
        v_daily_limit := v_config.free_daily_limit;
    END IF;

    -- 3. Atomically lock and check/increment usage
    -- We insert a 0-usage row if it doesn't exist, and lock it FOR UPDATE
    INSERT INTO public.ai_user_usage_daily (user_id, usage_date, feature, request_count, input_tokens, output_tokens)
    VALUES (p_user_id, v_today, p_feature, 0, 0, 0)
    ON CONFLICT (user_id, usage_date, feature) DO NOTHING;

    -- Lock the row for this transaction
    SELECT * INTO v_usage
    FROM public.ai_user_usage_daily
    WHERE user_id = p_user_id AND usage_date = v_today AND feature = p_feature
    FOR UPDATE;

    IF v_usage.request_count >= v_daily_limit THEN
        RAISE EXCEPTION 'quota_exceeded';
    END IF;

    -- We increment the request count here transactionally.
    -- If the edge function fails later, it costs a quota slot, preventing abuse of failing streams.
    UPDATE public.ai_user_usage_daily
    SET request_count = request_count + 1
    WHERE user_id = p_user_id AND usage_date = v_today AND feature = p_feature;

    RETURN jsonb_build_object(
        'config', jsonb_build_object(
             'is_enabled', v_config.is_enabled,
             'free_daily_limit', v_config.free_daily_limit,
             'premium_daily_limit', v_config.premium_daily_limit,
             'model_chain', v_config.model_chain,
             'cache_enabled', v_config.cache_enabled
        ),
        'isPremium', v_is_premium,
        'remaining', v_daily_limit - (v_usage.request_count + 1)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Since we are now incrementing request_count atomically BEFORE the request,
-- we must update the trigger to only update tokens, not request_count.
CREATE OR REPLACE FUNCTION public.update_ai_user_usage_daily()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.user_id IS NOT NULL THEN
        -- The row should already exist because check_and_increment_ai_quota created it,
        -- but just in case, we do an UPSERT for tokens.
        INSERT INTO public.ai_user_usage_daily (user_id, usage_date, feature, request_count, input_tokens, output_tokens)
        VALUES (
            NEW.user_id,
            NEW.created_at::date,
            NEW.feature,
            0, -- Do not increment request count here anymore!
            COALESCE(NEW.input_tokens, 0),
            COALESCE(NEW.output_tokens, 0)
        )
        ON CONFLICT (user_id, usage_date, feature)
        DO UPDATE SET
            input_tokens = public.ai_user_usage_daily.input_tokens + COALESCE(NEW.input_tokens, 0),
            output_tokens = public.ai_user_usage_daily.output_tokens + COALESCE(NEW.output_tokens, 0);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
