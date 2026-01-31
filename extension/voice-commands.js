// Voice Commands Manager for Foxy AI
// Handles wake word detection, speech recognition, and TTS responses

import PorcupineWakeWord from './porcupine-voice.js';
import { loadTextToSpeech, loadVoiceStyle, writeWavFile } from './tts-helper.js';

class VoiceCommandsManager {
    constructor() {
        this.porcupine = null;
        this.recognition = null;
        this.tts = null;
        this.ttsConfig = null;
        this.voiceStyle = null;
        this.isInitialized = false;
        this.isListeningForCommand = false;
        this.onCommandCallback = null;
        this.onStatusChangeCallback = null;
        this.audioContext = null;

        // Mode: 'sidepanel' (legacy) uses Porcupine+STT in the extension page,
        // 'tab' injects a content script into the active tab to handle mic + wake word + STT.
        this.mode = 'tab';
        this.picovoiceAccessKey = null;
        this.tabId = null;
        this._onRuntimeMessage = this._onRuntimeMessage.bind(this);
        
        // Voice settings
        this.voiceLanguage = 'en';
        this.ttsSpeed = 1.05;
        this.ttsSteps = 5; // Lower steps for faster response
    }

    /**
     * Initialize all voice components
     */
    async initialize(picovoiceAccessKey, onCommand, onStatusChange, options = {}) {
        if (this.isInitialized) {
            console.log('Voice commands already initialized');
            return;
        }

        this.mode = options.mode || 'tab';
        this.picovoiceAccessKey = picovoiceAccessKey;
        this.onCommandCallback = onCommand;
        this.onStatusChangeCallback = onStatusChange;

        try {
            this.updateStatus('Initializing voice commands...');

            if (this.mode === 'sidepanel') {
                // Legacy path (kept for reference)
                this.porcupine = new PorcupineWakeWord();
                await this.porcupine.initialize(picovoiceAccessKey, () => this.onWakeWord());
                this.initializeSpeechRecognition();
            } else {
                // Tab mode: wake word + STT happen in the active tab
                chrome.runtime.onMessage.addListener(this._onRuntimeMessage);
            }

            // Initialize Supertonic TTS (lazy load - only when needed for response)
            this.updateStatus('Voice commands ready! Say "Hey Foxy" to start.');
            
            this.isInitialized = true;
            return true;

        } catch (error) {
            console.error('❌ Failed to initialize voice commands:', error);
            this.updateStatus(`Error: ${error.message}`, 'error');
            throw error;
        }
    }

    _onRuntimeMessage(message) {
        if (!message || typeof message !== 'object') return;

        switch (message.type) {
            case 'FOXY_VOICE_REQUESTING_MIC':
                this.updateStatus('Requesting microphone access in the tab...', 'info');
                break;
            case 'FOXY_VOICE_STARTED':
                this.updateStatus('Listening for "Hey Foxy"...', 'active');
                break;
            case 'FOXY_VOICE_WAKE':
                this.updateStatus('Wake word detected — listening for command...', 'listening');
                this.playBeep();
                break;
            case 'FOXY_VOICE_STT_START':
                this.updateStatus('Listening for your command...', 'listening');
                break;
            case 'FOXY_VOICE_TRANSCRIPT':
                if (this.onCommandCallback) {
                    this.onCommandCallback(message.transcript, message.confidence ?? 0.8);
                }
                break;
            case 'FOXY_VOICE_STT_ERROR':
                this.updateStatus(`Recognition error: ${message.error}`, 'error');
                break;
            case 'FOXY_VOICE_ERROR':
                this.updateStatus(`Voice error: ${message.error}`, 'error');
                break;
            case 'FOXY_VOICE_STOPPED':
                this.updateStatus('Voice commands disabled', 'inactive');
                break;
            default:
                break;
        }
    }

    /**
     * Initialize TTS on-demand (lazy loading)
     */
    async initializeTTS() {
        if (this.tts) {
            return; // Already initialized
        }

        try {
            console.log('🔊 Loading TTS models...');
            this.updateStatus('Loading voice synthesis...');

            // Load TTS models from extension directory
            const onnxDir = chrome.runtime.getURL('tts-models');
            
            const result = await loadTextToSpeech(
                onnxDir,
                {
                    executionProviders: ['wasm'],
                    graphOptimizationLevel: 'all'
                },
                (modelName, current, total) => {
                    this.updateStatus(`Loading TTS: ${modelName} (${current}/${total})`);
                }
            );

            this.tts = result.textToSpeech;
            this.ttsConfig = result.cfgs;

            // Load default voice style (F1 - friendly female voice)
            const voiceStylePath = chrome.runtime.getURL('tts-models/voice_styles/F1.json');
            this.voiceStyle = await loadVoiceStyle(voiceStylePath, true);

            console.log('✅ TTS initialized');
            
        } catch (error) {
            console.error('❌ TTS initialization failed:', error);
            // Continue without TTS - voice commands will still work
        }
    }

    /**
     * Initialize speech recognition
     */
    initializeSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
            throw new Error('Speech recognition not supported in this browser');
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';
        this.recognition.maxAlternatives = 1;

        this.recognition.onstart = () => {
            console.log('🎤 Speech recognition started');
            this.updateStatus('Listening for your command...', 'listening');
        };

        this.recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            const confidence = event.results[0][0].confidence;
            
            console.log(`🗣️ Heard: "${transcript}" (confidence: ${confidence.toFixed(2)})`);
            this.updateStatus(`Heard: "${transcript}"`);
            
            if (this.onCommandCallback) {
                this.onCommandCallback(transcript, confidence);
            }
        };

        this.recognition.onerror = (event) => {
            console.error('❌ Speech recognition error:', event.error);
            this.updateStatus(`Recognition error: ${event.error}`, 'error');
            this.isListeningForCommand = false;
        };

        this.recognition.onend = () => {
            console.log('🔇 Speech recognition ended');
            this.isListeningForCommand = false;
        };
    }

    /**
     * Called when wake word is detected
     */
    async onWakeWord() {
        if (this.isListeningForCommand) {
            return; // Already listening
        }

        console.log('👂 Wake word detected - listening for command...');
        
        // Play acknowledgment sound (beep)
        this.playBeep();
        
        // Start speech recognition
        this.startListeningForCommand();
    }

    /**
     * Start listening for voice command
     */
    startListeningForCommand() {
        if (!this.recognition) {
            console.error('Speech recognition not initialized');
            return;
        }

        try {
            this.isListeningForCommand = true;
            this.recognition.start();
        } catch (error) {
            console.error('Failed to start speech recognition:', error);
            this.isListeningForCommand = false;
        }
    }

    /**
     * Stop listening for command
     */
    stopListeningForCommand() {
        if (this.recognition && this.isListeningForCommand) {
            this.recognition.stop();
            this.isListeningForCommand = false;
        }
    }

    /**
     * Enable wake word detection
     */
    async enableWakeWord() {
        if (this.mode === 'sidepanel') {
            if (!this.porcupine) {
                throw new Error('Porcupine not initialized');
            }
            await this.porcupine.startListening();
            this.updateStatus('Listening for "Hey Foxy"...', 'active');
            return;
        }

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) {
            throw new Error('No active tab found');
        }
        if (!tab.url || (!tab.url.startsWith('http://') && !tab.url.startsWith('https://'))) {
            throw new Error('Open a normal website tab (http/https) to enable voice');
        }

        this.tabId = tab.id;

        // Inject Porcupine SDK + our capture script into the tab.
        await chrome.scripting.executeScript({
            target: { tabId: this.tabId },
            files: ['libs/porcupine.js', 'voice-capture-content.js']
        });

        const resp = await chrome.tabs.sendMessage(this.tabId, {
            type: 'FOXY_VOICE_START',
            accessKey: this.picovoiceAccessKey
        });

        if (!resp?.ok) {
            throw new Error(resp?.error || 'Failed to start voice capture in tab');
        }
    }

    /**
     * Disable wake word detection
     */
    disableWakeWord() {
        if (this.mode === 'sidepanel') {
            if (this.porcupine) {
                this.porcupine.stopListening();
                this.updateStatus('Voice commands disabled', 'inactive');
            }
            return;
        }

        if (this.tabId) {
            chrome.tabs.sendMessage(this.tabId, { type: 'FOXY_VOICE_STOP' }).catch(() => {});
        }
        this.tabId = null;
        this.updateStatus('Voice commands disabled', 'inactive');
    }

    /**
     * Speak text using Supertonic TTS
     */
    async speak(text) {
        try {
            // Initialize TTS if not already loaded
            if (!this.tts) {
                await this.initializeTTS();
            }

            if (!this.tts || !this.voiceStyle) {
                console.warn('TTS not available, using fallback speech');
                this.speakFallback(text);
                return;
            }

            console.log(`🔊 Speaking: "${text}"`);
            this.updateStatus('Generating voice response...');

            // Generate speech
            const { wav, duration } = await this.tts.call(
                text,
                this.voiceLanguage,
                this.voiceStyle,
                this.ttsSteps,
                this.ttsSpeed,
                0.3
            );

            // Create WAV file
            const wavBuffer = writeWavFile(wav, this.tts.sampleRate);
            const blob = new Blob([wavBuffer], { type: 'audio/wav' });
            const url = URL.createObjectURL(blob);

            // Play audio
            await this.playAudio(url);

            // Cleanup
            URL.revokeObjectURL(url);
            
            this.updateStatus('Listening for "Hey Foxy"...', 'active');

        } catch (error) {
            console.error('❌ TTS error:', error);
            // Fallback to browser speech synthesis
            this.speakFallback(text);
        }
    }

    /**
     * Fallback speech using browser's SpeechSynthesis
     */
    speakFallback(text) {
        if (!window.speechSynthesis) {
            console.warn('Speech synthesis not available');
            return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        
        window.speechSynthesis.speak(utterance);
    }

    /**
     * Play audio from URL
     */
    async playAudio(url) {
        return new Promise((resolve, reject) => {
            const audio = new Audio(url);
            audio.onended = resolve;
            audio.onerror = reject;
            audio.play().catch(reject);
        });
    }

    /**
     * Play acknowledgment beep
     */
    playBeep() {
        try {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }

            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            oscillator.frequency.value = 800; // Hz
            gainNode.gain.value = 0.3;

            oscillator.start(this.audioContext.currentTime);
            oscillator.stop(this.audioContext.currentTime + 0.1);

        } catch (error) {
            console.warn('Failed to play beep:', error);
        }
    }

    /**
     * Update status callback
     */
    updateStatus(message, type = 'info') {
        if (this.onStatusChangeCallback) {
            this.onStatusChangeCallback(message, type);
        }
    }

    /**
     * Check if voice commands are active
     */
    isActive() {
        return this.porcupine && this.porcupine.isActive();
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        this.disableWakeWord();
        this.stopListeningForCommand();
        
        if (this.porcupine) {
            this.porcupine.release();
            this.porcupine = null;
        }

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        this.isInitialized = false;
        console.log('✅ Voice commands cleaned up');
    }
}

export default VoiceCommandsManager;
