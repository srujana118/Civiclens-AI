import { useState, useRef, useCallback, useEffect } from 'react';
import { LANGUAGES } from '@/lib/supabase';

type SpeechRecognitionResult = {
  transcript: string;
  detectedLang: string | null;
};

type SpeechRecognitionState = {
  listening: boolean;
  transcript: string;
  detectedLang: string | null;
  error: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
};

const BCP47_BY_CODE: Record<string, string> = Object.fromEntries(
  LANGUAGES.map((l) => [l.code, l.bcp47]),
);

const LABEL_BY_BCP47: Record<string, string> = Object.fromEntries(
  LANGUAGES.map((l) => [l.bcp47, l.label]),
);

type SpeechRecognitionAlternative = {
  transcript: string;
  confidence: number;
};

type SpeechRecognitionResultItem = {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternative;
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<SpeechRecognitionResultItem>;
  resultIndex: number;
};

type SpeechRecognitionErrorEventLike = {
  error: string;
  message?: string;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
};

function getSpeechRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: (new () => SpeechRecognitionLike);
    webkitSpeechRecognition?: (new () => SpeechRecognitionLike);
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useVoiceInput(
  langCode: string,
  onResult?: (result: SpeechRecognitionResult) => void,
): SpeechRecognitionState {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [detectedLang, setDetectedLang] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalTranscriptRef = useRef('');
  const langCodeRef = useRef(langCode);
  const onResultRef = useRef(onResult);

  useEffect(() => {
    langCodeRef.current = langCode;
  }, [langCode]);

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  const stop = useCallback(() => {
    const rec = recognitionRef.current;
    if (rec) {
      try {
        rec.stop();
      } catch {
        // already stopped
      }
    }
    setListening(false);
  }, []);

  const reset = useCallback(() => {
    finalTranscriptRef.current = '';
    setTranscript('');
    setDetectedLang(null);
    setError(null);
  }, []);

  const start = useCallback(() => {
    const SpeechRecognitionCtor = getSpeechRecognition();
    if (!SpeechRecognitionCtor) {
      setError('Voice input is not supported in this browser. Try Chrome or Edge.');
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        // ignore
      }
    }

    const bcp47 = BCP47_BY_CODE[langCodeRef.current] ?? 'en-IN';
    const langLabel = LABEL_BY_BCP47[bcp47] ?? bcp47;

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = bcp47;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setListening(true);
      setError(null);
      setDetectedLang(langLabel);
    };

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let interimText = '';
      let newFinalText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? '';
        if (result.isFinal) {
          newFinalText += text;
        } else {
          interimText += text;
        }
      }

      if (newFinalText) {
        finalTranscriptRef.current += newFinalText;
      }

      const combined = finalTranscriptRef.current + interimText;
      setTranscript(combined);

      if (onResultRef.current) {
        onResultRef.current({
          transcript: combined,
          detectedLang: langLabel,
        });
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      if (event.error === 'no-speech') {
        return;
      }
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setError('Microphone access denied. Please allow microphone access in your browser settings.');
        setListening(false);
        return;
      }
      if (event.error === 'language-not-supported') {
        setError(`${langLabel} speech recognition is not supported by your browser.`);
        setListening(false);
        return;
      }
      setError(`Voice input error: ${event.error}`);
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      setError('Could not start voice input. Please try again.');
      setListening(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      const rec = recognitionRef.current;
      if (rec) {
        try {
          rec.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  return { listening, transcript, detectedLang, error, start, stop, reset };
}
