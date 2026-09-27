import type { CivicReport } from './supabase';
import { formatDate } from './utils';

export type Cluster = {
  id: string;
  reportCount: number;
  centerLocation: string;
  centerLatitude: number | null;
  centerLongitude: number | null;
  dominantCategory: string;
  issueTypes: string[];
  averageUrgency: string;
  recentCount: number;
  dateRangeStart: string;
  dateRangeEnd: string;
  reportIds: string[];
  reports: CivicReport[];
};

const EARTH_RADIUS_KM = 6371;
const CLUSTER_RADIUS_KM = 1.5;
const RECENT_DAYS = 7;
const URGENCY_VALUES: Record<string, number> = {
  Low: 1,
  Medium: 2,
  High: 3,
  Critical: 4,
};

function haversineKm(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

function normalizeLocation(loc: string): string {
  return loc
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .split(',')[0]
    .trim();
}

function isRecent(dateStr: string): boolean {
  const diff = Date.now() - new Date(dateStr).getTime();
  return diff <= RECENT_DAYS * 24 * 60 * 60 * 1000;
}

function avgUrgencyValue(reports: CivicReport[]): string {
  const values: number[] = [];
  reports.forEach((r) => {
    const u = r.ai_urgency;
    if (u && URGENCY_VALUES[u]) values.push(URGENCY_VALUES[u]);
  });
  if (values.length === 0) return 'Unknown';
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  const rounded = Math.round(avg);
  const label = Object.entries(URGENCY_VALUES).find(([, v]) => v === rounded)?.[0];
  return label ?? 'Medium';
}

function buildCluster(reports: CivicReport[]): Cluster {
  const catMap = new Map<string, number>();
  const issueTypes = new Set<string>();
  const locParts: string[] = [];

  reports.forEach((r) => {
    catMap.set(r.category, (catMap.get(r.category) ?? 0) + 1);
    if (r.ai_issue_type) issueTypes.add(r.ai_issue_type);
    const part = r.location.split(',')[0].trim();
    if (!locParts.includes(part)) locParts.push(part);
  });

  const dominantCategory = [...catMap.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const recentCount = reports.filter((r) => isRecent(r.created_at)).length;

  const sortedByDate = [...reports].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  const latReports = reports.filter((r) => r.latitude != null && r.longitude != null);
  const centerLatitude = latReports.length > 0
    ? latReports.reduce((s, r) => s + (r.latitude as number), 0) / latReports.length
    : null;
  const centerLongitude = latReports.length > 0
    ? latReports.reduce((s, r) => s + (r.longitude as number), 0) / latReports.length
    : null;

  return {
    id: `cluster-${reports.map((r) => r.id).sort().join('-').slice(0, 36)}`,
    reportCount: reports.length,
    centerLocation: locParts.join(', '),
    centerLatitude,
    centerLongitude,
    dominantCategory,
    issueTypes: [...issueTypes],
    averageUrgency: avgUrgencyValue(reports),
    recentCount,
    dateRangeStart: formatDate(sortedByDate[0].created_at),
    dateRangeEnd: formatDate(sortedByDate[sortedByDate.length - 1].created_at),
    reportIds: reports.map((r) => r.id),
    reports,
  };
}

export function detectHotspots(reports: CivicReport[]): Cluster[] {
  if (reports.length < 3) return [];

  const geoReports = reports.filter((r) => r.latitude != null && r.longitude != null);
  const textReports = reports.filter((r) => r.latitude == null || r.longitude == null);

  const clusters: Cluster[] = [];

  // --- Geographic clustering (DBSCAN-style) for reports with coordinates ---
  if (geoReports.length >= 3) {
    const visited = new Set<string>();
    const assigned = new Set<string>();

    for (const report of geoReports) {
      if (visited.has(report.id)) continue;
      visited.add(report.id);

      const neighbors = geoReports.filter(
        (r) =>
          !visited.has(r.id) &&
          haversineKm(
            report.latitude as number, report.longitude as number,
            r.latitude as number, r.longitude as number,
          ) <= CLUSTER_RADIUS_KM,
      );

      const group = [report, ...neighbors];
      // Expand: check neighbors of neighbors
      const queue = [...neighbors];
      while (queue.length > 0) {
        const next = queue.shift()!;
        if (assigned.has(next.id)) continue;
        const nextNeighbors = geoReports.filter(
          (r) =>
            !visited.has(r.id) &&
            !assigned.has(r.id) &&
            haversineKm(
              next.latitude as number, next.longitude as number,
              r.latitude as number, r.longitude as number,
            ) <= CLUSTER_RADIUS_KM,
        );
        for (const nn of nextNeighbors) {
          if (!group.includes(nn)) {
            group.push(nn);
            queue.push(nn);
          }
        }
      }

      group.forEach((r) => {
        visited.add(r.id);
        assigned.add(r.id);
      });

      if (group.length >= 3) {
        clusters.push(buildCluster(group));
      }
    }
  }

  // --- Text-based clustering for reports without coordinates ---
  if (textReports.length >= 3) {
    const textGroups = new Map<string, CivicReport[]>();
    textReports.forEach((r) => {
      const key = normalizeLocation(r.location);
      const existing = textGroups.get(key) ?? [];
      existing.push(r);
      textGroups.set(key, existing);
    });

    textGroups.forEach((group) => {
      if (group.length >= 3) {
        clusters.push(buildCluster(group));
      }
    });
  }

  return clusters.sort((a, b) => b.reportCount - a.reportCount);
}
