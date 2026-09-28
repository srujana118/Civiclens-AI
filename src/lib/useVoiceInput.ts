import { useCallback, useRef, useState } from 'react';

type VoiceResult = {
  transcript: string;
  language: string;
};

interface SpeechRecognitionResultItem {
  transcript: string;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionResultItem;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;

  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;

  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

/*
 * Detect language from the script returned by speech recognition.
 */
function detectLanguage(text: string): string {
  if (!text.trim()) {
    return 'English';
  }

  // Telugu
  if (/[\u0C00-\u0C7F]/.test(text)) {
    return 'Telugu';
  }

  // Tamil
  if (/[\u0B80-\u0BFF]/.test(text)) {
    return 'Tamil';
  }

  // Kannada
  if (/[\u0C80-\u0CFF]/.test(text)) {
    return 'Kannada';
  }

  // Malayalam
  if (/[\u0D00-\u0D7F]/.test(text)) {
    return 'Malayalam';
  }

  // Devanagari
  // Hindi and Marathi both use Devanagari.
  // Without a multilingual language model they cannot be
  // reliably separated from the script alone.
  if (/[\u0900-\u097F]/.test(text)) {
    return 'Hindi / Marathi';
  }

  // Latin script
  return 'English';
}

export function useVoiceInput(
  _language: string,
  onResult: (result: VoiceResult) => void,
) {
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const [listening, setListening] = useState(false);
  const [detectedLang, setDetectedLang] = useState('');
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(() => {
    setError(null);

    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError(
        'Voice input is not supported in this browser. Please use Google Chrome.'
      );
      return;
    }

    // Stop any previous recording
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // Ignore
      }

      recognitionRef.current = null;
    }

    const recognition = new SpeechRecognition();

    recognitionRef.current = recognition;

    /*
     * Chrome SpeechRecognition requires a language.
     * English is used as the fallback recognition language.
     *
     * The returned transcript is then checked for its script.
     */
    recognition.lang = 'en-IN';

    // Keep listening until the user presses Stop.
    recognition.continuous = true;

    // Return final results instead of constantly replacing text.
    recognition.interimResults = false;

    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setListening(true);
      setError(null);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = '';

      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript + ' ';
      }

      transcript = transcript.trim();

      if (!transcript) {
        return;
      }

      const language = detectLanguage(transcript);

      setDetectedLang(language);

      onResult({
        transcript,
        language,
      });
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      /*
       * no-speech is not treated as a serious failure.
       * Chrome can produce it when the user pauses.
       */
      if (event.error === 'no-speech') {
        return;
      }

      setListening(false);

      switch (event.error) {
        case 'not-allowed':
        case 'service-not-allowed':
          setError(
            'Microphone permission was denied. Please allow microphone access and try again.'
          );
          break;

        case 'audio-capture':
          setError(
            'No microphone was detected. Please check your microphone.'
          );
          break;

        case 'network':
          setError(
            'Speech recognition needs an internet connection.'
          );
          break;

        case 'aborted':
          // User/browser intentionally stopped recognition.
          break;

        default:
          setError(
            'Voice recognition stopped. Please try recording again.'
          );
      }
    };

    recognition.onend = () => {
      /*
       * Do not restart automatically here.
       * Automatic restart can cause Chrome to repeatedly
       * start/stop the microphone.
       */
      setListening(false);
      recognitionRef.current = null;
    };

    try {
      recognition.start();
    } catch {
      setListening(false);
      recognitionRef.current = null;

      setError(
        'Could not start voice recording. Please try again.'
      );
    }
  }, [onResult]);

  const stop = useCallback(() => {
    const recognition = recognitionRef.current;

    if (!recognition) {
      setListening(false);
      return;
    }

    try {
      recognition.stop();
    } catch {
      try {
        recognition.abort();
      } catch {
        // Ignore
      }
    }

    recognitionRef.current = null;
    setListening(false);
  }, []);

  return {
    listening,
    detectedLang,
    error,
    start,
    stop,
  };
}