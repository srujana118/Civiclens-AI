import { Link } from 'react-router-dom';
import {
  PenLine,
  Brain,
  ScanSearch,
  Lightbulb,
  ArrowRight,
  Eye,
  BarChart3,
  MapPin,
  MessageSquareText,
} from 'lucide-react';

const flowSteps = [
  {
    icon: PenLine,
    label: 'Citizen Reports',
    description: 'Community members report issues they encounter',
  },
  {
    icon: Brain,
    label: 'AI Understanding',
    description: 'Reports are structured and categorized automatically',
  },
  {
    icon: ScanSearch,
    label: 'Pattern Detection',
    description: 'Emerging trends are identified across areas',
  },
  {
    icon: Lightbulb,
    label: 'Civic Insights',
    description: 'Actionable intelligence for better communities',
  },
];

const features = [
  {
    icon: BarChart3,
    title: 'Intelligence Dashboard',
    description: 'Track total reports, emerging areas, and category breakdowns in real time.',
    link: '/intelligence',
    linkLabel: 'View Dashboard',
  },
  {
    icon: MapPin,
    title: 'Interactive Map',
    description: 'See where issues cluster and discover geographic patterns across communities.',
    link: '/map',
    linkLabel: 'Open Map',
  },
  {
    icon: MessageSquareText,
    title: 'Ask CivicLens',
    description: 'Ask natural-language questions about community reports and get AI-powered answers.',
    link: '/ask',
    linkLabel: 'Try It',
  },
];

export default function Home() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[#e5e5e5]">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="animate-fade-in max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#e5e5e5] bg-white px-3 py-1 text-xs font-medium text-[#6b6b6b]">
              <span className="h-2 w-2 rounded-full bg-[#1e40af] animate-pulse-soft" />
              Civic Intelligence Platform
            </div>
            <h1 className="text-4xl font-semibold tracking-tight text-[#1e1e1e] sm:text-5xl lg:text-6xl">
              CivicLens AI
            </h1>
            <p className="mt-4 text-xl text-[#6b6b6b] sm:text-2xl">
              See what communities need. Understand where. Discover the patterns.
            </p>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-[#4a4a4a]">
              CivicLens turns citizen-reported issues into structured civic intelligence
              and reveals emerging patterns across communities.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/report" className="btn-primary">
                Report an Issue
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/intelligence" className="btn-secondary">
                Explore Intelligence
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Visual Flow */}
      <section className="border-b border-[#e5e5e5] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="text-center text-sm font-semibold uppercase tracking-wider text-[#6b6b6b]">
            How It Works
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {flowSteps.map((step, idx) => (
              <div key={step.label} className="relative animate-fade-in" style={{ animationDelay: `${idx * 100}ms` }}>
                <div className="card flex h-full flex-col items-center p-6 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1e40af]/5 text-[#1e40af]">
                    <step.icon className="h-6 w-6" />
                  </div>
                  <div className="mt-3 text-xs font-semibold text-[#1e40af]">
                    Step {idx + 1}
                  </div>
                  <h3 className="mt-1 text-base font-semibold text-[#1e1e1e]">
                    {step.label}
                  </h3>
                  <p className="mt-2 text-sm text-[#6b6b6b]">{step.description}</p>
                </div>
                {idx < flowSteps.length - 1 && (
                  <div className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-[#c5c5c5] lg:block">
                    <ArrowRight className="h-5 w-5" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Cards */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {features.map((feature, idx) => (
            <Link
              key={feature.title}
              to={feature.link}
              className="card group p-6 transition-all hover:shadow-md animate-fade-in"
              style={{ animationDelay: `${idx * 100}ms` }}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1e40af]/5 text-[#1e40af]">
                <feature.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-[#1e1e1e]">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm text-[#6b6b6b]">{feature.description}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#1e40af] transition-transform group-hover:gap-2.5">
                {feature.linkLabel}
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-[#e5e5e5] bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1e40af]">
              <Eye className="h-7 w-7 text-white" />
            </div>
            <h2 className="max-w-2xl text-2xl font-semibold tracking-tight text-[#1e1e1e] sm:text-3xl">
              Start building a clearer picture of your community
            </h2>
            <p className="max-w-xl text-base text-[#6b6b6b]">
              Every report contributes to a shared understanding of what communities
              need and where.
            </p>
            <Link to="/report" className="btn-primary">
              Report an Issue
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
