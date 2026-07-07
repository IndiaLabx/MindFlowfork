import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "npm:postgres@3.4.4";

const databaseUrl = Deno.env.get('SUPABASE_DB_URL')!;
const geminiApiKey = Deno.env.get('enrich-ques-api')!;

function getPgClient() {
    return postgres(databaseUrl, {
        prepare: false,
        max: 5,
        idle_timeout: 30
    });
}

function safeParseJSON(val: any, defaultVal: any) {
    if (val === null || val === undefined) return defaultVal;
    if (typeof val === 'object' && !Array.isArray(val)) return val;
    if (typeof val === 'string') {
        try {
            const parsed = JSON.parse(val);
            return (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : defaultVal;
        } catch (e) {
            return defaultVal;
        }
    }
    return defaultVal;
}

/**
 * Executes a Gemini API call with explicit model fallbacks.
 */
async function callGeminiWithFallbacks(
    models: string[],
    systemInstruction: string,
    payload: any,
    schema: any, // if null, returns plain text
    enableSearchGrounding: boolean = false
) {
    let lastError: Error | null = null;

    for (const model of models) {
        try {
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;

            const tools = enableSearchGrounding ? [{ googleSearch: {} }] : undefined;

            const generationConfig: any = {};
            if (schema) {
                generationConfig.responseMimeType = "application/json";
                generationConfig.responseSchema = schema;
            } else {
                generationConfig.responseMimeType = "text/plain";
            }

            const res = await fetch(geminiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: "user", parts: [{ text: JSON.stringify(payload) }] }],
                    systemInstruction: { parts: [{ text: systemInstruction }] },
                    tools,
                    generationConfig
                })
            });

            const aiResponse = await res.json();
            if (!res.ok) throw new Error(`Model ${model} Error: ${aiResponse.error?.message || 'Unknown'}`);

            const textOutput = aiResponse.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!textOutput) throw new Error(`Model ${model} returned no output`);

            return {
                model,
                data: schema ? JSON.parse(textOutput) : textOutput,
                inputTokens: aiResponse.usageMetadata?.promptTokenCount || 0,
                outputTokens: aiResponse.usageMetadata?.candidatesTokenCount || 0,
                rawResponse: textOutput
            };
        } catch (err: any) {
            console.error(`Fallback triggered from ${model}. Error: ${err.message}`);
            lastError = err;
            continue; // Try next model
        }
    }

    throw new Error(`MODEL_FAILURE: All fallback models failed. Last Error: ${lastError?.message}`);
}

Deno.serve(async (req: Request) => {
    if (req.method !== 'POST') return new Response("Method Not Allowed", { status: 405 });

    const sql = getPgClient();
    let jobsProcessed = 0;

    try {
        const prompts = await sql`
            SELECT task, system_prompt, output_schema, version
            FROM public.ai_prompts
            WHERE task IN ('question_taxonomy_v1', 'question_translation_v1', 'question_teacher_v1', 'question_research_v1') AND active = true;
        `;

        const getPrompt = (name: string) => prompts.find((p: any) => p.task === name);
        const taxonomyPrompt = getPrompt('question_taxonomy_v1');
        const translationPrompt = getPrompt('question_translation_v1');
        const teacherPrompt = getPrompt('question_teacher_v1');
        const researchPrompt = getPrompt('question_research_v1');

        if (!taxonomyPrompt || !translationPrompt || !teacherPrompt || !researchPrompt) {
            throw new Error("PROMPT_FAILURE: One or more required prompts missing or inactive in DB.");
        }

        const queueResult = await sql`SELECT * FROM pgmq.read('question_ai_jobs', 300, 1);`;

        for (const job of queueResult) {
            const msgId = job.msg_id;
            const payload = job.message;
            const startTime = performance.now();
            let totalInputTokens = 0, totalOutputTokens = 0;
            let dlqCategory = null;
            let success = false;
            let finalModel = '';
            let errorMsg = '';

            try {
                const qRes = await sql`SELECT * FROM public.questions WHERE id = ${payload.question_id} AND status IN ('APPROVED', 'ENRICHMENT_PENDING', 'ENRICHING') FOR UPDATE`;
                if (qRes.length === 0) {
                    dlqCategory = "INVALID_STATE";
                    throw new Error("Question not found or not in APPROVED/ENRICHMENT_PENDING state.");
                }
                const question = qRes[0];

                await sql`UPDATE public.questions SET status = 'ENRICHING' WHERE id = ${question.id}`;

                // Safe parsing of JSONB columns
                let progress = safeParseJSON(question.enrichment_progress, { classification: false, translation: false, explanation: false });
                let aiMeta = safeParseJSON(question.ai_metadata, {});

                const sourcePayload = { question: question.question, options: question.options, correct: question.correct };

                // --- TIER 1: Classification ---
                if (!progress.classification) {
                    const models = ['gemini-3.1-flash-lite', 'gemini-2.5-flash', 'gemma-4-31b', 'gemini-2.5-flash-lite'];
                    const res = await callGeminiWithFallbacks(models, taxonomyPrompt.system_prompt, sourcePayload, taxonomyPrompt.output_schema);

                    const validSubjects = ['History', 'Geography', 'Economics', 'Polity', 'Physics', 'Chemistry', 'Biology', 'Computer', 'Static GK', 'Ecology & Environment', 'Current Affairs'];

                    const requiredFields = ['subject', 'topic', 'subTopic', 'difficulty', 'tags'];
                    for (const field of requiredFields) {
                        if (res.data[field] === undefined) {
                            dlqCategory = 'CLASSIFICATION_SCHEMA_FAILURE';
                            console.error(`Missing required field: ${field}. Raw Response: ${res.rawResponse}`);
                            throw new Error(`Schema validation failed. Missing required field: ${field}`);
                        }
                    }

                    if (res.data.subject && !validSubjects.includes(res.data.subject)) {
                        dlqCategory = 'INVALID_SUBJECT';
                        throw new Error(`Invalid subject generated: ${res.data.subject}`);
                    }

                    progress.classification = true;
                    aiMeta.classification = {
                        model: res.model,
                        prompt_version: `question_taxonomy_v1_v${taxonomyPrompt.version}`,
                        generated_at: new Date().toISOString(),
                        input_tokens: res.inputTokens,
                        output_tokens: res.outputTokens
                    };

                    const safeSubject = res.data.subject ?? null;
                    const safeTopic = res.data.topic ?? null;
                    const safeSubTopic = res.data.subTopic ?? null;
                    const safeTags = res.data.tags ?? [];
                    const safeDifficulty = res.data.difficulty ?? null;

                    await sql`
                        UPDATE public.questions
                        SET subject=${safeSubject},
                            topic=${safeTopic},
                            "subTopic"=${safeSubTopic},
                            tags=${safeTags},
                            difficulty=${safeDifficulty},
                            enrichment_progress=${sql.json(progress)},
                            ai_metadata=${sql.json(aiMeta)}
                        WHERE id=${question.id}
                    `;

                    totalInputTokens += res.inputTokens; totalOutputTokens += res.outputTokens;
                }

                // --- TIER 2: Localization ---
                if (!progress.translation) {
                    const models = ['gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite'];
                    const res = await callGeminiWithFallbacks(models, translationPrompt.system_prompt, { question: question.question, options: question.options }, translationPrompt.output_schema);

                    if (!res.data.options_hi || res.data.options_hi.length !== question.options.length) {
                        dlqCategory = 'OPTION_TRANSLATION_MISMATCH';
                        throw new Error("Hindi options count != English options count");
                    }

                    progress.translation = true;
                    aiMeta.translation = {
                        model: res.model,
                        prompt_version: `question_translation_v1_v${translationPrompt.version}`,
                        generated_at: new Date().toISOString(),
                        input_tokens: res.inputTokens,
                        output_tokens: res.outputTokens
                    };

                    const safeQuestionHi = res.data.question_hi ?? null;
                    const safeOptionsHi = res.data.options_hi ?? [];

                    await sql`
                        UPDATE public.questions
                        SET question_hi=${safeQuestionHi},
                            options_hi=${safeOptionsHi},
                            enrichment_progress=${sql.json(progress)},
                            ai_metadata=${sql.json(aiMeta)}
                        WHERE id=${question.id}
                    `;

                    totalInputTokens += res.inputTokens; totalOutputTokens += res.outputTokens;
                }

                // --- TIER 3: Tutor Layer (Two-Stage Grounded Architecture) ---
                if (!progress.explanation) {
                    // STAGE 1: Grounded Research (No Schema)
                    const researchModels = ['gemini-3.1-flash-lite', 'gemini-2.5-flash'];
                    const researchRes = await callGeminiWithFallbacks(
                        researchModels,
                        researchPrompt.system_prompt,
                        sourcePayload,
                        null,
                        true // Enable Google Search
                    );

                    totalInputTokens += researchRes.inputTokens;
                    totalOutputTokens += researchRes.outputTokens;

                    // STAGE 2: Structured Formatter
                    const formatterSystemPrompt = teacherPrompt.system_prompt + "\n\nCRITICAL INSTRUCTION: DO NOT perform any additional research. Only convert the provided research notes into the required Explanation JSON schema exactly.";

                    const formatterPayload = {
                        question: sourcePayload.question,
                        options: sourcePayload.options,
                        correct: sourcePayload.correct,
                        researchNotes: researchRes.data // text from Stage 1
                    };

                    const formatterModels = ['gemma-4-31b-it', 'gemma-4-26b-a4b-it', 'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite'];

                    const res = await callGeminiWithFallbacks(
                        formatterModels,
                        formatterSystemPrompt,
                        formatterPayload,
                        teacherPrompt.output_schema,
                        false // Explicitly NO search
                    );

                    finalModel = res.model;

                    if (!res.data.summary || !res.data.analysis_correct || !res.data.analysis_incorrect || !res.data.conclusion || !res.data.fact) {
                        dlqCategory = 'EXPLANATION_STRUCTURE_FAILURE';
                        throw new Error("Missing required explanation sections.");
                    }

                    if (question.correct !== null && !res.data.summary.includes(question.correct)) {
                        dlqCategory = 'ANSWER_CONTRADICTION';
                        throw new Error("AI explanation contradicts correct answer.");
                    }

                    progress.explanation = true;
                    aiMeta.teacher = {
                        model: res.model,
                        prompt_version: `question_teacher_v1_v${teacherPrompt.version}_two_stage`,
                        generated_at: new Date().toISOString(),
                        input_tokens: res.inputTokens,
                        output_tokens: res.outputTokens,
                        research_model: researchRes.model,
                        research_prompt_version: `question_research_v1_v${researchPrompt.version}`
                    };
                    await sql`UPDATE public.questions SET explanation=${sql.json(res.data)}, enrichment_progress=${sql.json(progress)}, ai_metadata=${sql.json(aiMeta)} WHERE id=${question.id}`;

                    totalInputTokens += res.inputTokens; totalOutputTokens += res.outputTokens;
                }

                await sql.begin(async (tx) => {
                    await tx`UPDATE public.questions SET status = 'ENRICHED' WHERE id=${question.id}`;
                    await tx`SELECT pgmq.delete('question_ai_jobs', ${Number(msgId)}::bigint);`;
                });
                success = true;

            } catch (jobErr: any) {
                success = false;
                errorMsg = jobErr.message;
                dlqCategory = dlqCategory || 'MODEL_FAILURE';

                await sql.begin(async (tx) => {
                    if (payload.question_id) {
                         await tx`UPDATE public.questions SET status = 'FAILED' WHERE id=${payload.question_id}`;
                    }
                    await tx`SELECT pgmq.archive('question_ai_jobs', ${Number(msgId)}::bigint);`;
                });

                console.error(`Job ${msgId} failed. Category: ${dlqCategory}. Error: ${jobErr.message}`);
            } finally {
                const latencyMs = Math.round(performance.now() - startTime);
                await sql`
                    INSERT INTO public.ai_request_logs (
                        feature, model, prompt_version, input_tokens, output_tokens, latency_ms, status_code, error_message
                    ) VALUES (
                        'enrich-questions',
                        ${finalModel || 'cascade_fallback_chain'},
                        'cascade_v1',
                        ${totalInputTokens},
                        ${totalOutputTokens},
                        ${latencyMs},
                        ${success ? 200 : 500},
                        ${success ? null : (dlqCategory + ': ' + errorMsg)}
                    );
                `;
                jobsProcessed++;
            }
        }

        return new Response(JSON.stringify({ success: true, processed: jobsProcessed }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    } finally {
        await sql.end();
    }
});
