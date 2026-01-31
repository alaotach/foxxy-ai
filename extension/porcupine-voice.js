// Porcupine Wake Word Detection for "Hey Foxy"
// Detects wake word using Porcupine Web SDK

class PorcupineWakeWord {
    constructor() {
        this.porcupine = null;
        this.isListening = false;
        this.audioContext = null;
        this.mediaStream = null;
        this.processor = null;
        this.onWakeWordCallback = null;
        // Do not hardcode secrets/keys in the repo. Pass via initialize().
        this.accessKey = null;
    }

    /**
     * Initialize Porcupine with access key
     */
    async initialize(accessKey, onWakeWord) {
        if (!accessKey) {
            throw new Error('Picovoice access key is required');
        }

        this.accessKey = accessKey;
        this.onWakeWordCallback = onWakeWord;

        try {
            // Porcupine is loaded globally from libs/porcupine.js in popup.html
            if (typeof window.PorcupineWeb === 'undefined') {
                throw new Error('Porcupine SDK not loaded. Ensure libs/porcupine.js is available.');
            }
            
            const { Porcupine } = window.PorcupineWeb;
            
            // Load the wake word model file
            const keywordPath = chrome.runtime.getURL('ppn/Hey-Foxy_en_wasm_v4_0_0.ppn');
            
            console.log('🎤 Loading Porcupine wake word detection...');
            
            const keywordModel = {
                label: 'Hey Foxy',
                publicPath: keywordPath,
                sensitivity: 0.5 // Adjust sensitivity 0.0-1.0 (higher = more sensitive)
            };

            const porcupineModel = {
                publicPath: chrome.runtime.getURL('ppn/porcupine_params.pv'),
                customWritePath: 'porcupine_model',
                version: 1
            };

            // Create Porcupine instance
            this.porcupine = await Porcupine.create(
                this.accessKey,
                [keywordModel],
                () => {
                    if (this.onWakeWordCallback) {
                        this.onWakeWordCallback();
                    }
                },
                porcupineModel
            );
            
            console.log('✅ Porcupine wake word detection initialized');
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize Porcupine:', error);
            throw error;
        }
    }

    /**
     * Start listening for wake word
     */
    async startListening() {
        if (this.isListening) {
            console.log('Already listening for wake word');
            return;
        }

        if (!this.porcupine) {
            throw new Error('Porcupine not initialized. Call initialize() first.');
        }

        try {
            // Request microphone access
            this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: this.porcupine.sampleRate
            });

            const source = this.audioContext.createMediaStreamSource(this.mediaStream);
            
            // Create script processor for audio processing
            const bufferSize = 512;
            this.processor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);
            
            let frameBuffer = [];
            const frameLength = this.porcupine.frameLength;
            
            this.processor.onaudioprocess = (event) => {
                const inputData = event.inputBuffer.getChannelData(0);
                
                // Convert Float32 to Int16
                for (let i = 0; i < inputData.length; i++) {
                    const sample = Math.max(-1, Math.min(1, inputData[i]));
                    frameBuffer.push(Math.floor(sample * 32767));
                }
                
                // Process complete frames
                while (frameBuffer.length >= frameLength) {
                    const frame = frameBuffer.slice(0, frameLength);
                    frameBuffer = frameBuffer.slice(frameLength);
                    
                    try {
                        // Porcupine.process is async and triggers the callback.
                        this.porcupine.process(new Int16Array(frame)).catch((e) => {
                            console.error('Error processing audio frame:', e);
                        });
                    } catch (error) {
                        console.error('Error processing audio frame:', error);
                    }
                }
            };
            
            source.connect(this.processor);
            this.processor.connect(this.audioContext.destination);
            
            this.isListening = true;
            console.log('🎤 Listening for "Hey Foxy"...');
            
        } catch (error) {
            console.error('❌ Failed to start listening:', error);
            throw error;
        }
    }

    /**
     * Stop listening for wake word
     */
    stopListening() {
        if (!this.isListening) {
            return;
        }

        if (this.processor) {
            this.processor.disconnect();
            this.processor = null;
        }

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }

        this.isListening = false;
        console.log('🔇 Stopped listening for wake word');
    }

    /**
     * Release Porcupine resources
     */
    release() {
        this.stopListening();
        
        if (this.porcupine) {
            this.porcupine.release();
            this.porcupine = null;
        }
        
        console.log('✅ Porcupine resources released');
    }

    /**
     * Check if currently listening
     */
    isActive() {
        return this.isListening;
    }
}

export default PorcupineWakeWord;
