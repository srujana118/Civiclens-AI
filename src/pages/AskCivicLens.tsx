import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Send,
  MessageSquareText,
  Loader2,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

import { supabase, type CivicReport } from '@/lib/supabase';
import PageHeader from '@/components/PageHeader';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

const suggestedQuestions = [
  'What are the most common issues reported?',
  'Which areas have the most reports?',
  'How many reports are about potholes?',
  'What categories of issues exist?',
  'Where are emerging problem areas?',
];

export default function AskCivicLens() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<CivicReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);

  /*
   * Load all citizen reports.
   */
  useEffect(() => {
    async function fetchReports() {
      try {
        const { data, error } = await supabase
          .from('civic_reports')
          .select('*')
          .order('created_at', {
            ascending: false,
          });

        if (error) {
          console.error('Failed to load reports:', error);
          return;
        }

        setReports(data ?? []);
      } catch (error) {
        console.error('Reports fetch error:', error);
      } finally {
        setReportsLoading(false);
      }
    }

    fetchReports();
  }, []);

  /*
   * Keep chat scrolled to the latest message.
   */
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop =
        scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  /*
   * Send question to the Supabase Edge Function.
   *
   * Gemini API key stays on the server.
   */
  const handleSend = async (text?: string) => {
    const question = (text ?? input).trim();

    if (!question || loading) {
      return;
    }

    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        content: question,
      },
    ]);

    setInput('');
    setLoading(true);

    try {
      /*
       * Send the question and report data to the Edge Function.
       */
      const { data, error } =
        await supabase.functions.invoke(
          'ask-civiclens',
          {
            body: {
              question,
              reports,
            },
          },
        );

      if (error) {
        console.error(
          'Ask CivicLens function error:',
          error,
        );

        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content:
              'I could not connect to the CivicLens AI service right now. Please try again.',
          },
        ]);

        return;
      }

      /*
       * Accept common response formats.
       */
      const answer =
        data?.answer ??
        data?.response ??
        data?.message;

      if (!answer) {
        console.error(
          'Unexpected AI response:',
          data,
        );

        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content:
              'I received an empty response from the AI service. Please try asking the question again.',
          },
        ]);

        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: String(answer),
        },
      ]);
    } catch (error) {
      console.error(
        'Ask CivicLens error:',
        error,
      );

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            'Something went wrong while analyzing the reports. Please try again.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Ask CivicLens"
        subtitle="Ask questions about collected community reports and get AI-powered answers."
      />

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="card flex h-[600px] flex-col overflow-hidden">

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-6"
          >
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">

                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1e40af]/5">
                  <MessageSquareText className="h-8 w-8 text-[#1e40af]" />
                </div>

                <h3 className="mt-6 text-lg font-semibold text-[#1e1e1e]">
                  Ask about community reports
                </h3>

                <p className="mt-2 max-w-sm text-sm text-[#6b6b6b]">
                  Ask CivicLens anything about citizen reports,
                  locations, categories, urgency, trends, or
                  emerging problems.
                </p>

                {reportsLoading ? (
                  <div className="mt-6 flex items-center gap-2 text-sm text-[#6b6b6b]">
                    <Loader2 className="h-4 w-4 animate-spin text-[#1e40af]" />
                    Loading community reports...
                  </div>
                ) : reports.length === 0 ? (
                  <Link
                    to="/report"
                    className="btn-secondary mt-6"
                  >
                    No reports yet — add one
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <p className="mt-5 text-xs text-[#9b9b9b]">
                    {reports.length} community report
                    {reports.length !== 1 ? 's' : ''} available
                    for analysis.
                  </p>
                )}

                {/* Suggested questions */}
                <div className="mt-8 flex flex-wrap justify-center gap-2">
                  {suggestedQuestions.map((question) => (
                    <button
                      key={question}
                      type="button"
                      onClick={() =>
                        handleSend(question)
                      }
                      disabled={
                        loading ||
                        reportsLoading ||
                        reports.length === 0
                      }
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#e5e5e5] bg-white px-3.5 py-2 text-xs font-medium text-[#4a4a4a] transition-colors hover:border-[#1e40af] hover:text-[#1e40af] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Sparkles className="h-3 w-3 text-[#1e40af]" />
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-5">

                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${
                      message.role === 'user'
                        ? 'justify-end'
                        : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                        message.role === 'user'
                          ? 'bg-[#1e40af] text-white'
                          : 'bg-[#f5f5f4] text-[#1e1e1e]'
                      }`}
                    >
                      <p className="whitespace-pre-line leading-relaxed">
                        {message.content}
                      </p>
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2 rounded-2xl bg-[#f5f5f4] px-4 py-3">

                      <Loader2 className="h-4 w-4 animate-spin text-[#1e40af]" />

                      <span className="text-sm text-[#6b6b6b]">
                        CivicLens is analyzing the reports...
                      </span>

                    </div>
                  </div>
                )}

              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-[#e5e5e5] p-4">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-3"
            >
              <input
                type="text"
                value={input}
                onChange={(event) =>
                  setInput(event.target.value)
                }
                placeholder="Ask anything about community reports..."
                className="input-field flex-1"
                disabled={
                  loading ||
                  reportsLoading ||
                  reports.length === 0
                }
              />

              <button
                type="submit"
                disabled={
                  !input.trim() ||
                  loading ||
                  reportsLoading ||
                  reports.length === 0
                }
                className="btn-primary flex-shrink-0 px-4"
                aria-label="Send question"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
}