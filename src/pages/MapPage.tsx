import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin,
  Loader2,
  FileText,
  ArrowRight,
  Layers,
  CircleDot,
  X,
  Calendar,
  Zap,
  Tag,
  TrendingUp,
} from 'lucide-react';
import { supabase, type CivicReport } from '@/lib/supabase';
import { detectHotspots, type Cluster } from '@/lib/clustering';
import PageHeader from '@/components/PageHeader';
import { formatRelative, formatDate } from '@/lib/utils';

const categoryColors: Record<string, string> = {
  Potholes: '#b45309',
  'Street Lighting': '#ca8a04',
  Sanitation: '#16a34a',
  Graffiti: '#9333ea',
  Noise: '#db2777',
  'Public Safety': '#dc2626',
  Water: '#0891b2',
  Parks: '#15803d',
  Traffic: '#2563eb',
  Other: '#6b6b6b',
};

type SelectedItem =
  | { type: 'report'; data: CivicReport }
  | { type: 'cluster'; data: Cluster }
  | null;

export default function MapPage() {
  const [reports, setReports] = useState<CivicReport[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SelectedItem>(null);

  const fetchReports = useCallback(async () => {
    const { data } = await supabase
      .from('civic_reports')
      .select('*')
      .order('created_at', { ascending: false });
    const reportList = data ?? [];
    setReports(reportList);
    setClusters(detectHotspots(reportList));
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchReports();
    // Auto-refresh every 15 seconds so new reports appear automatically
    const interval = setInterval(fetchReports, 15000);
    return () => clearInterval(interval);
  }, [fetchReports]);

  // Compute marker positions: reports with GPS coords use real lat/lng,
  // reports without coords are distributed in a deterministic pseudo-grid.
  const geoReports = reports.filter((r) => r.latitude != null && r.longitude != null);
  const textReports = reports.filter((r) => r.latitude == null || r.longitude == null);

  // Map lat/lng to percentage positions on the map container
  const latLngToXY = (lat: number, lng: number) => {
    if (geoReports.length === 0) return { x: 50, y: 50 };
    const lats = geoReports.map((r) => r.latitude as number);
    const lngs = geoReports.map((r) => r.longitude as number);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const latRange = maxLat - minLat || 1;
    const lngRange = maxLng - minLng || 1;
    const x = ((lng - minLng) / lngRange) * 70 + 15;
    const y = 85 - ((lat - minLat) / latRange) * 70;
    return { x: Math.max(5, Math.min(95, x)), y: Math.max(5, Math.min(95, y)) };
  };

  // Cluster centers
  const geoClusters = clusters.filter((c) => c.centerLatitude != null && c.centerLongitude != null);
  const textClusters = clusters.filter((c) => c.centerLatitude == null || c.centerLongitude == null);

  // Determine cluster size on map based on report count
  const clusterSize = (count: number) => {
    if (count >= 10) return 56;
    if (count >= 7) return 48;
    if (count >= 5) return 42;
    return 36;
  };

  return (
    <div>
      <PageHeader
        title="Map"
        subtitle="Citizen reports and automatically discovered geographic hotspots."
      />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Map area */}
          <div className="lg:col-span-2">
            {/* Stats bar above map */}
                {clusters.length > 0 && (
                  <div className="mb-3 flex items-center gap-3 text-sm">
                    <span className="flex items-center gap-1.5 font-medium text-[#1e1e1e]">
                      <CircleDot className="h-4 w-4 text-[#1e40af]" />
                      {clusters.length} hotspot{clusters.length !== 1 ? 's' : ''}
                    </span>
                    <span className="flex items-center gap-1.5 text-[#6b6b6b]">
                      <Layers className="h-4 w-4" />
                      {reports.length} report{reports.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
            <div className="card relative flex h-[500px] items-center justify-center overflow-hidden lg:h-[600px]">
              {loading ? (
                <Loader2 className="h-8 w-8 animate-spin text-[#1e40af]" />
              ) : reports.length === 0 ? (
                <div className="flex flex-col items-center text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1e40af]/5">
                    <MapPin className="h-7 w-7 text-[#1e40af]" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-[#1e1e1e]">
                    No reports to display
                  </h3>
                  <p className="mt-2 max-w-sm text-sm text-[#6b6b6b]">
                    As citizens submit reports with location data, they'll appear as
                    pins on this map. Clusters of 3+ nearby reports are highlighted
                    as hotspots automatically.
                  </p>
                  <Link to="/report" className="btn-primary mt-6">
                    Report an Issue
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              ) : (
                <div className="absolute inset-0 bg-[#f5f5f4]">
                  {/* Grid pattern to simulate map */}
                  <div
                    className="absolute inset-0 opacity-40"
                    style={{
                      backgroundImage: `
                        linear-gradient(to right, #e0ddd8 1px, transparent 1px),
                        linear-gradient(to bottom, #e0ddd8 1px, transparent 1px)
                      `,
                      backgroundSize: '40px 40px',
                    }}
                  />

                  {/* Cluster zones (semi-transparent circles) */}
                  {geoClusters.map((cluster) => {
                    const { x, y } = latLngToXY(
                      cluster.centerLatitude as number,
                      cluster.centerLongitude as number,
                    );
                    const size = clusterSize(cluster.reportCount);
                    const color = categoryColors[cluster.dominantCategory] ?? '#1e40af';
                    return (
                      <div
                        key={cluster.id}
                        className="absolute -translate-x-1/2 -translate-y-1/2"
                        style={{ left: `${x}%`, top: `${y}%` }}
                      >
                        <div
                          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full opacity-15"
                          style={{
                            width: size * 2.5,
                            height: size * 2.5,
                            backgroundColor: color,
                          }}
                        />
                      </div>
                    );
                  })}

                  {/* Text-based cluster zones */}
                  {textClusters.map((cluster, idx) => {
                    const col = idx % 3;
                    const row = Math.floor(idx / 3);
                    const x = 20 + col * 30;
                    const y = 20 + row * 25;
                    const size = clusterSize(cluster.reportCount);
                    const color = categoryColors[cluster.dominantCategory] ?? '#1e40af';
                    return (
                      <div
                        key={cluster.id}
                        className="absolute -translate-x-1/2 -translate-y-1/2"
                        style={{ left: `${x}%`, top: `${y}%` }}
                      >
                        <div
                          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full opacity-15"
                          style={{
                            width: size * 2.5,
                            height: size * 2.5,
                            backgroundColor: color,
                          }}
                        />
                      </div>
                    );
                  })}

                  {/* Cluster markers */}
                  {geoClusters.map((cluster) => {
                    const { x, y } = latLngToXY(
                      cluster.centerLatitude as number,
                      cluster.centerLongitude as number,
                    );
                    const size = clusterSize(cluster.reportCount);
                    const color = categoryColors[cluster.dominantCategory] ?? '#1e40af';
                    return (
                      <button
                        key={cluster.id}
                        onClick={() => setSelected({ type: 'cluster', data: cluster })}
                        className="absolute -translate-x-1/2 -translate-y-1/2 z-20 transition-transform hover:scale-110"
                        style={{ left: `${x}%`, top: `${y}%` }}
                      >
                        <div
                          className="flex items-center justify-center rounded-full border-2 border-white font-semibold text-white shadow-lg"
                          style={{ width: size, height: size, backgroundColor: color, fontSize: size >= 48 ? '16px' : '14px' }}
                        >
                          {cluster.reportCount}
                        </div>
                      </button>
                    );
                  })}

                  {/* Text-based cluster markers */}
                  {textClusters.map((cluster, idx) => {
                    const col = idx % 3;
                    const row = Math.floor(idx / 3);
                    const x = 20 + col * 30;
                    const y = 20 + row * 25;
                    const size = clusterSize(cluster.reportCount);
                    const color = categoryColors[cluster.dominantCategory] ?? '#1e40af';
                    return (
                      <button
                        key={cluster.id}
                        onClick={() => setSelected({ type: 'cluster', data: cluster })}
                        className="absolute -translate-x-1/2 -translate-y-1/2 z-20 transition-transform hover:scale-110"
                        style={{ left: `${x}%`, top: `${y}%` }}
                      >
                        <div
                          className="flex items-center justify-center rounded-full border-2 border-white font-semibold text-white shadow-lg"
                          style={{ width: size, height: size, backgroundColor: color, fontSize: size >= 48 ? '16px' : '14px' }}
                        >
                          {cluster.reportCount}
                        </div>
                      </button>
                    );
                  })}

                  {/* Individual report markers (GPS-based) */}
                  {geoReports
                    .filter((r) => !clusters.some((c) => c.reportIds.includes(r.id)))
                    .map((report) => {
                      const { x, y } = latLngToXY(
                        report.latitude as number,
                        report.longitude as number,
                      );
                      const color = categoryColors[report.category] ?? '#1e40af';
                      return (
                        <button
                          key={report.id}
                          onClick={() => setSelected({ type: 'report', data: report })}
                          className="absolute -translate-x-1/2 -translate-y-1/2 z-10 transition-transform hover:scale-125"
                          style={{ left: `${x}%`, top: `${y}%` }}
                        >
                          <div
                            className="h-4 w-4 rounded-full border-2 border-white shadow-md"
                            style={{ backgroundColor: color }}
                          />
                        </button>
                      );
                    })}

                  {/* Individual report markers (text-based, not in clusters) */}
                  {textReports
                    .filter((r) => !clusters.some((c) => c.reportIds.includes(r.id)))
                    .map((report, idx) => {
                      const cols = 8;
                      const col = idx % cols;
                      const row = Math.floor(idx / cols) + (textClusters.length > 0 ? 4 : 0);
                      const x = 10 + (col * 80 / cols) + (idx % 3) * 3;
                      const y = 10 + (row * 12) + (idx % 2) * 4;
                      const color = categoryColors[report.category] ?? '#1e40af';
                      return (
                        <button
                          key={report.id}
                          onClick={() => setSelected({ type: 'report', data: report })}
                          className="absolute -translate-x-1/2 -translate-y-1/2 z-10 transition-transform hover:scale-125"
                          style={{
                            left: `${Math.min(x, 90)}%`,
                            top: `${Math.min(y, 85)}%`,
                          }}
                        >
                          <div
                            className="h-4 w-4 rounded-full border-2 border-white shadow-md"
                            style={{ backgroundColor: color }}
                          />
                        </button>
                      );
                    })}
                </div>
              )}
            </div>
          </div>

          {/* Side panel */}
          <div className="space-y-4">
            {/* Legend */}
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-[#1e1e1e]">Legend</h3>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {Object.entries(categoryColors).map(([cat, color]) => (
                  <div key={cat} className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full border border-white shadow-sm"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-xs text-[#6b6b6b]">{cat}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 border-t border-[#e5e5e5] pt-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[#1e40af] text-xs font-semibold text-white shadow">
                    N
                  </div>
                  <span className="text-xs text-[#6b6b6b]">Hotspot cluster (N = report count)</span>
                </div>
              </div>
            </div>

            {/* Selected item details */}
            {selected ? (
              <div className="card animate-fade-in p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#1e1e1e]">
                    {selected.type === 'cluster' ? 'Cluster Details' : 'Report Details'}
                  </h3>
                  <button
                    onClick={() => setSelected(null)}
                    className="text-[#9b9b9b] hover:text-[#1e1e1e]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {selected.type === 'cluster' ? (
                  <div className="mt-4 space-y-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium text-white"
                          style={{ backgroundColor: categoryColors[selected.data.dominantCategory] ?? '#1e40af' }}
                        >
                          {selected.data.dominantCategory}
                        </span>
                        <span className="text-xs font-medium text-[#1e40af]">
                          {selected.data.reportCount} reports
                        </span>
                      </div>
                      <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-[#1e1e1e]">
                        <MapPin className="h-4 w-4 text-[#1e40af]" />
                        {selected.data.centerLocation}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="flex items-center gap-1 font-medium text-[#6b6b6b]">
                          <Zap className="h-3 w-3" /> Avg Urgency
                        </p>
                        <p className="mt-1 font-medium text-[#1e1e1e]">{selected.data.averageUrgency}</p>
                      </div>
                      <div>
                        <p className="flex items-center gap-1 font-medium text-[#6b6b6b]">
                          <TrendingUp className="h-3 w-3" /> Recent
                        </p>
                        <p className="mt-1 font-medium text-[#1e1e1e]">
                          {selected.data.recentCount} in last 7 days
                        </p>
                      </div>
                      <div className="col-span-2">
                        <p className="flex items-center gap-1 font-medium text-[#6b6b6b]">
                          <Calendar className="h-3 w-3" /> Date Range
                        </p>
                        <p className="mt-1 font-medium text-[#1e1e1e]">
                          {selected.data.dateRangeStart} — {selected.data.dateRangeEnd}
                        </p>
                      </div>
                    </div>

                    {selected.data.issueTypes.length > 0 && (
                      <div>
                        <p className="flex items-center gap-1 text-xs font-medium text-[#6b6b6b]">
                          <Tag className="h-3 w-3" /> Issue Types
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {selected.data.issueTypes.map((type, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center rounded-full bg-[#1e40af]/5 px-2.5 py-1 text-xs font-medium text-[#1e40af]"
                            >
                              {type}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <p className="text-xs font-medium text-[#6b6b6b]">Reports in this cluster</p>
                      <div className="mt-2 max-h-32 space-y-2 overflow-y-auto">
                        {selected.data.reports.slice(0, 6).map((r) => (
                          <div key={r.id} className="rounded-md border border-[#e5e5e5] px-3 py-2">
                            <p className="truncate text-xs text-[#1e1e1e]">{r.description}</p>
                            <p className="text-[10px] text-[#9b9b9b]">{formatRelative(r.created_at)}</p>
                          </div>
                        ))}
                        {selected.data.reports.length > 6 && (
                          <p className="text-[10px] text-[#9b9b9b]">
                            +{selected.data.reports.length - 6} more
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium"
                        style={{
                          backgroundColor: `${categoryColors[selected.data.category]}15`,
                          color: categoryColors[selected.data.category],
                        }}
                      >
                        {selected.data.category}
                      </span>
                      <span className="text-xs text-[#9b9b9b]">
                        {formatRelative(selected.data.created_at)}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-[#1e1e1e]">{selected.data.description}</p>
                    <p className="mt-2 flex items-center gap-1 text-xs text-[#6b6b6b]">
                      <MapPin className="h-3 w-3" />
                      {selected.data.location}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-[#1e1e1e]">Report List</h3>
                <p className="mt-1 text-xs text-[#6b6b6b]">
                  Click a pin or cluster to see details
                </p>
                <div className="mt-4 max-h-[300px] space-y-3 overflow-y-auto">
                  {reports.length === 0 ? (
                    <p className="text-xs text-[#9b9b9b]">No reports available</p>
                  ) : (
                    reports.slice(0, 12).map((report) => (
                      <button
                        key={report.id}
                        onClick={() => setSelected({ type: 'report', data: report })}
                        className="flex w-full items-start gap-2 rounded-lg border border-[#e5e5e5] px-3 py-2 text-left transition-colors hover:border-[#1e40af]"
                      >
                        <FileText className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[#1e40af]" />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-[#1e1e1e]">
                            {report.category}
                          </p>
                          <p className="truncate text-xs text-[#6b6b6b]">
                            {report.location}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
