import { useState, useRef, useCallback } from 'react';
import { LiveConnection } from './LiveConnection';
import { arrayBufferToBase64, floatTo16BitPCM, base64ToUint8Array } from '../talk/audio-helpers';

export interface LiveSessionState {
    status: 'disconnected' | 'connecting' | 'connected';
    error: string | null;
    isSpeaking: boolean;
    audioVolume: number;
    agentState: 'idle' | 'listening' | 'thinking' | 'speaking';
}

export function useLiveSession() {
    const [state, setState] = useState<LiveSessionState>({
        status: 'disconnected',
        error: null,
        isSpeaking: false,
        audioVolume: 0,
        agentState: 'idle'
    });

    const connectionRef = useRef<LiveConnection | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);

    // Audio Playback
    const playbackQueueRef = useRef<AudioBuffer[]>([]);
    const isPlayingRef = useRef(false);

    const playNextAudio = useCallback(() => {
        if (playbackQueueRef.current.length === 0) {
            isPlayingRef.current = false;
            setState(s => ({ ...s, agentState: 'idle' }));
            return;
        }

        isPlayingRef.current = true;
        setState(s => ({ ...s, agentState: 'speaking' }));

        const audioCtx = audioContextRef.current;
        if (!audioCtx) return;

        const buffer = playbackQueueRef.current.shift()!;
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtx.destination);

        source.onended = () => {
            playNextAudio();
        };

        source.start();
    }, []);

    const handleAudioData = useCallback((base64Data: string) => {
        const audioCtx = audioContextRef.current;
        if (!audioCtx) return;

        try {
            const pcmData = base64ToUint8Array(base64Data);
            const int16Array = new Int16Array(pcmData.buffer, pcmData.byteOffset, pcmData.length / 2);

            const float32Array = new Float32Array(int16Array.length);
            for (let i = 0; i < int16Array.length; i++) {
                float32Array[i] = int16Array[i] / 32768.0;
            }

            const audioBuffer = audioCtx.createBuffer(1, float32Array.length, 24000);
            audioBuffer.getChannelData(0).set(float32Array);

            playbackQueueRef.current.push(audioBuffer);
            if (!isPlayingRef.current) {
                playNextAudio();
            }
        } catch (e) {
            console.error("Audio playback error", e);
        }
    }, [playNextAudio]);

    const connect = useCallback(async () => {
        setState(s => ({ ...s, error: null, status: 'connecting' }));

        try {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            await audioContextRef.current.resume();

            mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });

            sourceNodeRef.current = audioContextRef.current.createMediaStreamSource(mediaStreamRef.current);

            const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
            processor.onaudioprocess = (e) => {
                const inputData = e.inputBuffer.getChannelData(0);

                let sum = 0;
                for (let i = 0; i < inputData.length; i++) {
                    sum += inputData[i] * inputData[i];
                }
                const rms = Math.sqrt(sum / inputData.length);
                setState(s => ({ ...s, audioVolume: rms }));

                if (rms > 0.01) {
                    setState(s => s.agentState !== 'speaking' ? { ...s, agentState: 'listening' } : s);
                }

                if (connectionRef.current?.status === 'connected') {
                    const pcm16Buffer = floatTo16BitPCM(inputData);
                    connectionRef.current.sendAudioChunk(arrayBufferToBase64(pcm16Buffer));
                }
            };

            sourceNodeRef.current.connect(processor);
            processor.connect(audioContextRef.current.destination);

            connectionRef.current = new LiveConnection({
                onMessage: (msg) => {
                    if (msg.serverContent?.modelTurn?.parts) {
                        for (const part of msg.serverContent.modelTurn.parts) {
                            if (part.inlineData?.data) {
                                handleAudioData(part.inlineData.data);
                            }
                        }
                    }
                },
                onStatusChange: (status, reason) => {
                    setState(s => ({ ...s, status, error: reason || s.error }));
                },
                onError: (err) => {
                    setState(s => ({ ...s, error: err }));
                }
            });

            await connectionRef.current.connect();

        } catch (e: any) {
            setState(s => ({ ...s, error: e.message, status: 'disconnected' }));
        }
    }, [handleAudioData]);

    const disconnect = useCallback(() => {
        connectionRef.current?.disconnect();
        mediaStreamRef.current?.getTracks().forEach(t => t.stop());
        audioContextRef.current?.close();
        setState(s => ({ ...s, status: 'disconnected', agentState: 'idle' }));
    }, []);

    const sendMessage = useCallback((text: string) => {
        connectionRef.current?.sendTextMessage(text);
    }, []);

    return {
        ...state,
        connect,
        disconnect,
        sendMessage
    };
}
