import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileText,
  MapPin,
  RefreshCw,
  TrendingUp,
  Target,
  Users,
  Activity,
} from 'lucide-react';

import {
  supabase,
  type CivicReport,
} from '@/lib/supabase';

import {
  detectHotspots,
  type Cluster,
} from '@/lib/clustering';

import PageHeader from '@/components/PageHeader';

type Recommendation = {
  cluster: Cluster;
  action: string;
  reason: string;
  priority: string;
  impact: string;
};

function getCategory(report: CivicReport): string {
  return (
    report.ai_category?.trim() ||
    report.category?.trim() ||
    'Other'
  );
}

/*
 * Converts citizen issue categories into development priorities.
 * This keeps the dashboard aligned with the problem statement:
 * citizen demand -> infrastructure priority -> recommended action.
 */
function getRecommendation(cluster: Cluster): {
  action: string;
  reason: string;
  priority: string;
  impact: string;
} {
  const category = cluster.dominantCategory.toLowerCase();

  if (category.includes('pothole')) {
    return {
      action: 'Road repair and pothole resurfacing',
      reason:
        'Repeated citizen reports indicate a concentrated road-safety and mobility requirement.',
      priority: 'Road infrastructure',
      impact:
        'Can improve road safety, mobility and everyday access for residents in the affected area.',
    };
  }

  if (
    category.includes('street') ||
    category.includes('lighting')
  ) {
    return {
      action: 'Inspect and restore street lighting',
      reason:
        'Repeated reports indicate a localized street-lighting service gap.',
      priority: 'Public infrastructure',
      impact:
        'Can improve visibility, mobility and perceived public safety for the surrounding community.',
    };
  }

  if (category.includes('water')) {
    return {
      action: 'Inspect and improve water infrastructure',
      reason:
        'Multiple reports indicate recurring demand related to essential water infrastructure.',
      priority: 'Water infrastructure',
      impact:
        'Can improve access to essential water services and reduce recurring community disruption.',
    };
  }

  if (category.includes('drain')) {
    return {
      action: 'Inspect drainage infrastructure',
      reason:
        'Repeated reports indicate a localized drainage requirement.',
      priority: 'Water and drainage',
      impact:
        'Can reduce local flooding, waterlogging and related infrastructure problems.',
    };
  }

  if (category.includes('sanitation')) {
    return {
      action: 'Schedule sanitation inspection and cleanup',
      reason:
        'Repeated sanitation reports indicate an area-level public-service gap.',
      priority: 'Sanitation infrastructure',
      impact:
        'Can improve cleanliness and the quality of the local public environment.',
    };
  }

  if (category.includes('traffic')) {
    return {
      action: 'Assess traffic management and road safety',
      reason:
        'Multiple reports indicate a recurring traffic or mobility concern.',
      priority: 'Mobility infrastructure',
      impact:
        'Can improve traffic movement, road safety and accessibility for residents.',
    };
  }

  if (category.includes('public safety')) {
    return {
      action: 'Conduct a public-safety infrastructure assessment',
      reason:
        'Recent citizen reports indicate a concentrated public-safety concern.',
      priority: 'Public safety',
      impact:
        'Can help identify local infrastructure changes needed to improve community safety.',
    };
  }

  if (category.includes('park')) {
    return {
      action: 'Inspect and maintain public park infrastructure',
      reason:
        'Multiple reports indicate a recurring issue affecting public recreational facilities.',
      priority: 'Community infrastructure',
      impact:
        'Can improve access to usable and maintained community recreational spaces.',
    };
  }

  if (category.includes('noise')) {
    return {
      action: 'Investigate recurring noise complaints',
      reason:
        'Repeated citizen reports indicate a localized environmental concern.',
      priority: 'Environmental quality',
      impact:
        'Can help identify recurring local environmental concerns affecting residents.',
    };
  }

  if (category.includes('graffiti')) {
    return {
      action: 'Schedule cleanup and public-space inspection',
      reason:
        'Repeated reports indicate a recurring public-space maintenance issue.',
      priority: 'Public-space infrastructure',
      impact:
        'Can improve maintenance and the quality of shared public spaces.',
    };
  }

  return {
    action: 'Conduct a local infrastructure assessment',
    reason:
      'Multiple citizen reports indicate a recurring issue requiring local authority review.',
    priority: 'Local infrastructure',
    impact:
      'Can help authorities identify and address a recurring community infrastructure requirement.',
  };
}

function getPriorityStyle(priority: string) {
  if (priority === 'High') {
    return 'bg-red-50 text-red-700 border-red-200';
  }

  if (priority === 'Medium') {
    return 'bg-amber-50 text-amber-700 border-amber-200';
  }

  return 'bg-green-50 text-green-700 border-green-200';
}

export default function PolicyDashboard() {
  const [reports, setReports] = useState<CivicReport[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] =
    useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('civic_reports')
      .select('*')
      .order('created_at', {
        ascending: false,
      });

    if (error) {
      console.error(
        'Policy dashboard error:',
        error
      );

      setReports([]);
      setClusters([]);
      setLoading(false);
      return;
    }

    const reportList = data ?? [];

    setReports(reportList);
    setClusters(detectHotspots(reportList));
    setLastUpdated(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();

    const interval = setInterval(
      fetchData,
      15000
    );

    return () => clearInterval(interval);
  }, [fetchData]);

  /*
   * Convert every detected hotspot into a policy recommendation.
   */
  const recommendations = useMemo<Recommendation[]>(
    () =>
      clusters.map((cluster) => {
        const recommendation =
          getRecommendation(cluster);

        return {
          cluster,
          ...recommendation,
        };
      }),
    [clusters]
  );

  const highPriority = clusters.filter(
    (cluster) =>
      cluster.priorityLevel === 'High'
  ).length;

  const mediumPriority = clusters.filter(
    (cluster) =>
      cluster.priorityLevel === 'Medium'
  ).length;

  const totalHotspotReports =
    clusters.reduce(
      (sum, cluster) =>
        sum + cluster.reportCount,
      0
    );

  /*
   * Category demand.
   */
  const categories = useMemo(() => {
    const counts = new Map<string, number>();

    reports.forEach((report) => {
      const category =
        getCategory(report);

      counts.set(
        category,
        (counts.get(category) ?? 0) + 1
      );
    });

    return [...counts.entries()].sort(
      (a, b) => b[1] - a[1]
    );
  }, [reports]);

  /*
   * Total reports with explicit AI impact information.
   */
  const impactReports = useMemo(() => {
    return reports.filter(
      (report) =>
        report.ai_impact &&
        report.ai_impact.trim()
    ).length;
  }, [reports]);

  /*
   * Overall hotspot coverage.
   */
  const hotspotCoverage =
    reports.length > 0
      ? Math.round(
          (totalHotspotReports /
            reports.length) *
            100
        )
      : 0;

  return (
    <div>
      <PageHeader
        title="Policy Dashboard"
        subtitle="Convert citizen feedback into evidence-based infrastructure priorities and recommended actions."
      />

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">

        {/* HEADER */}
        <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm text-[#6b6b6b]">
              Governance intelligence
            </p>

            {lastUpdated && (
              <p className="mt-1 text-xs text-[#9b9b9b]">
                Live data · Updated{' '}
                {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#d6d3d1] bg-white px-4 py-2 text-sm font-medium text-[#1e1e1e] hover:bg-[#f5f5f4] disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                loading
                  ? 'animate-spin'
                  : ''
              }`}
            />
            Refresh
          </button>
        </div>

        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">

          <div className="card p-5">
            <p className="text-xs font-medium text-[#6b6b6b]">
              Citizen Reports
            </p>

            <p className="mt-2 text-3xl font-bold text-[#1e1e1e]">
              {reports.length}
            </p>

            <p className="mt-1 text-xs text-[#9b9b9b]">
              Total submitted reports
            </p>
          </div>

          <div className="card p-5">
            <p className="text-xs font-medium text-[#6b6b6b]">
              Active Hotspots
            </p>

            <p className="mt-2 text-3xl font-bold text-[#1e40af]">
              {clusters.length}
            </p>

            <p className="mt-1 text-xs text-[#9b9b9b]">
              Concentrated infrastructure needs
            </p>
          </div>

          <div className="card p-5">
            <p className="text-xs font-medium text-[#6b6b6b]">
              High Priority
            </p>

            <p className="mt-2 text-3xl font-bold text-[#dc2626]">
              {highPriority}
            </p>

            <p className="mt-1 text-xs text-[#9b9b9b]">
              Requires urgent attention
            </p>
          </div>

          <div className="card p-5">
            <p className="text-xs font-medium text-[#6b6b6b]">
              Hotspot Coverage
            </p>

            <p className="mt-2 text-3xl font-bold text-[#1e1e1e]">
              {hotspotCoverage}%
            </p>

            <p className="mt-1 text-xs text-[#9b9b9b]">
              Citizen demand in hotspots
            </p>
          </div>

        </div>

        {/* PROBLEM STATEMENT ALIGNMENT */}
        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">

          <div className="rounded-xl border border-[#e5e5e5] bg-white p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1e40af]/5">
                <Users className="h-5 w-5 text-[#1e40af]" />
              </div>

              <div>
                <p className="text-xs text-[#6b6b6b]">
                  Citizen Demand
                </p>

                <p className="text-sm font-semibold text-[#1e1e1e]">
                  {reports.length} reports analysed
                </p>
              </div>
            </div>

            <p className="mt-3 text-xs leading-5 text-[#6b6b6b]">
              Citizen-submitted infrastructure needs are consolidated into one policy view.
            </p>
          </div>

          <div className="rounded-xl border border-[#e5e5e5] bg-white p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1e40af]/5">
                <Target className="h-5 w-5 text-[#1e40af]" />
              </div>

              <div>
                <p className="text-xs text-[#6b6b6b]">
                  Development Priorities
                </p>

                <p className="text-sm font-semibold text-[#1e1e1e]">
                  {categories.length} issue categories
                </p>
              </div>
            </div>

            <p className="mt-3 text-xs leading-5 text-[#6b6b6b]">
              Repeated demand is translated into infrastructure priorities for local action.
            </p>
          </div>

          <div className="rounded-xl border border-[#e5e5e5] bg-white p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1e40af]/5">
                <Activity className="h-5 w-5 text-[#1e40af]" />
              </div>

              <div>
                <p className="text-xs text-[#6b6b6b]">
                  Impact Evidence
                </p>

                <p className="text-sm font-semibold text-[#1e1e1e]">
                  {impactReports} reports with impact data
                </p>
              </div>
            </div>

            <p className="mt-3 text-xs leading-5 text-[#6b6b6b]">
              Reported community impact is surfaced alongside infrastructure priorities.
            </p>
          </div>

        </div>

        {/* MAIN CONTENT */}
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">

          {/* POLICY RECOMMENDATIONS */}
          <div className="lg:col-span-2">

            <div className="card p-6">

              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-[#1e1e1e]">
                    Policy Recommendations
                  </h2>

                  <p className="mt-1 text-sm text-[#6b6b6b]">
                    Development priorities generated from concentrated citizen demand.
                  </p>
                </div>

                <TrendingUp className="h-5 w-5 text-[#1e40af]" />
              </div>

              <div className="mt-6 space-y-4">

                {loading ? (
                  <div className="py-10 text-center text-sm text-[#9b9b9b]">
                    Analysing citizen reports...
                  </div>
                ) : recommendations.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[#d6d3d1] p-8 text-center">

                    <CheckCircle2 className="mx-auto h-8 w-8 text-[#16a34a]" />

                    <p className="mt-3 text-sm font-medium text-[#1e1e1e]">
                      No active hotspots detected
                    </p>

                    <p className="mt-1 text-xs text-[#6b6b6b]">
                      Hotspots appear when three or more reports of the same issue are geographically concentrated.
                    </p>

                  </div>
                ) : (
                  recommendations.map(
                    ({
                      cluster,
                      action,
                      reason,
                      priority,
                      impact,
                    }) => (
                      <div
                        key={cluster.id}
                        className="rounded-xl border border-[#e5e5e5] bg-white p-5"
                      >

                        {/* HEADER */}
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

                          <div className="min-w-0">

                            <div className="flex flex-wrap items-center gap-2">

                              <span className="rounded-md bg-[#1e40af]/5 px-2 py-1 text-xs font-semibold text-[#1e40af]">
                                {cluster.dominantCategory}
                              </span>

                              <span
                                className={`rounded-full border px-2 py-1 text-xs font-medium ${getPriorityStyle(
                                  cluster.priorityLevel
                                )}`}
                              >
                                {cluster.priorityLevel} priority
                              </span>

                            </div>

                            <h3 className="mt-3 text-base font-semibold text-[#1e1e1e]">
                              {cluster.centerLocation}
                            </h3>

                            <p className="mt-1 text-xs text-[#6b6b6b]">
                              {cluster.reportCount} citizen reports · Priority score{' '}
                              {cluster.priorityScore}/100
                            </p>

                          </div>

                          <div className="flex items-center gap-1 rounded-lg bg-[#f8fafc] px-3 py-2">

                            <FileText className="h-4 w-4 text-[#1e40af]" />

                            <span className="text-xs font-medium text-[#1e40af]">
                              {cluster.reportCount} reports
                            </span>

                          </div>

                        </div>

                        {/* DEVELOPMENT PRIORITY */}
                        <div className="mt-4 rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-4">

                          <div className="flex items-center gap-2">
                            <Target className="h-4 w-4 text-[#1e40af]" />

                            <p className="text-xs font-semibold text-[#1e1e1e]">
                              Development Priority
                            </p>
                          </div>

                          <p className="mt-1 text-sm font-semibold text-[#1e40af]">
                            {priority}
                          </p>

                        </div>

                        {/* RECOMMENDED ACTION */}
                        <div className="mt-4 rounded-lg bg-[#f8fafc] p-4">

                          <p className="text-xs font-semibold text-[#1e1e1e]">
                            Recommended Action
                          </p>

                          <p className="mt-1 text-sm font-medium text-[#1e40af]">
                            {action}
                          </p>

                          <p className="mt-2 text-xs leading-5 text-[#6b6b6b]">
                            <strong className="text-[#1e1e1e]">
                              Why:
                            </strong>{' '}
                            {reason}
                          </p>

                        </div>

                        {/* COMMUNITY IMPACT */}
                        <div className="mt-4 rounded-lg border border-[#e5e5e5] p-4">

                          <div className="flex items-center gap-2">

                            <Users className="h-4 w-4 text-[#1e40af]" />

                            <p className="text-xs font-semibold text-[#1e1e1e]">
                              Community Impact
                            </p>

                          </div>

                          <p className="mt-1 text-xs leading-5 text-[#6b6b6b]">
                            {impact}
                          </p>

                        </div>

                        {/* EVIDENCE */}
                        <div className="mt-4 flex flex-wrap gap-4 text-xs text-[#6b6b6b]">

                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {cluster.centerLocation}
                          </span>

                          <span className="flex items-center gap-1">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Avg urgency: {cluster.averageUrgency}
                          </span>

                          <span className="flex items-center gap-1">
                            <TrendingUp className="h-3.5 w-3.5" />
                            {cluster.recentCount} recent
                          </span>

                        </div>

                      </div>
                    )
                  )
                )}

              </div>

            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-6">

            {/* TOP INFRASTRUCTURE NEEDS */}
            <div className="card p-6">

              <h2 className="text-base font-semibold text-[#1e1e1e]">
                Top Infrastructure Needs
              </h2>

              <p className="mt-1 text-xs text-[#6b6b6b]">
                Demand identified from citizen reports
              </p>

              <div className="mt-5 space-y-4">

                {categories.length === 0 ? (
                  <p className="text-xs text-[#9b9b9b]">
                    No citizen reports yet.
                  </p>
                ) : (
                  categories
                    .slice(0, 6)
                    .map(
                      ([category, count], index) => (
                        <div
                          key={category}
                          className="flex items-center gap-3"
                        >

                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1e40af]/5 text-xs font-bold text-[#1e40af]">
                            {index + 1}
                          </div>

                          <div className="min-w-0 flex-1">

                            <p className="truncate text-sm font-medium text-[#1e1e1e]">
                              {category}
                            </p>

                            <p className="text-xs text-[#9b9b9b]">
                              {count} reports
                            </p>

                          </div>

                          <span className="text-sm font-semibold text-[#1e40af]">
                            {count}
                          </span>

                        </div>
                      )
                    )
                )}

              </div>

            </div>

            {/* HOTSPOT COVERAGE */}
            <div className="card p-6">

              <h2 className="text-base font-semibold text-[#1e1e1e]">
                Hotspot Coverage
              </h2>

              <div className="mt-5">

                <p className="text-3xl font-bold text-[#1e1e1e]">
                  {totalHotspotReports}
                </p>

                <p className="mt-1 text-xs text-[#6b6b6b]">
                  reports contributing to detected hotspots
                </p>

              </div>

              <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#e5e5e5]">

                <div
                  className="h-full rounded-full bg-[#1e40af]"
                  style={{
                    width:
                      reports.length > 0
                        ? `${Math.min(
                            (totalHotspotReports /
                              reports.length) *
                              100,
                            100
                          )}%`
                        : '0%',
                  }}
                />

              </div>

              <p className="mt-2 text-xs text-[#9b9b9b]">
                {hotspotCoverage}% of reports belong to hotspots
              </p>

            </div>

            {/* POLICY FLOW */}
            <div className="card p-6">

              <h2 className="text-base font-semibold text-[#1e1e1e]">
                Citizen-to-Policy Flow
              </h2>

              <div className="mt-5 space-y-4">

                <div className="flex gap-3">

                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1e40af] text-xs font-bold text-white">
                    1
                  </div>

                  <div>
                    <p className="text-sm font-medium text-[#1e1e1e]">
                      Citizen feedback
                    </p>

                    <p className="text-xs text-[#6b6b6b]">
                      Community issues are collected as reports.
                    </p>
                  </div>

                </div>

                <div className="flex gap-3">

                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1e40af] text-xs font-bold text-white">
                    2
                  </div>

                  <div>
                    <p className="text-sm font-medium text-[#1e1e1e]">
                      AI analysis
                    </p>

                    <p className="text-xs text-[#6b6b6b]">
                      Issues, categories and urgency are analysed.
                    </p>
                  </div>

                </div>

                <div className="flex gap-3">

                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1e40af] text-xs font-bold text-white">
                    3
                  </div>

                  <div>
                    <p className="text-sm font-medium text-[#1e1e1e]">
                      Demand hotspots
                    </p>

                    <p className="text-xs text-[#6b6b6b]">
                      Repeated local infrastructure needs are identified.
                    </p>
                  </div>

                </div>

                <div className="flex gap-3">

                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1e40af] text-xs font-bold text-white">
                    4
                  </div>

                  <div>
                    <p className="text-sm font-medium text-[#1e1e1e]">
                      Development priority
                    </p>

                    <p className="text-xs text-[#6b6b6b]">
                      Concentrated needs are mapped to infrastructure priorities.
                    </p>
                  </div>

                </div>

                <div className="flex gap-3">

                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1e40af] text-xs font-bold text-white">
                    5
                  </div>

                  <div>
                    <p className="text-sm font-medium text-[#1e1e1e]">
                      Policy action
                    </p>

                    <p className="text-xs text-[#6b6b6b]">
                      Recommended actions are presented for governance review.
                    </p>
                  </div>

                </div>

              </div>

            </div>

          </div>
        </div>

        {/* BOTTOM SECTION */}
        <div className="mt-8 rounded-xl border border-[#dbe4ff] bg-[#eff4ff] p-6">

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <div>

              <h2 className="text-base font-semibold text-[#1e1e1e]">
                From citizen demand to development priority
              </h2>

              <p className="mt-1 max-w-3xl text-sm leading-6 text-[#6b6b6b]">
                CivicLens AI consolidates citizen feedback, identifies concentrated infrastructure needs, prioritizes them using urgency and repeated demand, and translates those needs into actionable governance recommendations.
              </p>

            </div>

            <ArrowRight className="hidden h-5 w-5 text-[#1e40af] sm:block" />

          </div>

        </div>

      </div>
    </div>
  );
}