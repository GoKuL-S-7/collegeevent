"use client";
import { useState, useEffect, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface SecurityAlert {
  _id: string;
  username: string;
  alertType: string;
  description: string;
  severity: "Low" | "Medium" | "High" | "Critical";
  score: number;
  ipAddress: string;
  country: string;
  city: string;
  latitude: number;
  longitude: number;
  metadata: any;
  resolved: boolean;
  resolvedAt?: string;
  createdAt: string;
}

interface SecurityStats {
  total: number;
  critical: number;
  high: number;
  medium: number;
  unresolved: number;
  byType: { _id: string; count: number }[];
  byCountry: { _id: string; count: number }[];
  dailyTrends: { _id: string; count: number }[];
  topRiskyUsers: { _id: string; totalScore: number; alertCount: number }[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const SEVERITY_STYLES: Record<string, string> = {
  Critical: "bg-red-500/20 text-red-300 border-red-500/40 shadow-red-500/20",
  High:     "bg-orange-500/20 text-orange-300 border-orange-500/40 shadow-orange-500/20",
  Medium:   "bg-yellow-500/20 text-yellow-300 border-yellow-500/40 shadow-yellow-500/20",
  Low:      "bg-blue-500/20 text-blue-300 border-blue-500/40 shadow-blue-500/20",
};

const ALERT_ICONS: Record<string, string> = {
  COUNTRY_CHANGE:       "🌍",
  IMPOSSIBLE_TRAVEL:    "✈️",
  VPN_DETECTED:         "🔒",
  TOR_DETECTED:         "🧅",
  MULTIPLE_IP_CHANGES:  "🔄",
  NEW_DEVICE:           "💻",
  NEW_USER_AGENT:       "🌐",
  BRUTE_FORCE:          "⚡",
  SUSPICIOUS_LOCATION:  "📍",
};

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border shadow-sm ${SEVERITY_STYLES[severity] || SEVERITY_STYLES.Low}`}>
      {severity === "Critical" && <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse inline-block" />}
      {severity}
    </span>
  );
}

// Mini bar chart rendered purely with CSS / divs
function MiniBarChart({ data, maxVal }: { data: { label: string; value: number }[]; maxVal: number }) {
  return (
    <div className="flex items-end gap-1 h-20">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full rounded-t-sm bg-gradient-to-t from-purple-600 to-violet-400 transition-all duration-700"
            style={{ height: maxVal > 0 ? `${(d.value / maxVal) * 72}px` : "2px", minHeight: "2px" }}
          />
          <span className="text-gray-500 text-[8px] truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AIMonitorDashboard() {
  const [alerts, setAlerts]   = useState<SecurityAlert[]>([]);
  const [stats, setStats]     = useState<SecurityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Filters
  const [severityFilter, setSeverityFilter] = useState("");
  const [resolvedFilter, setResolvedFilter] = useState("false");
  const [usernameFilter, setUsernameFilter] = useState("");
  const [alertTypeFilter, setAlertTypeFilter] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const params = new URLSearchParams();
      if (severityFilter) params.set("severity", severityFilter);
      if (resolvedFilter !== "") params.set("resolved", resolvedFilter);
      if (usernameFilter) params.set("username", usernameFilter);
      if (alertTypeFilter) params.set("alertType", alertTypeFilter);

      const [alertRes, statsRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/security/alerts?${params}`, { headers }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/security/stats`, { headers }),
      ]);

      if (alertRes.ok) {
        const data = await alertRes.json();
        setAlerts(data.alerts ?? data);
      }
      if (statsRes.ok) setStats(await statsRes.json());
      setLastRefresh(new Date());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [severityFilter, resolvedFilter, usernameFilter, alertTypeFilter]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  // 30-second polling
  useEffect(() => {
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleResolve = async (alertId: string) => {
    setResolving(alertId);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/security/resolve/${alertId}`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        setAlerts(prev => prev.map(a => a._id === alertId ? { ...a, resolved: true } : a));
        if (stats) setStats({ ...stats, unresolved: Math.max(0, stats.unresolved - 1) });
      }
    } finally {
      setResolving(null);
    }
  };

  // Build daily trend labels
  const dailyData = stats?.dailyTrends.map(d => ({
    label: d._id.slice(5),  // "MM-DD"
    value: d.count,
  })) ?? [];
  const maxDaily = Math.max(...dailyData.map(d => d.value), 1);

  return (
    <div className="space-y-6">

      {/* ── Header row ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-2xl">🛡️</span> AI Location Monitor
          </h2>
          <p className="text-gray-500 text-xs mt-0.5">
            Real-time threat detection · Auto-refresh every 30s · Last updated {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); fetchData(); }}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-gray-300 transition-all hover:border-purple-500/40"
        >
          <span className={loading ? "animate-spin" : ""}>↻</span> Refresh
        </button>
      </div>

      {/* ── Stat Cards ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Total Alerts",  value: stats?.total     ?? 0, color: "border-white/10",          text: "text-white" },
          { label: "Critical",      value: stats?.critical   ?? 0, color: "border-red-500/30",        text: "text-red-400",    glow: "shadow-red-500/10" },
          { label: "High",          value: stats?.high       ?? 0, color: "border-orange-500/30",     text: "text-orange-400", glow: "shadow-orange-500/10" },
          { label: "Medium",        value: stats?.medium     ?? 0, color: "border-yellow-500/30",     text: "text-yellow-400", glow: "shadow-yellow-500/10" },
          { label: "Unresolved",    value: stats?.unresolved ?? 0, color: "border-purple-500/30",     text: "text-purple-400", glow: "shadow-purple-500/10" },
        ].map((card) => (
          <div key={card.label} className={`bg-white/3 rounded-2xl p-5 border ${card.color} shadow-lg ${card.glow ?? ""} backdrop-blur-sm`}>
            <p className="text-gray-400 text-xs uppercase tracking-wider">{card.label}</p>
            <p className={`text-3xl font-black mt-2 ${card.text}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* ── Charts Row ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Daily trend */}
        <div className="bg-white/3 rounded-2xl p-5 border border-white/10">
          <h3 className="text-xs text-gray-400 uppercase tracking-widest mb-4 font-bold">
            📈 Alerts — Last 7 Days
          </h3>
          {dailyData.length > 0 ? (
            <MiniBarChart data={dailyData} maxVal={maxDaily} />
          ) : (
            <p className="text-gray-600 text-xs text-center py-6">No data yet</p>
          )}
        </div>

        {/* Top risky users */}
        <div className="bg-white/3 rounded-2xl p-5 border border-white/10">
          <h3 className="text-xs text-gray-400 uppercase tracking-widest mb-4 font-bold">
            🎯 Top Risky Users
          </h3>
          <div className="space-y-2">
            {(stats?.topRiskyUsers ?? []).slice(0, 5).map((u, i) => (
              <div key={u._id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 text-[10px] w-4">{i + 1}.</span>
                  <span className="text-purple-300 text-sm font-medium truncate max-w-[120px]">@{u._id}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-[10px]">{u.alertCount} alerts</span>
                  <span className={`font-mono text-xs font-bold ${u.totalScore >= 70 ? "text-red-400" : "text-yellow-400"}`}>
                    {u.totalScore}pts
                  </span>
                </div>
              </div>
            ))}
            {(!stats?.topRiskyUsers || stats.topRiskyUsers.length === 0) && (
              <p className="text-gray-600 text-xs text-center py-4">No data yet</p>
            )}
          </div>
        </div>

        {/* Top countries */}
        <div className="bg-white/3 rounded-2xl p-5 border border-white/10">
          <h3 className="text-xs text-gray-400 uppercase tracking-widest mb-4 font-bold">
            🌍 Alerts by Country
          </h3>
          <div className="space-y-2">
            {(stats?.byCountry ?? []).slice(0, 6).map((c) => {
              const maxC = stats?.byCountry[0]?.count ?? 1;
              return (
                <div key={c._id} className="flex items-center gap-2">
                  <span className="text-gray-300 text-xs w-24 truncate">{c._id}</span>
                  <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-700"
                      style={{ width: `${(c.count / maxC) * 100}%` }}
                    />
                  </div>
                  <span className="text-gray-500 text-[10px] w-4 text-right">{c.count}</span>
                </div>
              );
            })}
            {(!stats?.byCountry || stats.byCountry.length === 0) && (
              <p className="text-gray-600 text-xs text-center py-4">No data yet</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Filters ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 p-4 bg-white/3 rounded-2xl border border-white/10">
        <input
          type="text"
          placeholder="🔍 Search username…"
          value={usernameFilter}
          onChange={e => setUsernameFilter(e.target.value)}
          className="bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-purple-500 transition-all placeholder:text-gray-600 min-w-[180px]"
        />
        <select
          value={severityFilter}
          onChange={e => setSeverityFilter(e.target.value)}
          className="bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-purple-500 transition-all"
        >
          <option value="">All Severities</option>
          <option value="Critical">🔴 Critical</option>
          <option value="High">🟠 High</option>
          <option value="Medium">🟡 Medium</option>
          <option value="Low">🔵 Low</option>
        </select>
        <select
          value={alertTypeFilter}
          onChange={e => setAlertTypeFilter(e.target.value)}
          className="bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-purple-500 transition-all"
        >
          <option value="">All Alert Types</option>
          <option value="COUNTRY_CHANGE">Country Change</option>
          <option value="IMPOSSIBLE_TRAVEL">Impossible Travel</option>
          <option value="VPN_DETECTED">VPN Detected</option>
          <option value="MULTIPLE_IP_CHANGES">Multiple IPs</option>
          <option value="NEW_DEVICE">New Device</option>
          <option value="NEW_USER_AGENT">New Browser</option>
          <option value="BRUTE_FORCE">Brute Force</option>
        </select>
        <select
          value={resolvedFilter}
          onChange={e => setResolvedFilter(e.target.value)}
          className="bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-purple-500 transition-all"
        >
          <option value="false">⚠️ Unresolved</option>
          <option value="true">✅ Resolved</option>
          <option value="">All Statuses</option>
        </select>
        <span className="ml-auto text-gray-500 text-xs self-center">
          {alerts.length} result{alerts.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Alerts Table ──────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-white/5 text-gray-400 text-[10px] uppercase tracking-widest">
              <th className="px-5 py-4">Alert</th>
              <th className="px-5 py-4">User</th>
              <th className="px-5 py-4">Location / IP</th>
              <th className="px-5 py-4">Severity</th>
              <th className="px-5 py-4">Score</th>
              <th className="px-5 py-4">Time</th>
              <th className="px-5 py-4">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              <tr>
                <td colSpan={7} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-gray-500 text-xs">Loading security data…</span>
                  </div>
                </td>
              </tr>
            ) : alerts.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <span className="text-4xl">✅</span>
                    <span className="text-gray-400 font-medium">No alerts match your filters</span>
                    <span className="text-gray-600 text-xs">The system is monitoring all login sessions in real-time.</span>
                  </div>
                </td>
              </tr>
            ) : (
              alerts.map((alert) => (
                <>
                  <tr
                    key={alert._id}
                    className={`hover:bg-white/3 transition-all cursor-pointer group ${expandedId === alert._id ? "bg-white/5" : ""} ${alert.severity === "Critical" ? "border-l-2 border-red-500/50" : alert.severity === "High" ? "border-l-2 border-orange-500/50" : ""}`}
                    onClick={() => setExpandedId(expandedId === alert._id ? null : alert._id)}
                  >
                    {/* Alert type */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{ALERT_ICONS[alert.alertType] ?? "🚨"}</span>
                        <span className="text-white font-semibold text-xs leading-tight">
                          {alert.alertType.replace(/_/g, " ")}
                        </span>
                      </div>
                    </td>

                    {/* Username */}
                    <td className="px-5 py-4">
                      <span className="text-purple-300 font-mono text-xs">@{alert.username}</span>
                    </td>

                    {/* Location */}
                    <td className="px-5 py-4">
                      <div className="flex flex-col">
                        <span className="text-gray-300 text-xs">
                          {[alert.city, alert.country].filter(Boolean).join(", ") || "Unknown"}
                        </span>
                        <span className="text-gray-600 text-[10px] font-mono">{alert.ipAddress}</span>
                      </div>
                    </td>

                    {/* Severity */}
                    <td className="px-5 py-4">
                      <SeverityBadge severity={alert.severity} />
                    </td>

                    {/* Score */}
                    <td className="px-5 py-4">
                      <span className={`font-mono font-bold text-sm ${alert.score >= 70 ? "text-red-400" : alert.score >= 30 ? "text-yellow-400" : "text-gray-400"}`}>
                        {alert.score}
                      </span>
                    </td>

                    {/* Time */}
                    <td className="px-5 py-4 text-gray-500 text-[10px] whitespace-nowrap">
                      {new Date(alert.createdAt).toLocaleString()}
                    </td>

                    {/* Action */}
                    <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                      {!alert.resolved ? (
                        <button
                          disabled={resolving === alert._id}
                          onClick={() => handleResolve(alert._id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-40"
                        >
                          {resolving === alert._id ? <span className="animate-spin">↻</span> : "✓"} Resolve
                        </button>
                      ) : (
                        <span className="text-green-500/60 text-[10px] font-bold uppercase">Resolved</span>
                      )}
                    </td>
                  </tr>

                  {/* Expanded detail row */}
                  {expandedId === alert._id && (
                    <tr key={`${alert._id}-detail`} className="bg-black/40 border-l-2 border-purple-500/60">
                      <td colSpan={7} className="px-6 py-5">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Description */}
                          <div className="bg-white/3 rounded-xl p-4 border border-white/5">
                            <p className="text-[10px] text-purple-400 uppercase font-bold tracking-widest mb-2">🔍 Alert Detail</p>
                            <p className="text-white text-sm leading-relaxed">{alert.description}</p>
                            {alert.resolvedAt && (
                              <p className="text-green-500/60 text-[10px] mt-3">
                                Resolved at: {new Date(alert.resolvedAt).toLocaleString()}
                              </p>
                            )}
                          </div>

                          {/* Location detail */}
                          <div className="bg-white/3 rounded-xl p-4 border border-white/5">
                            <p className="text-[10px] text-purple-400 uppercase font-bold tracking-widest mb-3">📍 Location Data</p>
                            <div className="space-y-2 text-xs">
                              <div className="flex justify-between">
                                <span className="text-gray-500">Country</span>
                                <span className="text-white font-medium">{alert.country || "N/A"}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">City</span>
                                <span className="text-white font-medium">{alert.city || "N/A"}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">IP Address</span>
                                <span className="text-purple-300 font-mono">{alert.ipAddress}</span>
                              </div>
                              {alert.latitude !== 0 && (
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Coordinates</span>
                                  <span className="text-gray-300 font-mono text-[10px]">
                                    {alert.latitude?.toFixed(3)}, {alert.longitude?.toFixed(3)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Metadata */}
                          <div className="bg-white/3 rounded-xl p-4 border border-white/5">
                            <p className="text-[10px] text-purple-400 uppercase font-bold tracking-widest mb-3">📋 Extra Context</p>
                            {alert.metadata && Object.keys(alert.metadata).length > 0 ? (
                              <div className="space-y-1.5">
                                {Object.entries(alert.metadata).map(([k, v]) => (
                                  <div key={k} className="flex justify-between text-xs">
                                    <span className="text-gray-500 capitalize">{k.replace(/_/g, " ")}</span>
                                    <span className="text-gray-200 font-medium text-right max-w-[160px] truncate">
                                      {Array.isArray(v) ? `${v.length} items` : String(v)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-gray-600 text-xs">No extra metadata</p>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}
