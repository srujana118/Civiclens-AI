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
import { formatRelative } from '@/lib/utils';

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

function generateAnswer(question: string, reports: CivicReport[]): string {
  if (reports.length === 0) {
    return 'There are no reports in the system yet. Once citizens start submitting issues, I can answer questions about what communities need and where patterns are emerging. You can contribute by reporting an issue.';
  }

  const q = question.toLowerCase();

  // Most common issues
  if (q.includes('most common') || q.includes('most reported') || q.includes('top issue') || q.includes('frequent')) {
    const catMap = new Map<string, number>();
    reports.forEach((r) => catMap.set(r.category, (catMap.get(r.category) ?? 0) + 1));
    const sorted = [...catMap.entries()].sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) return 'No categories have been reported yet.';
    const top = sorted.slice(0, 3);
    return `The most commonly reported issues are:\n\n${top.map(([cat, count], i) => `${i + 1}. ${cat} — ${count} report${count !== 1 ? 's' : ''}`).join('\n')}\n\n${sorted[0][0]} is the leading category with ${sorted[0][1]} report${sorted[0][1] !== 1 ? 's' : ''}.`;
  }

  // Areas with most reports
  if (q.includes('area') || q.includes('where') || q.includes('location') || q.includes('emerging')) {
    const areaMap = new Map<string, number>();
    reports.forEach((r) => {
      const area = r.location.split(',')[0].trim();
      areaMap.set(area, (areaMap.get(area) ?? 0) + 1);
    });
    const sorted = [...areaMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (sorted.length === 0) return 'No location data is available yet.';
    return `The areas with the most reports are:\n\n${sorted.map(([area, count], i) => `${i + 1}. ${area} — ${count} report${count !== 1 ? 's' : ''}`).join('\n')}\n\n${sorted[0][0]} has the highest concentration of reported issues.`;
  }

  // Specific category questions
  const categoryMatch = reports.find((r) => q.includes(r.category.toLowerCase()));
  if (categoryMatch || q.includes('pothole') || q.includes('lighting') || q.includes('sanitation') || q.includes('graffiti') || q.includes('noise') || q.includes('safety') || q.includes('water') || q.includes('park') || q.includes('traffic')) {
    let targetCat = '';
    if (q.includes('pothole')) targetCat = 'Potholes';
    else if (q.includes('lighting')) targetCat = 'Street Lighting';
    else if (q.includes('sanitation')) targetCat = 'Sanitation';
    else if (q.includes('graffiti')) targetCat = 'Graffiti';
    else if (q.includes('noise')) targetCat = 'Noise';
    else if (q.includes('safety')) targetCat = 'Public Safety';
    else if (q.includes('water')) targetCat = 'Water';
    else if (q.includes('park')) targetCat = 'Parks';
    else if (q.includes('traffic')) targetCat = 'Traffic';
    else if (categoryMatch) targetCat = categoryMatch.category;

    const filtered = reports.filter((r) => r.category === targetCat);
    if (filtered.length === 0) return `There are no reports about ${targetCat} at this time.`;

    const areas = new Set(filtered.map((r) => r.location.split(',')[0].trim()));
    return `There are ${filtered.length} report${filtered.length !== 1 ? 's' : ''} about ${targetCat}.\n\nThese reports span ${areas.size} area${areas.size !== 1 ? 's' : ''}: ${[...areas].slice(0, 5).join(', ')}${areas.size > 5 ? ', and more' : ''}.\n\nThe most recent was filed ${formatRelative(filtered[0].created_at)}.`;
  }

  // Categories
  if (q.includes('categor') || q.includes('type') || q.includes('kind')) {
    const catMap = new Map<string, number>();
    reports.forEach((r) => catMap.set(r.category, (catMap.get(r.category) ?? 0) + 1));
    return `There are ${catMap.size} issue categories in the system:\n\n${[...catMap.entries()].map(([cat, count]) => `• ${cat} (${count} report${count !== 1 ? 's' : ''})`).join('\n')}`;
  }

  // How many reports
  if (q.includes('how many') || q.includes('total') || q.includes('count')) {
    return `There are ${reports.length} total report${reports.length !== 1 ? 's' : ''} in the system.\n\nThe most recent was submitted ${formatRelative(reports[0].created_at)}.`;
  }

  // Default
  return `I can answer questions about the ${reports.length} report${reports.length !== 1 ? 's' : ''} currently in the system. Try asking about:\n\n• The most common issues\n• Which areas have the most reports\n• A specific category (e.g. potholes, noise)\n• Total report counts\n• Emerging problem areas`;
}

export default function AskCivicLens() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<CivicReport[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchReports() {
      const { data } = await supabase
        .from('civic_reports')
        .select('*')
        .order('created_at', { ascending: false });
      setReports(data ?? []);
    }
    fetchReports();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSend = async (text?: string) => {
    const question = (text ?? input).trim();
    if (!question || loading) return;

    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setInput('');
    setLoading(true);

    // Simulate thinking
    await new Promise((r) => setTimeout(r, 600));

    const answer = generateAnswer(question, reports);
    setMessages((prev) => [...prev, { role: 'assistant', content: answer }]);
    setLoading(false);
  };

  return (
    <div>
      <PageHeader
        title="Ask CivicLens"
        subtitle="Ask questions about collected community reports and get AI-powered answers."
      />
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="card flex h-[600px] flex-col overflow-hidden">
          {/* Messages area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1e40af]/5">
                  <MessageSquareText className="h-8 w-8 text-[#1e40af]" />
                </div>
                <h3 className="mt-6 text-lg font-semibold text-[#1e1e1e]">
                  Ask about community reports
                </h3>
                <p className="mt-2 max-w-sm text-sm text-[#6b6b6b]">
                  I can answer questions about reported issues, emerging areas,
                  category trends, and more.
                </p>
                {reports.length === 0 && (
                  <Link to="/report" className="btn-secondary mt-6">
                    No reports yet — add one
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
                {/* Suggested questions */}
                <div className="mt-8 flex flex-wrap justify-center gap-2">
                  {suggestedQuestions.map((q) => (
                    <button
                      key={q}
                      onClick={() => handleSend(q)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#e5e5e5] bg-white px-3.5 py-2 text-xs font-medium text-[#4a4a4a] transition-colors hover:border-[#1e40af] hover:text-[#1e40af]"
                    >
                      <Sparkles className="h-3 w-3 text-[#1e40af]" />
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                        msg.role === 'user'
                          ? 'bg-[#1e40af] text-white'
                          : 'bg-[#f5f5f4] text-[#1e1e1e]'
                      }`}
                    >
                      <p className="whitespace-pre-line leading-relaxed">{msg.content}</p>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2 rounded-2xl bg-[#f5f5f4] px-4 py-3">
                      <Loader2 className="h-4 w-4 animate-spin text-[#1e40af]" />
                      <span className="text-sm text-[#6b6b6b]">Analyzing reports...</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-[#e5e5e5] p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-3"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question about community reports..."
                className="input-field flex-1"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="btn-primary flex-shrink-0 px-4"
                aria-label="Send question"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
