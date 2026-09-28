import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Lightbulb,
  Loader2,
  ArrowRight,
  Sparkles,
  MapPin,
  TrendingUp,
  CircleDot,
  Zap,
  Calendar,
  Tag,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  FileText,
  CheckCircle2,
} from 'lucide-react';

import {
  supabase,
  type CivicInsight,
  type CivicReport,
} from '@/lib/supabase';

import {
  detectHotspots,
  type Cluster,
} from '@/lib/clustering';

import { getAffectedInfrastructureTypes } from '@/lib/infrastructure';
import PageHeader from '@/components/PageHeader';
import { formatRelative } from '@/lib/utils';

type ExplanationState = {
  loading: boolean;
  text: string | null;
  error: boolean;
};

type Recommendation = {
  cluster: Cluster;
  action: string;
  reason: string;
};

function getCategory(report: CivicReport): string {
  return (
    report.ai_category?.trim() ||
    report.category?.trim() ||
    'Other'
  );
}

function getRecommendation(cluster: Cluster): {
  action: string;
  reason: string;
} {
  const category = cluster.dominantCategory.toLowerCase();

  if (category.includes('pothole')) {
    return {
      action: 'Road repair and pothole resurfacing',
      reason:
        'Multiple citizen reports indicate recurring road-safety problems in this area.',
    };
  }

  if (
    category.includes('street') ||
    category.includes('lighting')
  ) {
    return {
      action: 'Inspect and restore street lighting',
      reason:
        'Repeated reports indicate a local street-lighting service gap affecting residents.',
    };
  }

  if (category.includes('water')) {
    return {
      action: 'Inspect drainage and water infrastructure',
      reason:
        'Multiple reports indicate a recurring water or drainage-related infrastructure issue.',
    };
  }

  if (category.includes('sanitation')) {
    return {
      action: 'Schedule sanitation inspection and cleanup',
      reason:
        'Repeated sanitation reports indicate an area-level public-service gap.',
    };
  }

  if (category.includes('traffic')) {
    return {
      action: 'Assess traffic management and road safety',
      reason:
        'Multiple citizen reports indicate a recurring traffic or mobility concern.',
    };
  }

  if (category.includes('public safety')) {
    return {
      action: 'Conduct a public-safety assessment',
      reason:
        'Recent citizen reports indicate a concentrated public-safety concern.',
    };
  }

  if (category.includes('parks')) {
    return {
      action: 'Inspect and maintain public park infrastructure',
      reason:
        'Multiple reports indicate a recurring issue affecting public recreational facilities.',
    };
  }

  if (category.includes('noise')) {
    return {
      action: 'Investigate recurring noise complaints',
      reason:
        'Repeated citizen reports indicate a localized noise concern requiring assessment.',
    };
  }

  if (category.includes('graffiti')) {
    return {
      action: 'Schedule cleanup and site inspection',
      reason:
        'Repeated reports indicate a recurring public-space maintenance issue.',
    };
  }

  return {
    action: 'Conduct a local infrastructure assessment',
    reason:
      'Multiple citizen reports indicate a recurring issue requiring local authority review.',
  };
}

export default function Insights() {
  const [insights, setInsights] = useState<CivicInsight[]>([]);
  const [reports, setReports] = useState<CivicReport[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);

  const [expandedCluster, setExpandedCluster] =
    useState<string | null>(null);

  const [explanationStates, setExplanationStates] =
    useState<Map<string, ExplanationState>>(new Map());

  const fetchData = useCallback(async () => {
    setLoading(true);

    const [{ data: insightData }, { data: reportData }] =
      await Promise.all([
        supabase
          .from('civic_insights')
          .select('*')
          .order('created_at', {
            ascending: false,
          }),

        supabase
          .from('civic_reports')
          .select('*')
          .order('created_at', {
            ascending: false,
          }),
      ]);

    const reportList = reportData ?? [];

    setInsights(insightData ?? []);
    setReports(reportList);
    setClusters(detectHotspots(reportList));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchExplanation = useCallback(
    async (cluster: Cluster) => {
      const clusterId = cluster.id;

      setExplanationStates((prev) => {
        const next = new Map(prev);

        next.set(clusterId, {
          loading: true,
          text: null,
          error: false,
        });

        return next;
      });

      const catMap = new Map<string, number>();

      cluster.reports.forEach((r) => {
        const category = getCategory(r);

        catMap.set(
          category,
          (catMap.get(category) ?? 0) + 1,
        );
      });

      const payload = {
        clusterId,
        reportCount: cluster.reportCount,
        centerLocation: cluster.centerLocation,
        dominantCategory: cluster.dominantCategory,
        issueTypes: cluster.issueTypes,
        averageUrgency: cluster.averageUrgency,
        recentCount: cluster.recentCount,
        dateRangeStart: cluster.dateRangeStart,
        dateRangeEnd: cluster.dateRangeEnd,
        priorityLevel: cluster.priorityLevel,
        priorityScore: cluster.priorityScore,
        priorityReason: cluster.priorityReason,

        categoryBreakdown: [...catMap.entries()].map(
          ([category, count]) => ({
            category,
            count,
          }),
        ),
      };

      try {
        const functionUrl =
          `${import.meta.env.VITE_SUPABASE_URL}` +
          `/functions/v1/explain-cluster`;

        const response = await fetch(functionUrl, {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
            Authorization:
              `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },

          body: JSON.stringify({
            clusters: [payload],
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const explanation = data.explanations?.[0];

          if (explanation?.explanation) {
            setExplanationStates((prev) => {
              const next = new Map(prev);

              next.set(clusterId, {
                loading: false,
                text: explanation.explanation,
                error: false,
              });

              return next;
            });

            return;
          }
        }

        setExplanationStates((prev) => {
          const next = new Map(prev);

          next.set(clusterId, {
            loading: false,
            text: null,
            error: true,
          });

          return next;
        });
      } catch {
        setExplanationStates((prev) => {
          const next = new Map(prev);

          next.set(clusterId, {
            loading: false,
            text: null,
            error: true,
          });

          return next;
        });
      }
    },
    [],
  );

  const toggleCluster = useCallback(
    (clusterId: string, cluster: Cluster) => {
      setExpandedCluster((prev) => {
        if (prev === clusterId) {
          return null;
        }

        setExplanationStates((states) => {
          if (!states.has(clusterId)) {
            fetchExplanation(cluster);
          }

          return states;
        });

        return clusterId;
      });
    },
    [fetchExplanation],
  );

  /*
   * POLICY RECOMMENDATIONS
   */

  const recommendations = useMemo<Recommendation[]>(
    () =>
      clusters.map((cluster) => ({
        cluster,
        ...getRecommendation(cluster),
      })),
    [clusters],
  );

  const totalHotspotReports = useMemo(
    () =>
      clusters.reduce(
        (sum, cluster) =>
          sum + cluster.reportCount,
        0,
      ),
    [clusters],
  );

  /*
   * CATEGORY COUNTS
   */

  const categories = useMemo(() => {
    const counts = new Map<string, number>();

    reports.forEach((report) => {
      const category = getCategory(report);

      counts.set(
        category,
        (counts.get(category) ?? 0) + 1,
      );
    });

    return [...counts.entries()].sort(
      (a, b) => b[1] - a[1],
    );
  }, [reports]);

  /*
   * OVERALL INSIGHT
   */

  const overallStats = useMemo(() => {
    if (reports.length === 0) {
      return [];
    }

    const catMap = new Map<string, number>();

    reports.forEach((report) => {
      const category = getCategory(report);

      catMap.set(
        category,
        (catMap.get(category) ?? 0) + 1,
      );
    });

    const topCategory = [...catMap.entries()].sort(
      (a, b) => b[1] - a[1],
    )[0];

    if (!topCategory) {
      return [];
    }

    const percentage = Math.round(
      (topCategory[1] / reports.length) * 100,
    );

    return [
      {
        title:
          `${topCategory[0]} is the most reported issue`,

        stats: [
          {
            label: 'Reports',
            value:
              `${topCategory[1]} of ${reports.length}`,
          },
          {
            label: 'Share',
            value: `${percentage}%`,
          },
        ],

        description:
          `${topCategory[0]} accounts for ` +
          `${topCategory[1]} of ${reports.length} ` +
          `total reports (${percentage}%), making it ` +
          `the dominant category in current data.`,
      },
    ];
  }, [reports]);

  const hasStoredInsights = insights.length > 0;
  const hasClusters = clusters.length > 0;
  const hasOverallData = reports.length > 0;

  const hasAnyContent =
    hasStoredInsights ||
    hasClusters ||
    hasOverallData;

  if (loading) {
    return (
      <div>
        <PageHeader
          title="Insights"
          subtitle="AI-discovered community patterns and emerging intelligence."
        />

        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-[#1e40af]" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Insights"
        subtitle="AI-discovered community patterns and emerging intelligence."
      />

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">

        {/* EMPTY STATE */}

        {!hasAnyContent ? (
          <div className="card flex flex-col items-center p-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1e40af]/5">
              <Lightbulb className="h-7 w-7 text-[#1e40af]" />
            </div>

            <h3 className="mt-5 text-lg font-semibold text-[#1e1e1e]">
              No insights yet
            </h3>

            <p className="mt-2 max-w-md text-sm text-[#6b6b6b]">
              AI-discovered patterns will appear here once
              enough reports are collected.
            </p>

            <Link
              to="/report"
              className="btn-primary mt-6"
            >
              Report an Issue
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <>
            {/* =====================================================
                STORED AI INSIGHTS
            ====================================================== */}

            {hasStoredInsights && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-[#1e40af]" />

                  <h3 className="text-base font-semibold text-[#1e1e1e]">
                    AI-Discovered Patterns
                  </h3>
                </div>

                {insights.map((insight, index) => (
                  <div
                    key={insight.id}
                    className="card animate-fade-in p-6"
                    style={{
                      animationDelay:
                        `${index * 80}ms`,
                    }}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

                      <div className="flex-1">
                        <div className="flex items-center gap-2">

                          <span className="inline-flex items-center rounded-md bg-[#1e40af]/5 px-2 py-0.5 text-xs font-medium text-[#1e40af]">
                            {insight.category}
                          </span>

                          <span className="text-xs text-[#9b9b9b]">
                            {formatRelative(
                              insight.created_at,
                            )}
                          </span>

                        </div>

                        <h4 className="mt-2 text-lg font-semibold text-[#1e1e1e]">
                          {insight.title}
                        </h4>

                        <p className="mt-2 text-sm text-[#4a4a4a]">
                          {insight.summary}
                        </p>

                        {insight.areas_affected && (
                          <p className="mt-3 flex items-center gap-1.5 text-xs text-[#6b6b6b]">
                            <MapPin className="h-3 w-3" />
                            {insight.areas_affected}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-1 sm:ml-6">
                        <div className="flex items-center gap-1.5">

                          <div className="h-2 w-24 overflow-hidden rounded-full bg-[#f0f0f0]">
                            <div
                              className="h-full rounded-full bg-[#1e40af]"
                              style={{
                                width:
                                  `${insight.confidence}%`,
                              }}
                            />
                          </div>

                          <span className="text-xs font-semibold text-[#1e40af]">
                            {insight.confidence}%
                          </span>

                        </div>

                        <span className="text-xs text-[#9b9b9b]">
                          confidence
                        </span>
                      </div>

                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* =====================================================
                GEOGRAPHIC HOTSPOTS
            ====================================================== */}

            {hasClusters ? (
              <div className="space-y-4">

                <div className="flex items-center gap-2">
                  <CircleDot className="h-5 w-5 text-[#1e40af]" />

                  <h3 className="text-base font-semibold text-[#1e1e1e]">
                    Geographic Hotspot Insights
                  </h3>
                </div>

                <p className="text-sm text-[#6b6b6b]">
                  Clusters detected from real citizen
                  reports. Click a hotspot to view its
                  AI-generated explanation, priority,
                  evidence and infrastructure context.
                </p>

                {clusters.map((cluster, index) => {
                  const catMap =
                    new Map<string, number>();

                  cluster.reports.forEach((report) => {
                    const category =
                      getCategory(report);

                    catMap.set(
                      category,
                      (catMap.get(category) ?? 0) + 1,
                    );
                  });

                  const catBreakdown =
                    [...catMap.entries()].sort(
                      (a, b) => b[1] - a[1],
                    );

                  const dominantShare =
                    catBreakdown.length > 0
                      ? Math.round(
                          (catBreakdown[0][1] /
                            cluster.reportCount) *
                            100,
                        )
                      : 0;

                  const isExpanded =
                    expandedCluster === cluster.id;

                  const explanation =
                    explanationStates.get(
                      cluster.id,
                    );

                  return (
                    <div
                      key={cluster.id}
                      className="card animate-fade-in overflow-hidden"
                      style={{
                        animationDelay:
                          `${index * 80}ms`,
                      }}
                    >

                      {/* HOTSPOT HEADER */}

                      <button
                        type="button"
                        onClick={() =>
                          toggleCluster(
                            cluster.id,
                            cluster,
                          )
                        }
                        className="flex w-full items-center gap-2.5 border-b border-[#e5e5e5] bg-[#1e40af]/5 px-6 py-4 text-left transition-colors hover:bg-[#1e40af]/10"
                      >

                        <MapPin className="h-5 w-5 flex-shrink-0 text-[#1e40af]" />

                        <div className="min-w-0 flex-1">

                          <h4 className="text-base font-semibold text-[#1e1e1e]">
                            {cluster.centerLocation}
                          </h4>

                          <div className="mt-1 flex flex-wrap items-center gap-2">

                            <p className="text-xs text-[#6b6b6b]">
                              {cluster.reportCount} reports ·{' '}
                              {cluster.dominantCategory}
                            </p>

                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                cluster.priorityLevel ===
                                'High'
                                  ? 'bg-red-50 text-red-700'
                                  : cluster.priorityLevel ===
                                      'Medium'
                                    ? 'bg-yellow-50 text-yellow-700'
                                    : 'bg-green-50 text-green-700'
                              }`}
                            >
                              {cluster.priorityLevel}{' '}
                              Priority
                            </span>

                          </div>
                        </div>

                        <span className="inline-flex items-center rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-[#1e40af]">
                          {cluster.reportCount}
                        </span>

                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 flex-shrink-0 text-[#6b6b6b]" />
                        ) : (
                          <ChevronDown className="h-5 w-5 flex-shrink-0 text-[#6b6b6b]" />
                        )}

                      </button>

                      {/* EXPANDED HOTSPOT DETAILS */}

                      {isExpanded && (
                        <div className="space-y-5 p-6">

                          {/* AI EXPLANATION */}

                          {explanation?.loading ? (
                            <div className="rounded-lg bg-[#1e40af]/5 px-4 py-4">

                              <div className="flex items-center gap-2 text-xs font-medium text-[#1e40af]">
                                <Sparkles className="h-3 w-3" />
                                AI Insight
                              </div>

                              <div className="mt-2 flex items-center gap-2 text-sm text-[#6b6b6b]">
                                <Loader2 className="h-4 w-4 animate-spin text-[#1e40af]" />
                                Generating AI insight...
                              </div>

                            </div>
                          ) : explanation?.text ? (
                            <div className="rounded-lg bg-[#1e40af]/5 px-4 py-4">

                              <div className="flex items-center gap-1.5 text-xs font-medium text-[#1e40af]">
                                <Sparkles className="h-3 w-3" />
                                AI Insight
                              </div>

                              <p className="mt-1.5 text-sm text-[#1e1e1e]">
                                {explanation.text}
                              </p>

                            </div>
                          ) : explanation?.error ? (
                            <div className="rounded-lg bg-yellow-50 px-4 py-4">

                              <div className="flex items-center gap-1.5 text-xs font-medium text-yellow-700">
                                <AlertCircle className="h-3 w-3" />
                                AI Insight
                              </div>

                              <p className="mt-1.5 text-sm text-yellow-700">
                                AI insight temporarily
                                unavailable. The
                                statistics below are
                                calculated from real
                                report data.
                              </p>

                              <button
                                type="button"
                                onClick={() =>
                                  fetchExplanation(
                                    cluster,
                                  )
                                }
                                className="mt-2 text-xs font-medium text-yellow-800 underline"
                              >
                                Retry
                              </button>

                            </div>
                          ) : null}

                          {/* DEVELOPMENT PRIORITY */}

                          <div className="rounded-lg border border-[#e5e5e5] bg-[#faf9f7] px-4 py-4">

                            <div className="flex items-start justify-between gap-4">

                              <div>

                                <div className="flex items-center gap-1.5">
                                  <Zap className="h-4 w-4 text-[#1e40af]" />

                                  <p className="text-xs font-medium text-[#6b6b6b]">
                                    Development Priority
                                  </p>
                                </div>

                                <p className="mt-1 text-lg font-semibold text-[#1e1e1e]">
                                  {cluster.priorityLevel}
                                </p>

                                <p className="mt-1 text-xs text-[#6b6b6b]">
                                  Based on report
                                  concentration,
                                  urgency and recent
                                  citizen activity.
                                </p>

                              </div>

                              <div className="text-right">

                                <p className="text-xs text-[#6b6b6b]">
                                  Priority Score
                                </p>

                                <p className="mt-1 text-2xl font-semibold text-[#1e40af]">
                                  {cluster.priorityScore}
                                </p>

                                <p className="text-xs text-[#9b9b9b]">
                                  / 100
                                </p>

                              </div>

                            </div>

                            <p className="mt-3 border-t border-[#e5e5e5] pt-3 text-xs text-[#4a4a4a]">
                              <span className="font-medium">
                                Why:
                              </span>{' '}
                              {cluster.priorityReason}.
                            </p>

                          </div>

                          {/* SUPPORTING STATISTICS */}

                          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">

                            <div className="rounded-lg border border-[#e5e5e5] px-4 py-3">
                              <p className="text-xs font-medium text-[#6b6b6b]">
                                Total Reports
                              </p>

                              <p className="mt-1 text-xl font-semibold text-[#1e1e1e]">
                                {cluster.reportCount}
                              </p>
                            </div>

                            <div className="rounded-lg border border-[#e5e5e5] px-4 py-3">
                              <p className="text-xs font-medium text-[#6b6b6b]">
                                Dominant Issue
                              </p>

                              <p className="mt-1 text-sm font-semibold text-[#1e1e1e]">
                                {cluster.dominantCategory}
                              </p>

                              <p className="text-xs text-[#1e40af]">
                                {dominantShare}% share
                              </p>
                            </div>

                            <div className="rounded-lg border border-[#e5e5e5] px-4 py-3">
                              <p className="text-xs font-medium text-[#6b6b6b]">
                                Avg Urgency
                              </p>

                              <p className="mt-1 text-sm font-semibold text-[#1e1e1e]">
                                {cluster.averageUrgency}
                              </p>
                            </div>

                            <div className="rounded-lg border border-[#e5e5e5] px-4 py-3">
                              <p className="text-xs font-medium text-[#6b6b6b]">
                                Recent
                              </p>

                              <p className="mt-1 text-xl font-semibold text-[#1e1e1e]">
                                {cluster.recentCount}
                              </p>
                            </div>

                          </div>

                          {/* CATEGORY BREAKDOWN */}

                          <div>

                            <p className="flex items-center gap-1 text-xs font-medium text-[#6b6b6b]">
                              <Tag className="h-3 w-3" />
                              Category Breakdown
                            </p>

                            <div className="mt-2 space-y-2">

                              {catBreakdown.map(
                                ([category, count]) => {
                                  const percentage =
                                    Math.round(
                                      (count /
                                        cluster.reportCount) *
                                        100,
                                    );

                                  return (
                                    <div
                                      key={category}
                                    >

                                      <div className="flex items-center justify-between text-xs">

                                        <span className="font-medium text-[#1e1e1e]">
                                          {category}
                                        </span>

                                        <span className="text-[#6b6b6b]">
                                          {count} (
                                          {percentage}
                                          %)
                                        </span>

                                      </div>

                                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#f0f0f0]">

                                        <div
                                          className="h-full rounded-full bg-[#1e40af]"
                                          style={{
                                            width:
                                              `${percentage}%`,
                                          }}
                                        />

                                      </div>

                                    </div>
                                  );
                                },
                              )}

                            </div>
                          </div>

                          {/* DATE RANGE */}

                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                            {cluster.issueTypes.length > 0 && (
                              <div>

                                <p className="flex items-center gap-1 text-xs font-medium text-[#6b6b6b]">
                                  <Tag className="h-3 w-3" />
                                  Issue Types
                                </p>

                                <div className="mt-2 flex flex-wrap gap-1.5">

                                  {cluster.issueTypes.map(
                                    (type, index) => (
                                      <span
                                        key={index}
                                        className="inline-flex items-center rounded-full bg-[#1e40af]/5 px-2.5 py-1 text-xs font-medium text-[#1e40af]"
                                      >
                                        {type}
                                      </span>
                                    ),
                                  )}

                                </div>

                              </div>
                            )}

                            <div>

                              <p className="flex items-center gap-1 text-xs font-medium text-[#6b6b6b]">
                                <Calendar className="h-3 w-3" />
                                Date Range
                              </p>

                              <p className="mt-2 text-sm font-medium text-[#1e1e1e]">
                                {cluster.dateRangeStart} —{' '}
                                {cluster.dateRangeEnd}
                              </p>

                            </div>

                          </div>

                          {/* INFRASTRUCTURE CONTEXT */}

                          <div className="rounded-lg border border-[#e5e5e5] px-4 py-4">

                            <div className="flex items-center gap-1.5 text-xs font-medium text-[#1e1e1e]">
                              <FileText className="h-3.5 w-3.5 text-[#1e40af]" />
                              Infrastructure Context
                            </div>

                            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">

                              {getAffectedInfrastructureTypes(
                                cluster.reports.map(
                                  (report) =>
                                    getCategory(report),
                                ),
                              ).map(
                                ({
                                  type,
                                  category,
                                }) => (
                                  <div
                                    key={type}
                                    className="rounded-md bg-[#faf9f7] px-3 py-2.5"
                                  >
                                    <p className="text-xs font-medium text-[#9b9b9b]">
                                      From {category}{' '}
                                      reports
                                    </p>

                                    <p className="mt-0.5 text-sm font-semibold text-[#1e1e1e]">
                                      {type}
                                    </p>
                                  </div>
                                ),
                              )}

                            </div>

                          </div>

                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            ) : hasOverallData ? (
              <div className="rounded-lg bg-[#faf9f7] px-6 py-6 text-center">

                <MapPin className="mx-auto h-6 w-6 text-[#9b9b9b]" />

                <p className="mt-3 text-sm text-[#6b6b6b]">
                  No geographic hotspot clusters
                  detected yet.
                </p>

                <p className="mt-1 text-xs text-[#9b9b9b]">
                  Clusters appear when 3 or more reports
                  are found near the same location.
                </p>

              </div>
            ) : null}

            {/* =====================================================
                PATTERNS FROM REPORTS
            ====================================================== */}

            {overallStats.length > 0 && (
              <div className="space-y-4">

                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-[#1e40af]" />

                  <h3 className="text-base font-semibold text-[#1e1e1e]">
                    Patterns From Current Reports
                  </h3>
                </div>

                {overallStats.map((observation) => (
                  <div
                    key={observation.title}
                    className="card animate-fade-in p-6"
                  >

                    <h4 className="text-lg font-semibold text-[#1e1e1e]">
                      {observation.title}
                    </h4>

                    <p className="mt-2 text-sm text-[#4a4a4a]">
                      {observation.description}
                    </p>

                    <div className="mt-4 flex gap-6">

                      {observation.stats.map(
                        (stat) => (
                          <div key={stat.label}>

                            <p className="text-xs font-medium text-[#6b6b6b]">
                              {stat.label}
                            </p>

                            <p className="mt-0.5 text-lg font-semibold text-[#1e40af]">
                              {stat.value}
                            </p>

                          </div>
                        ),
                      )}

                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* =====================================================
                POLICY RECOMMENDATIONS
            ====================================================== */}

            <section
              id="policy-recommendations"
              className="space-y-4"
            >

              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

                <div>

                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-[#1e40af]" />

                    <h3 className="text-lg font-semibold text-[#1e1e1e]">
                      Policy Recommendations
                    </h3>
                  </div>

                  <p className="mt-1 text-sm text-[#6b6b6b]">
                    Development priorities generated from
                    citizen demand hotspots and supporting
                    evidence.
                  </p>

                </div>

                <Link
                  to="/policy"
                  className="inline-flex items-center gap-2 text-sm font-medium text-[#1e40af] hover:underline"
                >
                  Open Policy Dashboard
                  <ArrowRight className="h-4 w-4" />
                </Link>

              </div>

              {recommendations.length === 0 ? (
                <div className="card rounded-xl border border-dashed border-[#d6d3d1] p-8 text-center">

                  <CheckCircle2 className="mx-auto h-8 w-8 text-[#16a34a]" />

                  <p className="mt-3 text-sm font-medium text-[#1e1e1e]">
                    No policy recommendations yet
                  </p>

                  <p className="mt-1 text-xs text-[#6b6b6b]">
                    Recommendations appear when repeated
                    citizen reports form a geographic hotspot.
                  </p>

                </div>
              ) : (
                <div className="space-y-4">

                  {recommendations.map(
                    ({
                      cluster,
                      action,
                      reason,
                    }) => (
                      <div
                        key={cluster.id}
                        className="card rounded-xl p-6"
                      >

                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

                          <div className="min-w-0">

                            <div className="flex flex-wrap items-center gap-2">

                              <span className="rounded-md bg-[#1e40af]/5 px-2.5 py-1 text-xs font-semibold text-[#1e40af]">
                                {cluster.dominantCategory}
                              </span>

                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                                  cluster.priorityLevel ===
                                  'High'
                                    ? 'bg-red-50 text-red-700'
                                    : cluster.priorityLevel ===
                                        'Medium'
                                      ? 'bg-yellow-50 text-yellow-700'
                                      : 'bg-green-50 text-green-700'
                                }`}
                              >
                                {cluster.priorityLevel}{' '}
                                priority
                              </span>

                              <span className="rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                                Evidence from{' '}
                                {cluster.reportCount}{' '}
                                reports
                              </span>

                            </div>

                            <h4 className="mt-3 text-base font-semibold text-[#1e1e1e]">
                              {cluster.centerLocation}
                            </h4>

                            <p className="mt-1 text-xs text-[#6b6b6b]">
                              {cluster.reportCount}{' '}
                              citizen reports · Priority{' '}
                              {cluster.priorityScore}/100
                            </p>

                          </div>

                          <div className="flex items-center gap-1 rounded-lg bg-[#f8fafc] px-3 py-2">

                            <FileText className="h-4 w-4 text-[#1e40af]" />

                            <span className="text-xs font-medium text-[#1e40af]">
                              {cluster.reportCount}{' '}
                              reports
                            </span>

                          </div>

                        </div>

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

                        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">

                          <div className="rounded-lg border border-[#e5e5e5] px-3 py-3">

                            <p className="text-xs text-[#9b9b9b]">
                              Reports
                            </p>

                            <p className="mt-1 text-sm font-semibold text-[#1e1e1e]">
                              {cluster.reportCount}
                            </p>

                          </div>

                          <div className="rounded-lg border border-[#e5e5e5] px-3 py-3">

                            <p className="text-xs text-[#9b9b9b]">
                              Avg. Urgency
                            </p>

                            <p className="mt-1 text-sm font-semibold text-[#1e1e1e]">
                              {cluster.averageUrgency}
                            </p>

                          </div>

                          <div className="rounded-lg border border-[#e5e5e5] px-3 py-3">

                            <p className="text-xs text-[#9b9b9b]">
                              Recent
                            </p>

                            <p className="mt-1 text-sm font-semibold text-[#1e1e1e]">
                              {cluster.recentCount}
                            </p>

                          </div>

                          <div className="rounded-lg border border-[#e5e5e5] px-3 py-3">

                            <p className="text-xs text-[#9b9b9b]">
                              Priority
                            </p>

                            <p className="mt-1 text-sm font-semibold text-[#1e1e1e]">
                              {cluster.priorityScore}/100
                            </p>

                          </div>

                        </div>

                      </div>
                    ),
                  )}

                </div>
              )}

            </section>

            {/* =====================================================
                GOVERNANCE WORKFLOW
            ====================================================== */}

            <section
              id="governance-workflow"
              className="card rounded-xl p-6"
            >

              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

                <div>

                  <div className="flex items-center gap-2">

                    <TrendingUp className="h-5 w-5 text-[#1e40af]" />

                    <h3 className="text-lg font-semibold text-[#1e1e1e]">
                      Governance Workflow
                    </h3>

                  </div>

                  <p className="mt-1 text-sm text-[#6b6b6b]">
                    How CivicLens AI converts citizen feedback
                    into evidence-backed development priorities.
                  </p>

                </div>

                <Link
                  to="/policy"
                  className="inline-flex items-center gap-2 text-sm font-medium text-[#1e40af] hover:underline"
                >
                  Policy Dashboard
                  <ArrowRight className="h-4 w-4" />
                </Link>

              </div>

              <div className="mt-6 space-y-5">

                {/* STEP 1 */}

                <div className="flex gap-4">

                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#1e40af] text-sm font-bold text-white">
                    1
                  </div>

                  <div>

                    <p className="text-sm font-semibold text-[#1e1e1e]">
                      Citizen feedback
                    </p>

                    <p className="mt-1 text-xs leading-5 text-[#6b6b6b]">
                      Reports are collected from citizens
                      through the CivicLens AI reporting system.
                    </p>

                  </div>

                </div>

                {/* STEP 2 */}

                <div className="flex gap-4">

                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#1e40af] text-sm font-bold text-white">
                    2
                  </div>

                  <div>

                    <p className="text-sm font-semibold text-[#1e1e1e]">
                      AI analysis
                    </p>

                    <p className="mt-1 text-xs leading-5 text-[#6b6b6b]">
                      Issue category, issue type, urgency,
                      summary and community impact are
                      analysed from citizen reports.
                    </p>

                  </div>

                </div>

                {/* STEP 3 */}

                <div className="flex gap-4">

                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#1e40af] text-sm font-bold text-white">
                    3
                  </div>

                  <div>

                    <p className="text-sm font-semibold text-[#1e1e1e]">
                      Demand hotspots
                    </p>

                    <p className="mt-1 text-xs leading-5 text-[#6b6b6b]">
                      Repeated reports are grouped geographically
                      to identify concentrated infrastructure needs.
                    </p>

                  </div>

                </div>

                {/* STEP 4 */}

                <div className="flex gap-4">

                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#1e40af] text-sm font-bold text-white">
                    4
                  </div>

                  <div>

                    <p className="text-sm font-semibold text-[#1e1e1e]">
                      Evidence assessment
                    </p>

                    <p className="mt-1 text-xs leading-5 text-[#6b6b6b]">
                      Report volume, urgency, recency and
                      geographic concentration strengthen the
                      evidence for each identified hotspot.
                    </p>

                  </div>

                </div>

                {/* STEP 5 */}

                <div className="flex gap-4">

                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#1e40af] text-sm font-bold text-white">
                    5
                  </div>

                  <div>

                    <p className="text-sm font-semibold text-[#1e1e1e]">
                      Policy action
                    </p>

                    <p className="mt-1 text-xs leading-5 text-[#6b6b6b]">
                      CivicLens AI translates the evidence into
                      recommended infrastructure actions for
                      governance review.
                    </p>

                  </div>

                </div>

              </div>

              {/* GOVERNANCE SUMMARY */}

              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">

                <div className="rounded-lg bg-[#f8fafc] px-4 py-4">

                  <p className="text-xs text-[#6b6b6b]">
                    Citizen Reports
                  </p>

                  <p className="mt-1 text-2xl font-bold text-[#1e1e1e]">
                    {reports.length}
                  </p>

                  <p className="mt-1 text-xs text-[#9b9b9b]">
                    Total submitted
                  </p>

                </div>

                <div className="rounded-lg bg-[#f8fafc] px-4 py-4">

                  <p className="text-xs text-[#6b6b6b]">
                    Active Hotspots
                  </p>

                  <p className="mt-1 text-2xl font-bold text-[#1e40af]">
                    {clusters.length}
                  </p>

                  <p className="mt-1 text-xs text-[#9b9b9b]">
                    Concentrated needs
                  </p>

                </div>

                <div className="rounded-lg bg-[#f8fafc] px-4 py-4">

                  <p className="text-xs text-[#6b6b6b]">
                    Reports in Hotspots
                  </p>

                  <p className="mt-1 text-2xl font-bold text-[#1e1e1e]">
                    {totalHotspotReports}
                  </p>

                  <p className="mt-1 text-xs text-[#9b9b9b]">
                    Evidence contributing to priorities
                  </p>

                </div>

              </div>

            </section>

            {/* =====================================================
                TOP INFRASTRUCTURE NEEDS
            ====================================================== */}

            {categories.length > 0 && (
              <section className="card rounded-xl p-6">

                <div className="flex items-center gap-2">

                  <Zap className="h-5 w-5 text-[#1e40af]" />

                  <div>

                    <h3 className="text-base font-semibold text-[#1e1e1e]">
                      Top Infrastructure Needs
                    </h3>

                    <p className="mt-1 text-sm text-[#6b6b6b]">
                      Demand distribution across citizen reports.
                    </p>

                  </div>

                </div>

                <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">

                  {categories
                    .slice(0, 6)
                    .map(
                      ([category, count], index) => (
                        <div
                          key={category}
                          className="flex items-center gap-3 rounded-lg border border-[#e5e5e5] px-4 py-3"
                        >

                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#1e40af]/5 text-xs font-bold text-[#1e40af]">
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
                      ),
                    )}

                </div>

              </section>
            )}

            {/* =====================================================
                FINAL ACTION
            ====================================================== */}

            <div className="rounded-xl border border-[#dbe4ff] bg-[#eff4ff] p-6">

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                <div>

                  <h3 className="text-base font-semibold text-[#1e1e1e]">
                    From citizen demand to development priority
                  </h3>

                  <p className="mt-1 max-w-3xl text-sm leading-6 text-[#6b6b6b]">
                    CivicLens AI combines citizen feedback,
                    AI analysis, geographic hotspots and
                    supporting evidence to produce actionable
                    infrastructure recommendations.
                  </p>

                </div>

                <Link
                  to="/policy"
                  className="inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-lg bg-[#1e40af] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1d4ed8]"
                >
                  View Policy Dashboard
                  <ArrowRight className="h-4 w-4" />
                </Link>

              </div>

            </div>

          </>
        )}

      </div>
    </div>
  );
}
