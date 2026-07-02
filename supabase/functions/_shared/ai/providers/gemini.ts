export interface GeminiRequestOptions {
    apiKey: string;
    model: string;
    body: any;
    signal?: AbortSignal;
}

export async function fetchGeminiStream(options: GeminiRequestOptions): Promise<Response> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${options.model}:streamGenerateContent?key=${options.apiKey}&alt=sse`;
    return fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(options.body),
        signal: options.signal
    });
}

export async function fetchGemini(options: GeminiRequestOptions): Promise<Response> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${options.model}:generateContent?key=${options.apiKey}`;
    return fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(options.body),
        signal: options.signal
    });
}
