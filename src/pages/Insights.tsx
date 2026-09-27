import { useEffect, useState, useCallback } from 'react';
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
} from 'lucide-react';
import { supabase, type CivicInsight, type CivicReport } from '@/lib/supabase';
import { detectHotspots, type Cluster } from '@/lib/clustering';
import { getAffectedInfrastructureTypes } from '@/lib/infrastructure';
import PageHeader from '@/components/PageHeader';
import { formatRelative } from '@/lib/utils';
import { Building2 } from 'lucide-react';

type ExplanationState = {
  loading: boolean;
  text: string | null;
  error: boolean;
};

export default function Insights() {
  const [insights, setInsights] = useState<CivicInsight[]>([]);
  const [reports, setReports] = useState<CivicReport[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null);
  const [explanationStates, setExplanationStates] = useState<Map<string, ExplanationState>>(new Map());

  useEffect(() => {
    async function fetchData() {
      const [{ data: insightData }, { data: reportData }] = await Promise.all([
        supabase.from('civic_insights').select('*').order('created_at', { ascending: false }),
        supabase.from('civic_reports').select('*').order('created_at', { ascending: false }),
      ]);
      setInsights(insightData ?? []);
      setReports(reportData ?? []);
      setClusters(detectHotspots(reportData ?? []));
      setLoading(false);
    }
    fetchData();
  }, []);

  const fetchExplanation = useCallback(async (cluster: Cluster) => {
    const clusterId = cluster.id;

    setExplanationStates((prev) => {
      const next = new Map(prev);
      next.set(clusterId, { loading: true, text: null, error: false });
      return next;
    });

    const catMap = new Map<string, number>();
    cluster.reports.forEach((r) => catMap.set(r.category, (catMap.get(r.category) ?? 0) + 1));

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
      categoryBreakdown: [...catMap.entries()].map(([category, count]) => ({ category, count })),
    };

    try {
      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/explain-cluster`;
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ clusters: [payload] }),
      });

      if (response.ok) {
        const data = await response.json();
        const expl = data.explanations?.[0];
        if (expl?.explanation) {
          setExplanationStates((prev) => {
            const next = new Map(prev);
            next.set(clusterId, { loading: false, text: expl.explanation, error: false });
            return next;
          });
          return;
        }
      }

      setExplanationStates((prev) => {
        const next = new Map(prev);
        next.set(clusterId, { loading: false, text: null, error: true });
        return next;
      });
    } catch {
      setExplanationStates((prev) => {
        const next = new Map(prev);
        next.set(clusterId, { loading: false, text: null, error: true });
        return next;
      });
    }
  }, []);

  const toggleCluster = useCallback((clusterId: string, cluster: Cluster) => {
    setExpandedCluster((prev) => {
      if (prev === clusterId) return null;
      // Fetch explanation only if we haven't tried yet
      setExplanationStates((states) => {
        if (!states.has(clusterId)) {
          fetchExplanation(cluster);
        }
        return states;
      });
      return clusterId;
    });
  }, [fetchExplanation]);

  if (loading) {
    return (
      <div>
        <PageHeader title="Insights" subtitle="AI-discovered community patterns and emerging intelligence." />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-[#1e40af]" />
        </div>
      </div>
    );
  }

  const hasStoredInsights = insights.length > 0;
  const hasClusters = clusters.length > 0;
  const hasOverallData = reports.length > 0;

  const overallStats: { title: string; stats: { label: string; value: string }[]; description: string }[] = [];
  if (hasOverallData) {
    const catMap = new Map<string, number>();
    reports.forEach((r) => catMap.set(r.category, (catMap.get(r.category) ?? 0) + 1));
    const topCat = [...catMap.entries()].sort((a, b) => b[1] - a[1])[0];
    if (topCat) {
      const pct = Math.round((topCat[1] / reports.length) * 100);
      overallStats.push({
        title: `${topCat[0]} is the most reported issue`,
        stats: [
          { label: 'Reports', value: `${topCat[1]} of ${reports.length}` },
          { label: 'Share', value: `${pct}%` },
        ],
        description: `${topCat[0]} accounts for ${topCat[1]} of ${reports.length} total reports (${pct}%), making it the dominant category in current data.`,
      });
    }
  }

  const hasAnyContent = hasStoredInsights || hasClusters || hasOverallData;

  return (
    <div>
      <PageHeader title="Insights" subtitle="AI-discovered community patterns and emerging intelligence." />
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
        {!hasAnyContent ? (
          <div className="card flex flex-col items-center p-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1e40af]/5">
              <Lightbulb className="h-7 w-7 text-[#1e40af]" />
            </div>
            <h3 className="mt-5 text-lg font-semibold text-[#1e1e1e]">No insights yet</h3>
            <p className="mt-2 max-w-md text-sm text-[#6b6b6b]">
              AI-discovered patterns will appear here once enough reports are collected.
              The system analyzes report data to identify emerging trends, geographic
              concentrations, and cross-category relationships.
            </p>
            <Link to="/report" className="btn-primary mt-6">
              Report an Issue
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <>
            {/* Stored AI insights */}
            {hasStoredInsights && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-[#1e40af]" />
                  <h3 className="text-base font-semibold text-[#1e1e1e]">AI-Discovered Patterns</h3>
                </div>
                {insights.map((insight, idx) => (
                  <div
                    key={insight.id}
                    className="card animate-fade-in p-6"
                    style={{ animationDelay: `${idx * 80}ms` }}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center rounded-md bg-[#1e40af]/5 px-2 py-0.5 text-xs font-medium text-[#1e40af]">
                            {insight.category}
                          </span>
                          <span className="text-xs text-[#9b9b9b]">
                            {formatRelative(insight.created_at)}
                          </span>
                        </div>
                        <h4 className="mt-2 text-lg font-semibold text-[#1e1e1e]">
                          {insight.title}
                        </h4>
                        <p className="mt-2 text-sm text-[#4a4a4a]">{insight.summary}</p>
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
                              style={{ width: `${insight.confidence}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-[#1e40af]">
                            {insight.confidence}%
                          </span>
                        </div>
                        <span className="text-xs text-[#9b9b9b]">confidence</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Geographic hotspot insights */}
            {hasClusters ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <CircleDot className="h-5 w-5 text-[#1e40af]" />
                  <h3 className="text-base font-semibold text-[#1e1e1e]">
                    Geographic Hotspot Insights
                  </h3>
                </div>
                <p className="text-sm text-[#6b6b6b]">
                  Clusters detected from report locations. Click a hotspot to view its
                  AI-generated insight. Statistics are calculated from real report data.
                </p>

                {clusters.map((cluster, idx) => {
                  const catMap = new Map<string, number>();
                  cluster.reports.forEach((r) => catMap.set(r.category, (catMap.get(r.category) ?? 0) + 1));
                  const catBreakdown = [...catMap.entries()].sort((a, b) => b[1] - a[1]);
                  const dominantShare = Math.round((catBreakdown[0][1] / cluster.reportCount) * 100);
                  const isExpanded = expandedCluster === cluster.id;
                  const explState = explanationStates.get(cluster.id);

                  return (
                    <div
                      key={cluster.id}
                      className="card animate-fade-in overflow-hidden"
                      style={{ animationDelay: `${idx * 80}ms` }}
                    >
                      {/* Cluster header — always visible, clickable */}
                      <button
                        onClick={() => toggleCluster(cluster.id, cluster)}
                        className="flex w-full items-center gap-2.5 border-b border-[#e5e5e5] bg-[#1e40af]/5 px-6 py-4 text-left transition-colors hover:bg-[#1e40af]/10"
                      >
                        <MapPin className="h-5 w-5 flex-shrink-0 text-[#1e40af]" />
                        <div className="min-w-0 flex-1">
                          <h4 className="text-base font-semibold text-[#1e1e1e]">
                            {cluster.centerLocation}
                          </h4>
                          <p className="mt-0.5 text-xs text-[#6b6b6b]">
                            {cluster.reportCount} reports · {cluster.dominantCategory}
                          </p>
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

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="space-y-5 p-6">
                          {/* AI explanation — on-demand */}
                          {explState?.loading ? (
                            <div className="rounded-lg bg-[#1e40af]/5 px-4 py-4">
                              <div className="flex items-center gap-2 text-xs font-medium text-[#1e40af]">
                                <Sparkles className="h-3 w-3" />
                                AI Insight
                              </div>
                              <div className="mt-2 flex items-center gap-2 text-sm text-[#6b6b6b]">
                                <Loader2 className="h-4 w-4 animate-spin text-[#1e40af]" />
                                Generating AI insight from cluster statistics...
                              </div>
                            </div>
                          ) : explState?.text ? (
                            <div className="rounded-lg bg-[#1e40af]/5 px-4 py-4">
                              <div className="flex items-center gap-1.5 text-xs font-medium text-[#1e40af]">
                                <Sparkles className="h-3 w-3" />
                                AI Insight
                              </div>
                              <p className="mt-1.5 text-sm text-[#1e1e1e]">{explState.text}</p>
                            </div>
                          ) : explState?.error ? (
                            <div className="rounded-lg bg-yellow-50 px-4 py-4">
                              <div className="flex items-center gap-1.5 text-xs font-medium text-yellow-700">
                                <AlertCircle className="h-3 w-3" />
                                AI Insight
                              </div>
                              <p className="mt-1.5 text-sm text-yellow-700">
                                AI insight temporarily unavailable. The statistics below are
                                calculated from real report data.
                              </p>
                              <button
                                onClick={() => fetchExplanation(cluster)}
                                className="mt-2 text-xs font-medium text-yellow-800 underline hover:text-yellow-900"
                              >
                                Retry
                              </button>
                            </div>
                          ) : null}

                          {/* Supporting statistics grid */}
                          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                            <div className="rounded-lg border border-[#e5e5e5] px-4 py-3">
                              <p className="text-xs font-medium text-[#6b6b6b]">Total Reports</p>
                              <p className="mt-1 text-xl font-semibold text-[#1e1e1e]">
                                {cluster.reportCount}
                              </p>
                            </div>
                            <div className="rounded-lg border border-[#e5e5e5] px-4 py-3">
                              <p className="text-xs font-medium text-[#6b6b6b]">Dominant Issue</p>
                              <p className="mt-1 text-sm font-semibold text-[#1e1e1e]">
                                {cluster.dominantCategory}
                              </p>
                              <p className="text-xs text-[#1e40af]">{dominantShare}% share</p>
                            </div>
                            <div className="rounded-lg border border-[#e5e5e5] px-4 py-3">
                              <p className="text-xs font-medium text-[#6b6b6b]">Avg Urgency</p>
                              <p className="mt-1 text-sm font-semibold text-[#1e1e1e]">
                                {cluster.averageUrgency}
                              </p>
                            </div>
                            <div className="rounded-lg border border-[#e5e5e5] px-4 py-3">
                              <p className="text-xs font-medium text-[#6b6b6b]">Recent (7 days)</p>
                              <p className="mt-1 text-xl font-semibold text-[#1e1e1e]">
                                {cluster.recentCount}
                              </p>
                            </div>
                          </div>

                          {/* Category breakdown */}
                          <div>
                            <p className="flex items-center gap-1 text-xs font-medium text-[#6b6b6b]">
                              <Tag className="h-3 w-3" /> Category Breakdown
                            </p>
                            <div className="mt-2 space-y-2">
                              {catBreakdown.map(([cat, count]) => {
                                const pct = Math.round((count / cluster.reportCount) * 100);
                                return (
                                  <div key={cat}>
                                    <div className="flex items-center justify-between text-xs">
                                      <span className="font-medium text-[#1e1e1e]">{cat}</span>
                                      <span className="text-[#6b6b6b]">{count} ({pct}%)</span>
                                    </div>
                                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#f0f0f0]">
                                      <div
                                        className="h-full rounded-full bg-[#1e40af] transition-all duration-500"
                                        style={{ width: `${pct}%` }}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {/* Issue types + date range */}
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {cluster.issueTypes.length > 0 && (
                              <div>
                                <p className="flex items-center gap-1 text-xs font-medium text-[#6b6b6b]">
                                  <Tag className="h-3 w-3" /> Issue Types
                                </p>
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {cluster.issueTypes.map((type, i) => (
                                    <span
                                      key={i}
                                      className="inline-flex items-center rounded-full bg-[#1e40af]/5 px-2.5 py-1 text-xs font-medium text-[#1e40af]"
                                    >
                                      {type}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            <div>
                              <p className="flex items-center gap-1 text-xs font-medium text-[#6b6b6b]">
                                <Calendar className="h-3 w-3" /> Date Range
                              </p>
                              <p className="mt-2 text-sm font-medium text-[#1e1e1e]">
                                {cluster.dateRangeStart} — {cluster.dateRangeEnd}
                              </p>
                            </div>
                          </div>

                          {/* Infrastructure Context */}
                          <div className="rounded-lg border border-[#e5e5e5] px-4 py-4">
                            <div className="flex items-center gap-1.5 text-xs font-medium text-[#1e1e1e]">
                              <Building2 className="h-3.5 w-3.5 text-[#1e40af]" />
                              Infrastructure Context
                            </div>
                            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                              {getAffectedInfrastructureTypes(
                                cluster.reports.map((r) => r.category),
                              ).map(({ type, category }) => (
                                <div
                                  key={type}
                                  className="rounded-md bg-[#faf9f7] px-3 py-2.5"
                                >
                                  <p className="text-xs font-medium text-[#9b9b9b]">
                                    From {category} reports
                                  </p>
                                  <p className="mt-0.5 text-sm font-semibold text-[#1e1e1e]">
                                    {type}
                                  </p>
                                </div>
                              ))}
                            </div>
                            <div className="mt-3 border-t border-[#e5e5e5] pt-3">
                              <p className="text-xs font-medium text-[#6b6b6b]">
                                Infrastructure coverage in this area
                              </p>
                              <p className="mt-1 text-sm italic text-[#9b9b9b]">
                                Data unavailable — infrastructure coverage data is not connected.
                                Affected infrastructure types above are derived from citizen
                                report categories only.
                              </p>
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
                  No geographic hotspot clusters detected yet. Clusters appear when
                  3+ reports are found near the same location.
                </p>
              </div>
            ) : null}

            {/* Overall derived statistics */}
            {overallStats.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-[#1e40af]" />
                  <h3 className="text-base font-semibold text-[#1e1e1e]">
                    Patterns From Current Reports
                  </h3>
                </div>
                {overallStats.map((obs) => (
                  <div key={obs.title} className="card animate-fade-in p-6">
                    <h4 className="text-lg font-semibold text-[#1e1e1e]">{obs.title}</h4>
                    <p className="mt-2 text-sm text-[#4a4a4a]">{obs.description}</p>
                    <div className="mt-4 flex gap-6">
                      {obs.stats.map((stat) => (
                        <div key={stat.label}>
                          <p className="text-xs font-medium text-[#6b6b6b]">{stat.label}</p>
                          <p className="mt-0.5 text-lg font-semibold text-[#1e40af]">
                            {stat.value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
