"use client";
import { useState, useEffect, useCallback } from "react";
import { 
  Shield, Globe, Plane, Lock, RefreshCw, Laptop, Activity, Zap, MapPin, 
  AlertTriangle, Link, ShieldAlert, AlertCircle, Key, Users, Check, X,
  ClipboardList, Info
} from 'lucide-react';

// ─── Types (preserved) ───────────────────────────────────────────────────────
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

// ─── Risk Badge ───────────────────────────────────────────────────────────────
const RISK_BADGE: Record<string, string> = {
  Critical: "bg-red-500/20 text-red-400 border-red-500/30 animate-pulse",
  High:     "bg-orange-500/20 text-orange-400 border-orange-500/30",
  Medium:   "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  Low:      "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

function RiskBadge({ level }: { level: string }) {
  return (
    <span
      className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${RISK_BADGE[level] ?? RISK_BADGE.Low}`}
    >
      {level}
    </span>
  );
}

// ─── Alert icon map ───────────────────────────────────────────────────────────
const ALERT_ICONS: Record<string, React.ComponentType<any>> = {
  COUNTRY_CHANGE:      Globe,
  IMPOSSIBLE_TRAVEL:   Plane,
  VPN_DETECTED:        Lock,
  TOR_DETECTED:        ShieldAlert,
  MULTIPLE_IP_CHANGES: RefreshCw,
  NEW_DEVICE:          Laptop,
  NEW_USER_AGENT:      Activity,
  BRUTE_FORCE:         Zap,
  SUSPICIOUS_LOCATION: MapPin,
  FAILED_LOGIN_ATTEMPTS: Key,
  MULTIPLE_ACCOUNTS_SAME_IP: Users,
  MALICIOUS_LINK_DETECTED: ShieldAlert,
  LOCALHOST_LINK_SUBMITTED: Laptop,
  URL_SHORTENER_USED: Link,
  NON_HTTPS_REGISTRATION_URL: AlertTriangle,
  DOMAIN_MISMATCH: AlertCircle,
  BLACKLISTED_DOMAIN: ShieldAlert
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AIMonitorDashboard() {
  const [alerts, setAlerts]       = useState<SecurityAlert[]>([]);
  const [stats, setStats]         = useState<SecurityStats | null>(null);
  const [loading, setLoading]     = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // ── Filters ─────────────────────────────────────────────────────────────────
  const [usernameFilter, setUsernameFilter]   = useState("");
  const [severityFilter, setSeverityFilter]   = useState("");
  const [resolvedFilter, setResolvedFilter]   = useState("");

  // ── Data fetching (preserved) ────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const token   = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const params = new URLSearchParams();
      if (severityFilter) params.set("severity", severityFilter);
      if (resolvedFilter !== "") params.set("resolved", resolvedFilter);
      if (usernameFilter)  params.set("username", usernameFilter);

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
  }, [severityFilter, resolvedFilter, usernameFilter]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  // 30-second polling (preserved)
  useEffect(() => {
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ── Resolve handler (preserved) ──────────────────────────────────────────────
  const handleResolve = async (alertId: string) => {
    setResolving(alertId);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/security/resolve/${alertId}`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        setAlerts(prev =>
          prev.map(a => (a._id === alertId ? { ...a, resolved: true } : a))
        );
        if (stats)
          setStats({ ...stats, unresolved: Math.max(0, stats.unresolved - 1) });
      }
    } finally {
      setResolving(null);
    }
  };

  // Derived stat values
  const totalAlerts    = stats?.total ?? 0;
  const criticalCount  = stats?.critical ?? 0;
  const warningCount   = (stats?.high ?? 0) + (stats?.medium ?? 0);
  const resolvedCount  = totalAlerts - (stats?.unresolved ?? 0);

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-400" />
            AI Security Monitor
          </h2>
          <p className="text-gray-500 text-xs mt-0.5">
            Real-time threat detection · Polling every 30 s · Last updated{" "}
            {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); fetchData(); }}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-gray-300 transition-all hover:border-purple-500/40"
        >
          <span className={loading ? "animate-spin inline-block" : ""}>↻</span>
          Refresh
        </button>
      </div>

      {/* ── Stat cards ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10 bg-white/5">
          <p className="text-gray-400 text-sm">Total Alerts</p>
          <h2 className="text-3xl font-bold text-white mt-2">{totalAlerts}</h2>
        </div>
        {/* Critical */}
        <div className="glass-panel p-6 rounded-2xl border border-red-500/20 bg-red-500/5">
          <p className="text-red-400 text-sm">Critical Threats</p>
          <h2 className="text-3xl font-bold text-red-500 mt-2">{criticalCount}</h2>
        </div>
        {/* Warnings */}
        <div className="glass-panel p-6 rounded-2xl border border-yellow-500/20 bg-yellow-500/5">
          <p className="text-yellow-400 text-sm">Warnings</p>
          <h2 className="text-3xl font-bold text-yellow-500 mt-2">{warningCount}</h2>
        </div>
        {/* Resolved */}
        <div className="glass-panel p-6 rounded-2xl border border-purple-500/20 bg-purple-500/5">
          <p className="text-purple-400 text-sm">Resolved</p>
          <h2 className="text-3xl font-bold text-purple-500 mt-2">{resolvedCount}</h2>
        </div>
      </div>

      {/* ── Charts ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-4">
        {/* Alerts By Day */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10 bg-white/5">
          <h3 className="text-xs font-bold text-gray-400 mb-4 uppercase tracking-wider">Alerts By Day</h3>
          {stats?.dailyTrends && stats.dailyTrends.length > 0 ? (
            <div className="flex items-end justify-between h-36 gap-2 pt-2">
              {stats.dailyTrends.map((d) => {
                const maxVal = Math.max(...stats.dailyTrends.map(x => x.count), 1);
                const pct = (d.count / maxVal) * 100;
                return (
                  <div key={d._id} className="flex flex-col items-center flex-1 h-full justify-end group">
                    <div className="text-[9px] text-purple-400 font-bold mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {d.count}
                    </div>
                    <div 
                      className="w-full bg-gradient-to-t from-purple-600 to-pink-500 rounded-t-sm transition-all duration-500 hover:from-purple-500 hover:to-pink-400"
                      style={{ height: `${pct}%`, minHeight: d.count > 0 ? '4px' : '0px' }}
                    />
                    <span className="text-[8px] text-gray-500 mt-2 whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                      {d._id.substring(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-36 text-gray-600 text-xs">No trend data available</div>
          )}
        </div>

        {/* Alerts By Country */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10 bg-white/5">
          <h3 className="text-xs font-bold text-gray-400 mb-4 uppercase tracking-wider">Alerts By Country</h3>
          {stats?.byCountry && stats.byCountry.length > 0 ? (
            <div className="space-y-3 h-36 overflow-y-auto pr-1">
              {stats.byCountry.map((c) => {
                const maxVal = Math.max(...stats.byCountry.map(x => x.count), 1);
                const pct = (c.count / maxVal) * 100;
                return (
                  <div key={c._id} className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-gray-300 truncate max-w-[150px]">{c._id === 'Local' ? 'Localhost' : c._id}</span>
                      <span className="text-purple-400 font-bold">{c.count}</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500" 
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-36 text-gray-600 text-xs">No country data available</div>
          )}
        </div>

        {/* Top Risky Users */}
        <div className="glass-panel p-6 rounded-2xl border border-white/10 bg-white/5">
          <h3 className="text-xs font-bold text-gray-400 mb-4 uppercase tracking-wider">Top Risky Users</h3>
          {stats?.topRiskyUsers && stats.topRiskyUsers.length > 0 ? (
            <div className="space-y-3 h-36 overflow-y-auto pr-1">
              {stats.topRiskyUsers.map((u) => {
                const maxVal = Math.max(...stats.topRiskyUsers.map(x => x.totalScore), 1);
                const pct = (u.totalScore / maxVal) * 100;
                return (
                  <div key={u._id} className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-red-400 truncate max-w-[120px]">@{u._id}</span>
                      <span className="text-gray-400 text-[9px]">
                        {u.alertCount} alerts · <span className="text-red-500 font-bold">{u.totalScore} pts</span>
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full transition-all duration-500" 
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-36 text-gray-600 text-xs">No user risk data available</div>
          )}
        </div>
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-4 bg-white/5 p-4 rounded-xl border border-white/10">
        {/* Username search */}
        <input
          type="text"
          placeholder="Search Username..."
          className="bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white outline-none focus:border-purple-500 transition-colors placeholder:text-gray-600 text-sm min-w-[200px]"
          value={usernameFilter}
          onChange={e => setUsernameFilter(e.target.value)}
        />

        {/* Risk Level */}
        <select
          className="bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white outline-none focus:border-purple-500 transition-colors text-sm"
          value={severityFilter}
          onChange={e => setSeverityFilter(e.target.value)}
        >
          <option value="">All Risk Levels</option>
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
          <option value="Critical">Critical</option>
        </select>

        {/* Status */}
        <select
          className="bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white outline-none focus:border-purple-500 transition-colors text-sm"
          value={resolvedFilter}
          onChange={e => setResolvedFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="false">Unresolved</option>
          <option value="true">Resolved</option>
        </select>

        <span className="ml-auto text-gray-500 text-xs self-center">
          {alerts.length} result{alerts.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Alerts table ─────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white/10 text-gray-400 text-[10px] uppercase tracking-wider">
              <th className="px-4 py-3">Username</th>
              <th className="px-4 py-3">IP Address</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Alert Type</th>
              <th className="px-4 py-3">Risk Score</th>
              <th className="px-4 py-3">Severity</th>
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-white/5">
            {/* Loading */}
            {loading && (
              <tr>
                <td colSpan={8} className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-purple-500 mx-auto" />
                </td>
              </tr>
            )}

            {/* Empty */}
            {!loading && alerts.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-12 text-gray-500">
                  No suspicious activities detected.
                </td>
              </tr>
            )}

            {/* Alert rows */}
            {!loading &&
              alerts.map(alert => (
                <>
                  <tr
                    key={alert._id}
                    className={`hover:bg-white/5 transition-colors cursor-pointer ${
                      expandedId === alert._id ? "bg-white/5" : ""
                    }`}
                    onClick={() =>
                      setExpandedId(expandedId === alert._id ? null : alert._id)
                    }
                  >
                    {/* Username */}
                    <td className="px-4 py-3 text-sm text-purple-400">
                      @{alert.username}
                    </td>

                    {/* IP Address */}
                    <td className="px-4 py-3 text-sm font-mono text-gray-300">
                      {alert.ipAddress}
                    </td>

                    {/* Location */}
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {alert.city && alert.country && alert.city !== 'Unknown' && alert.country !== 'Unknown' && alert.city !== 'Local' && alert.country !== 'Local'
                        ? `${alert.city}, ${alert.country}`
                        : 'Location Unavailable'}
                    </td>

                    {/* Alert Type */}
                    <td className="px-4 py-3 text-sm text-white font-bold">
                      <div className="flex items-center gap-1.5">
                        <span className="text-purple-400 flex items-center">
                          {(() => {
                            const IconComponent = ALERT_ICONS[alert.alertType] || AlertCircle;
                            return <IconComponent className="w-3.5 h-3.5" />;
                          })()}
                        </span>
                        {alert.alertType.replace(/_/g, " ")}
                      </div>
                    </td>

                    {/* Risk Score */}
                    <td className="px-4 py-3 text-sm font-mono font-bold text-center">
                      <span
                        className={
                          alert.score >= 70
                            ? "text-red-400"
                            : alert.score >= 30
                            ? "text-yellow-400"
                            : "text-gray-400"
                        }
                      >
                        {alert.score}
                      </span>
                    </td>

                    {/* Severity */}
                    <td className="px-4 py-3 text-sm">
                      <RiskBadge level={alert.severity} />
                    </td>

                    {/* Timestamp */}
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(alert.createdAt).toLocaleString()}
                    </td>

                    {/* Status */}
                    <td
                      className="px-4 py-3 text-sm"
                      onClick={e => e.stopPropagation()}
                    >
                      {!alert.resolved ? (
                        <div className="flex gap-2">
                          {/* Resolve */}
                          <button
                            disabled={resolving === alert._id}
                            onClick={() => handleResolve(alert._id)}
                            title="Resolve"
                            className="bg-green-500/10 hover:bg-green-500 text-green-400 hover:text-white px-2 py-1 rounded-md text-xs transition-all border border-green-500/20 disabled:opacity-40"
                          >
                            {resolving === alert._id ? (
                              <span className="animate-spin inline-block text-xs">↻</span>
                            ) : (
                              "Resolve"
                            )}
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold uppercase text-green-500">
                          Resolved
                        </span>
                      )}
                    </td>
                  </tr>

                  {/* Expanded detail row */}
                  {expandedId === alert._id && (
                    <tr
                      key={`${alert._id}-detail`}
                      className="bg-black/40 border-l-4 border-purple-500"
                    >
                      <td colSpan={8} className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          {/* Description */}
                          <div>
                            <h4 className="text-purple-400 font-bold text-xs uppercase tracking-widest mb-3 flex items-center gap-1.5">
                              <Info className="w-4 h-4" />
                              Alert Detail
                            </h4>
                            <p className="text-white text-sm leading-relaxed">
                              {alert.description}
                            </p>
                            {alert.resolvedAt && (
                              <p className="text-green-500/60 text-[10px] mt-3">
                                Resolved at:{" "}
                                {new Date(alert.resolvedAt).toLocaleString()}
                              </p>
                            )}
                          </div>

                          {/* Location detail */}
                          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                            <h4 className="text-purple-400 font-bold text-xs uppercase tracking-widest mb-3 flex items-center gap-1.5">
                              <MapPin className="w-4 h-4" />
                              Location Data
                            </h4>
                            <div className="space-y-2 text-xs">
                              <div className="flex justify-between">
                                <span className="text-gray-500">Country</span>
                                <span className="text-white font-medium">
                                  {alert.country || "N/A"}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">City</span>
                                <span className="text-white font-medium">
                                  {alert.city || "N/A"}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">IP Address</span>
                                <span className="text-purple-300 font-mono">
                                  {alert.ipAddress}
                                </span>
                              </div>
                              {alert.latitude !== 0 && (
                                <div className="flex justify-between">
                                  <span className="text-gray-500">Coordinates</span>
                                  <span className="text-gray-300 font-mono text-[10px]">
                                    {alert.latitude?.toFixed(3)},{" "}
                                    {alert.longitude?.toFixed(3)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Metadata */}
                          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                            <h4 className="text-purple-400 font-bold text-xs uppercase tracking-widest mb-3 flex items-center gap-1.5">
                              <ClipboardList className="w-4 h-4" />
                              Extra Context
                            </h4>
                            {alert.metadata &&
                            Object.keys(alert.metadata).length > 0 ? (
                              <div className="space-y-1.5">
                                {Object.entries(alert.metadata).map(([k, v]) => (
                                  <div
                                    key={k}
                                    className="flex justify-between text-xs"
                                  >
                                    <span className="text-gray-500 capitalize">
                                      {k.replace(/_/g, " ")}
                                    </span>
                                    <span className="text-gray-200 font-medium text-right max-w-[160px] truncate">
                                      {Array.isArray(v)
                                        ? `${v.length} items`
                                        : String(v)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-gray-600 text-xs">
                                No extra metadata
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
