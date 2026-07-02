import { ProcessedDocument } from './utils/fileProcessing';
import { useQuota, MODEL_CONFIGS, ModelId } from './useQuota';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useProfileStats } from '../../auth/hooks/useProfileStats';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../../../lib/supabase';
import {
    AIChatConversation,
    AIChatMessage,
    getChatConversations,
    getChatMessages,
    saveChatConversation,
    saveChatMessage,
    deleteChatConversation as dbDeleteConversation,
    deleteChatMessagesAfter
} from '../../../lib/db';

const SYSTEM_PROMPT = `You are MindFlow AI, a highly adaptive, knowledgeable, and helpful assistant.
Your goal is to assist the user by automatically adapting your tone, expertise, and teaching style based on their query and the conversation history.
If they ask about grammar, act as a strict grammar coach.
If they want to practice for an interview, act as a tough but fair interviewer.
If they ask about general topics, be an encouraging educational assistant.
- Keep answers concise but informative.
- Use markdown formatting for readability.
- Maintain context of the conversation to provide the best possible response.`;

export type GroundingState = 'auto' | 'always' | 'off';

export const useAIChat = () => {
    const [messages, setMessages] = useState<AIChatMessage[]>([]);
    const [activeModel, setActiveModel] = useState<ModelId>('gemini-2.5-flash');
    const [groundingState, setGroundingState] = useState<GroundingState>('auto');
    const quota = useQuota(activeModel);
    const [includeAppData, setIncludeAppData] = useState(false);
    const { stats } = useProfileStats();
    const [conversations, setConversations] = useState<AIChatConversation[]>([]);
    const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // To handle abortion of streams
    const abortControllerRef = useRef<AbortController | null>(null);

    // Load initial data
    useEffect(() => {
        loadConversations();
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    const loadConversations = async () => {
        try {
            const history = await getChatConversations();
            setConversations(history);
        } catch (error) {
            console.error("Failed to load conversations:", error);
        }
    };

    const loadConversation = async (id: string) => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        try {
            const msgs = await getChatMessages(id);
            setMessages(msgs);
            setCurrentConversationId(id);
        } catch (error) {
            console.error("Failed to load messages:", error);
        }
    };

    const startNewConversation = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        setCurrentConversationId(null);
        setMessages([]);
    };

    const appendTranscript = async (transcriptItems: { role: 'user' | 'model', text: string }[]) => {
        if (!transcriptItems.length) return;

        let activeConvId = currentConversationId;
        const now = new Date().toISOString();
        let isNewConv = false;

        // Ensure we have a conversation to append to
        if (!activeConvId) {
            activeConvId = uuidv4();
            isNewConv = true;
            const newConv: AIChatConversation = {
                id: activeConvId,
                title: "Live Talk Session",
                created_at: now,
                updated_at: now
            };
            await saveChatConversation(newConv);
            setCurrentConversationId(activeConvId);
            setConversations(prev => [newConv, ...prev]);
        } else {
            const existingConv = conversations.find(c => c.id === activeConvId);
            if (existingConv) {
                const updatedConv = { ...existingConv, updated_at: now };
                await saveChatConversation(updatedConv);
                setConversations(prev => prev.map(c => c.id === activeConvId ? updatedConv : c).sort((a,b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()));
            }
        }

        const newMessages: AIChatMessage[] = [];
        for (const item of transcriptItems) {
            if (!item.text.trim()) continue;

            const msg: AIChatMessage = {
                id: uuidv4(),
                conversation_id: activeConvId,
                role: item.role === 'model' ? 'assistant' : 'user',
                content: item.text,
                created_at: new Date().toISOString()
            };
            newMessages.push(msg);
            await saveChatMessage(msg);
        }

        if (newMessages.length > 0) {
            setMessages(prev => [...prev, ...newMessages]);
        }
    };

    const stopGenerating = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
    };


    const generateTitle = async (convId: string, firstMessage: string) => {
        // @ts-ignore



try {
            const { data, error } = await supabase.auth.getSession();
            if (error || !data.session) return;

            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-ai`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${data.session.access_token}`
                },
                body: JSON.stringify({
                    messages: [{ role: 'user', content: `Generate a short 3-5 word title for a conversation that starts with: "${firstMessage}". Do not use quotes in the response.` }],
                    requestedModel: 'gemini-3.1-flash-lite'
                })
            });

            if (!response.ok) return;

            const reader = response.body?.getReader();
            const decoder = new TextDecoder("utf-8");
            let fullTitle = "";

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const chunk = decoder.decode(value, { stream: true });
                    const lines = chunk.split('\n');
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const dataStr = line.slice(6);
                            if (dataStr === '[DONE]') continue;
                            try {
                                const parsed = JSON.parse(dataStr);
                                const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                                if (text) fullTitle += text;
                            } catch (e) { }
                        }
                    }
                }
            }

            let title = fullTitle.trim().replace(/^["']|["']$/g, '');
            if (title) {
                setConversations(prev => {
                    const updated = prev.map(c => c.id === convId ? { ...c, title } : c);
                    const convToSave = updated.find(c => c.id === convId);
                    if (convToSave) saveChatConversation(convToSave);
                    return updated;
                });
            }
        } catch (error) {
            console.error("Error generating title:", error);
        }
    };

    const deleteConversation = async (id: string) => {
        try {
            await dbDeleteConversation(id);
            if (currentConversationId === id) {
                startNewConversation();
            }
            await loadConversations();
        } catch (error) {
            console.error("Failed to delete conversation:", error);
        }
    };

    const sendMessage = useCallback(async (content: string, imageBase64?: string, audioData?: { data: string, mimeType: string }, documents?: ProcessedDocument[], customHistory?: AIChatMessage[]) => {
        if (!content.trim() && !imageBase64 && !audioData && (!documents || documents.length === 0)) return;

        const quotaCheck = quota.checkCanRequest();
        if (!quotaCheck.allowed) {
            setMessages(prev => [...prev, {
                id: uuidv4(),
                conversation_id: currentConversationId || uuidv4(),
                role: 'assistant',
                content: `**Quota Alert:** ${quotaCheck.reason}`,
                created_at: new Date().toISOString()
            }]);
            return;
        }
        quota.trackRequest();

        // Cancel previous request if any
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        let activeConvId = currentConversationId;
        const now = new Date().toISOString();

        // 1. Create a new conversation if one doesn't exist
        let isNewConv = false;
        if (!activeConvId) {
            activeConvId = uuidv4();
            isNewConv = true;
            const newConv: AIChatConversation = {
                id: activeConvId,
                title: content.slice(0, 30) + (content.length > 30 ? '...' : ''),
                created_at: now,
                updated_at: now
            };
            await saveChatConversation(newConv);
            setCurrentConversationId(activeConvId);
            setConversations(prev => [newConv, ...prev]);
        } else {
            // Update timestamp of existing conversation
            const existingConv = conversations.find(c => c.id === activeConvId);
            if (existingConv) {
                const updatedConv = { ...existingConv, updated_at: now };
                await saveChatConversation(updatedConv);
                setConversations(prev => prev.map(c => c.id === activeConvId ? updatedConv : c).sort((a,b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()));
            }
        }

        // 2. Add User Message
        const userMessage: AIChatMessage = {
            id: uuidv4(),
            conversation_id: activeConvId,
            role: 'user',
            content: content,
            ...(imageBase64 && { image: imageBase64 }),
            ...(documents && documents.length > 0 && { documents: documents }),
            created_at: new Date().toISOString()
        };

        setMessages(prev => [...prev, userMessage]);
        await saveChatMessage(userMessage);

        if (isNewConv) {
            // Fire and forget auto-titling in background
            generateTitle(activeConvId, content || 'Document Chat');
        }

        // 3. Prepare AI request (Streaming)
        setIsLoading(true);

        // @ts-ignore


        const aiMessageId = uuidv4();
        // Insert empty AI message to be streamed into
        const emptyAiMessage: AIChatMessage = {
            id: aiMessageId,
            conversation_id: activeConvId,
            role: 'assistant',
            content: "",
            created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, emptyAiMessage]);

        try {
            // Format history for Gemini (Exclude the empty one we just pushed)
            const baseMessages = customHistory || messages;
            const historyToSent = baseMessages.map(m => {
                const parts: any[] = [{ text: m.content || "Attached media" }];

                // Reconstruct history with historical documents
                if (m.documents && m.documents.length > 0) {
                    m.documents.forEach(doc => {
                        if (doc.isText) {
                            parts.push({ text: `\n[Document Content: ${doc.name}]\n${doc.data}\n` });
                        } else if (doc.mimeType === 'application/pdf') {
                            parts.push({
                                inlineData: {
                                    mimeType: doc.mimeType,
                                    data: doc.data
                                }
                            });
                        }
                    });
                }

                return {
                    role: m.role === 'user' ? 'user' : 'model',
                    parts
                };
            });

            // Add the new user message
            const userParts: any[] = [{ text: content || "Can you analyze this file?" }];

            // Handle current documents
            if (documents && documents.length > 0) {
                documents.forEach(doc => {
                    if (doc.isText) {
                        userParts.push({ text: `\n[Document Content: ${doc.name}]\n${doc.data}\n` });
                    } else if (doc.mimeType === 'application/pdf') {
                        userParts.push({
                            inlineData: {
                                mimeType: doc.mimeType,
                                data: doc.data
                            }
                        });
                    }
                });
            }

            if (imageBase64) {
                const base64Data = imageBase64.split(',')[1];
                const mimeType = imageBase64.split(';')[0].split(':')[1];
                userParts.push({
                    inlineData: {
                        mimeType,
                        data: base64Data
                    }
                });
            }
            if (audioData) {
                userParts.push({
                    inlineData: {
                        mimeType: audioData.mimeType,
                        data: audioData.data
                    }
                });
            }
            historyToSent.push({
                role: 'user',
                parts: userParts
            });


            let shouldUseGrounding = false;
            if (groundingState === 'always') { shouldUseGrounding = true; }

            let finalSystemPrompt = SYSTEM_PROMPT;

            if (includeAppData && stats) {
                const contextStr = `\n\nUSER PROFILE CONTEXT:\nThe user has completed ${stats.quizzesCompleted} quizzes.\nTotal Correct: ${stats.correctAnswers}\nAverage Score: ${Math.round(stats.averageScore)}%\nWeak Topics: ${stats.weakTopics.join(', ')}\nUse this context to personalize your advice and point out areas of improvement if relevant.`;
                finalSystemPrompt += contextStr;
            }

                        const requestBody: any = {
                messages: historyToSent.map(h => ({ role: h.role, content: h.parts[0].text })),
                sessionId: activeConvId,
                requestedModel: activeModel
            };

            const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !sessionData.session) {
                throw new Error("Please log in to use AI Chat.");
            }

            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-ai`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionData.session.access_token}`
                },
                body: JSON.stringify(requestBody),
                signal: abortControllerRef.current.signal
            });

            if (!response.ok) {
                 const errBody = await response.json().catch(() => ({}));
                 if (response.status === 429) {
                     throw new Error("You have reached your daily AI Chat limit.");
                 } else if (response.status === 503) {
                     throw new Error("AI Chat is currently disabled for maintenance.");
                 }
                 throw new Error(errBody?.error || `AI Error: ${response.status}`);
            }

            if (!response.body) throw new Error("No response body");

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let fullText = "";

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });

                const lines = chunk.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.substring(6).trim();
                        if (dataStr === '[DONE]' || dataStr === '') continue;
                        try {
                            const data = JSON.parse(dataStr);
                            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
                            if (text) {
                                fullText += text;
                                setMessages(prev => prev.map(m =>
                                    m.id === aiMessageId ? { ...m, content: fullText } : m
                                ));
                            }
                        } catch (e) {
                            // Ignore JSON parse errors for incomplete chunks
                        }
                    }
                }
            }

            // Once streaming is completely done, save the finalized message to DB
            const finalAiMessage = { ...emptyAiMessage, content: fullText };
            await saveChatMessage(finalAiMessage);

        } catch (error: any) {
            if (error.name === 'AbortError') {
                console.log('AI Request aborted');
                return;
            }
            console.error("AI Error:", error);

            setMessages(prev => prev.map(m =>
                m.id === aiMessageId ? { ...m, content: `**Error:** ${error.message || "An unexpected error occurred."}` } : m
            ));

            // Save the error state to DB so it doesn't get lost
            const errorAiMessage = { ...emptyAiMessage, content: `**Error:** ${error.message || "An unexpected error occurred."}` };
            await saveChatMessage(errorAiMessage);

        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
        }

    }, [messages, currentConversationId, conversations, activeModel, includeAppData, stats, quota, groundingState]);
    const editMessage = async (messageId: string, newContent: string) => {
        const messageIndex = messages.findIndex(m => m.id === messageId);
        if (messageIndex === -1) return;

        const originalMessage = messages[messageIndex];

        // Stop current generation if any
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setIsLoading(false);
        }

        // Delete all messages after the edited message from the database
        await deleteChatMessagesAfter(originalMessage.conversation_id, originalMessage.created_at);

        // Keep messages up to the edited message, but excluding the edited message itself
        // because we will resend it
        const preservedMessages = messages.slice(0, messageIndex);
        setMessages(preservedMessages);

        // Use the original message's properties, but update the text. We will resend this.
        // Pass preservedMessages so sendMessage doesn't use the stale messages array.
        await sendMessage(newContent, originalMessage.image, undefined, originalMessage.documents, preservedMessages);
    };

    return {
        messages,
        editMessage,
        conversations,
        currentConversationId,
        isLoading,
        sendMessage,
        startNewConversation,
        loadConversation,
        deleteConversation,
        stopGenerating,
        includeAppData,
        setIncludeAppData,
        groundingState,
        setGroundingState,
        activeModel,
        setActiveModel,
        quota,
        appendTranscript
    };
};
