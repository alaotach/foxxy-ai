// Runs in the active tab (isolated world).
// Handles microphone permission + Porcupine wake-word + Web Speech API transcription.
// Sends results back to the extension via chrome.runtime.sendMessage.

(() => {
  const STATE = {
    started: false,
    accessKey: null,
    keywordPath: null,
    porcupine: null,
    audioContext: null,
    mediaStream: null,
    processor: null,
    recognition: null,
    isRecognizing: false,
  };

  function log(...args) {
    // eslint-disable-next-line no-console
    console.log('[FoxyVoice]', ...args);
  }

  function pcmFloatToInt16(float32) {
    const int16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16;
  }

  function ensureSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    let silenceTimeout = null;
    let lastTranscript = '';
    
    recognition.onresult = (event) => {
      try {
        // Get the latest result
        const lastIndex = event.results.length - 1;
        const res = event.results[lastIndex][0];
        const transcript = res?.transcript?.trim();
        const isFinal = event.results[lastIndex].isFinal;
        const confidence = typeof res?.confidence === 'number' ? res.confidence : 0.8;
        
        if (transcript) {
          lastTranscript = transcript;
          
          // Clear previous silence timeout
          if (silenceTimeout) {
            clearTimeout(silenceTimeout);
            silenceTimeout = null;
          }
          
          // If final result or after 1.5s of silence, send the command
          if (isFinal) {
            chrome.runtime.sendMessage({
              type: 'FOXY_VOICE_TRANSCRIPT',
              transcript: lastTranscript,
              confidence,
            });
            // Stop recognition and go back to wake word listening
            if (STATE.recognition && STATE.isRecognizing) {
              STATE.recognition.stop();
            }
          } else {
            // Set timeout for silence (wait for user to finish speaking)
            silenceTimeout = setTimeout(() => {
              if (lastTranscript) {
                chrome.runtime.sendMessage({
                  type: 'FOXY_VOICE_TRANSCRIPT',
                  transcript: lastTranscript,
                  confidence,
                });
              }
              // Stop recognition and go back to wake word listening
              if (STATE.recognition && STATE.isRecognizing) {
                STATE.recognition.stop();
              }
            }, 1500);
          }
        }
      } catch (e) {
        log('SpeechRecognition result handling failed', e);
      }
    };

    recognition.onerror = (event) => {
      log('SpeechRecognition error', event);
      chrome.runtime.sendMessage({
        type: 'FOXY_VOICE_STT_ERROR',
        error: String(event?.error || 'speech_recognition_error'),
      });
    };

    recognition.onend = () => {
      STATE.isRecognizing = false;
      chrome.runtime.sendMessage({ type: 'FOXY_VOICE_STT_END' });
    };

    return recognition;
  }

  async function startRecognition() {
    if (STATE.isRecognizing) return;

    if (!STATE.recognition) {
      STATE.recognition = ensureSpeechRecognition();
    }

    if (!STATE.recognition) {
      chrome.runtime.sendMessage({
        type: 'FOXY_VOICE_STT_ERROR',
        error: 'SpeechRecognition API not available in this tab',
      });
      return;
    }

    STATE.isRecognizing = true;
    chrome.runtime.sendMessage({ type: 'FOXY_VOICE_STT_START' });

    try {
      STATE.recognition.start();
    } catch (e) {
      // Some implementations throw if started too quickly.
      STATE.isRecognizing = false;
      chrome.runtime.sendMessage({
        type: 'FOXY_VOICE_STT_ERROR',
        error: e?.message || String(e),
      });
    }
  }

  async function stopAll() {
    STATE.started = false;

    try {
      if (STATE.processor) {
        STATE.processor.disconnect();
        STATE.processor.onaudioprocess = null;
      }
    } catch {}

    try {
      if (STATE.audioContext) {
        await STATE.audioContext.close();
      }
    } catch {}

    try {
      if (STATE.mediaStream) {
        STATE.mediaStream.getTracks().forEach((t) => t.stop());
      }
    } catch {}

    try {
      if (STATE.porcupine) {
        await STATE.porcupine.release();
      }
    } catch {}

    try {
      if (STATE.recognition && STATE.isRecognizing) {
        STATE.recognition.stop();
      }
    } catch {}

    STATE.porcupine = null;
    STATE.audioContext = null;
    STATE.mediaStream = null;
    STATE.processor = null;
    STATE.recognition = null;
    STATE.isRecognizing = false;

    chrome.runtime.sendMessage({ type: 'FOXY_VOICE_STOPPED' });
  }

  async function start({ accessKey }) {
    if (STATE.started) return;

    if (!accessKey) {
      throw new Error('Missing Picovoice accessKey');
    }

    if (typeof window.PorcupineWeb === 'undefined') {
      throw new Error('PorcupineWeb not found (libs/porcupine.js not injected)');
    }

    STATE.accessKey = accessKey;
    STATE.keywordPath = chrome.runtime.getURL('ppn/Hey-Foxy_en_wasm_v4_0_0.ppn');

    chrome.runtime.sendMessage({ type: 'FOXY_VOICE_REQUESTING_MIC' });

    STATE.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const { Porcupine } = window.PorcupineWeb;

    const keywordModel = {
      label: 'Hey Foxy',
      publicPath: STATE.keywordPath,
      sensitivity: 0.5,
    };

    const porcupineModel = {
      // You must ship this file with the extension.
      publicPath: chrome.runtime.getURL('ppn/porcupine_params.pv'),
      customWritePath: 'porcupine_model',
      forceWrite: false,
      version: 1,
    };

    STATE.porcupine = await Porcupine.create(
      STATE.accessKey,
      [keywordModel],
      () => {
        chrome.runtime.sendMessage({ type: 'FOXY_VOICE_WAKE' });
        startRecognition();
      },
      porcupineModel,
      {
        processErrorCallback: (err) => {
          chrome.runtime.sendMessage({
            type: 'FOXY_VOICE_ERROR',
            error: err?.message || String(err),
          });
        },
      }
    );

    const sampleRate = STATE.porcupine.sampleRate;
    STATE.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate });

    const source = STATE.audioContext.createMediaStreamSource(STATE.mediaStream);

    // Buffer size should be a power of two; 512 works well.
    const bufferSize = 512;
    STATE.processor = STATE.audioContext.createScriptProcessor(bufferSize, 1, 1);

    const frameLength = STATE.porcupine.frameLength;
    let frameBuffer = [];

    STATE.processor.onaudioprocess = (event) => {
      if (!STATE.started) return;

      const input = event.inputBuffer.getChannelData(0);
      const pcm = pcmFloatToInt16(input);

      for (let i = 0; i < pcm.length; i++) {
        frameBuffer.push(pcm[i]);

        if (frameBuffer.length >= frameLength) {
          const frame = new Int16Array(frameBuffer.slice(0, frameLength));
          frameBuffer = frameBuffer.slice(frameLength);

          // Porcupine.process is async and triggers the detection callback.
          STATE.porcupine.process(frame).catch((e) => {
            log('Porcupine process error', e);
          });
        }
      }
    };

    source.connect(STATE.processor);
    STATE.processor.connect(STATE.audioContext.destination);

    STATE.started = true;
    chrome.runtime.sendMessage({ type: 'FOXY_VOICE_STARTED' });
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'FOXY_VOICE_START') {
      start({ accessKey: msg.accessKey })
        .then(() => sendResponse({ ok: true }))
        .catch((e) => {
          sendResponse({ ok: false, error: e?.message || String(e) });
          chrome.runtime.sendMessage({
            type: 'FOXY_VOICE_ERROR',
            error: e?.message || String(e),
          });
        });
      return true;
    }

    if (msg.type === 'FOXY_VOICE_STOP') {
      stopAll()
        .then(() => sendResponse({ ok: true }))
        .catch((e) => sendResponse({ ok: false, error: e?.message || String(e) }));
      return true;
    }

    if (msg.type === 'FOXY_VOICE_PING') {
      sendResponse({ ok: true, started: STATE.started });
      return;
    }
  });
})();
