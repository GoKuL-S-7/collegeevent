"use client";
import { useState, useEffect, Fragment } from "react";

interface SuspiciousActivity {
  _id: string;
  username: string;
  activityType: string;
  ipAddress: string;
  location: {
    city: string;
    country: string;
    isVPN: boolean;
  };
  timestamp: string;
  anomalyScore: number;
  riskLevel: 'Normal' | 'Warning' | 'Critical';
  status: 'Pending' | 'Resolved' | 'Ignored';
  metadata: any;
  // Enhanced Fields
  eventTitle?: string;
  organizerName?: string;
  submittedUrl?: string;
  finalDestinationUrl?: string;
  trustScore?: number;
  suspicionReasons?: string[];
  domainAge?: string;
  domainReputation?: string;
  matchedBrand?: string;
  // Webpage Analysis Fields
  scannedTitle?: string;
  pageCategory?: string;
  webpageStatus?: string;
  eventRelevanceScore?: number;
  redirectCount?: number;
  classification?: string;
}

export default function SecurityDashboard() {
  const [activities, setActivities] = useState<SuspiciousActivity[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    riskLevel: "",
    status: "",
    username: ""
  });

  useEffect(() => {
    fetchSecurityData();
  }, [filters]);

  const fetchSecurityData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const query = new URLSearchParams(filters as any).toString();
      
      const [actRes, statsRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/suspicious-activities?${query}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/security-stats`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (actRes.ok) setActivities(await actRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch (error) {
      console.error("Failed to fetch security data");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/suspicious-activities/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        setActivities(activities.map(a => a._id === id ? { ...a, status: status as any } : a));
      }
    } catch (error) {
      console.error("Failed to update status");
    }
  };

  const getRiskBadge = (level: string) => {
    const colors = {
      Normal: "bg-green-500/20 text-green-400 border-green-500/30",
      Warning: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      Critical: "bg-red-500/20 text-red-400 border-red-500/30 animate-pulse"
    };
    return (
      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${colors[level as keyof typeof colors]}`}>
        {level}
      </span>
    );
  };

  const getStatusColor = (status?: string) => {
    if (status === 'VALID EVENT PAGE' || status === 'EVENT REGISTRATION FORM') return 'text-green-400';
    if (status === 'PHISHING PAGE' || status === 'SPAM CONTENT' || status === 'SUSPICIOUS CONTENT') return 'text-red-400';
    if (status === 'BROKEN LINK' || status === 'PAGE NOT FOUND' || status === 'TIMEOUT ERROR' || status === 'REDIRECT LOOP') return 'text-yellow-400';
    return 'text-gray-400';
  };

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-panel p-6 rounded-2xl border border-white/10 bg-white/5">
          <p className="text-gray-400 text-sm">Total Alerts</p>
          <h2 className="text-3xl font-bold text-white mt-2">{activities.length}</h2>
        </div>
        <div className="glass-panel p-6 rounded-2xl border border-red-500/20 bg-red-500/5">
          <p className="text-red-400 text-sm">Critical Threats</p>
          <h2 className="text-3xl font-bold text-red-500 mt-2">
            {activities.filter(a => a.riskLevel === 'Critical').length}
          </h2>
        </div>
        <div className="glass-panel p-6 rounded-2xl border border-yellow-500/20 bg-yellow-500/5">
          <p className="text-yellow-400 text-sm">Warnings</p>
          <h2 className="text-3xl font-bold text-yellow-500 mt-2">
            {activities.filter(a => a.riskLevel === 'Warning').length}
          </h2>
        </div>
        <div className="glass-panel p-6 rounded-2xl border border-purple-500/20 bg-purple-500/5">
          <p className="text-purple-400 text-sm">Resolved</p>
          <h2 className="text-3xl font-bold text-purple-500 mt-2">
            {activities.filter(a => a.status === 'Resolved').length}
          </h2>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 bg-white/5 p-4 rounded-xl border border-white/10">
        <input 
          type="text" 
          placeholder="Search Username..." 
          className="bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white outline-none focus:border-purple-500"
          value={filters.username}
          onChange={(e) => setFilters({ ...filters, username: e.target.value })}
        />
        <select 
          className="bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white outline-none focus:border-purple-500"
          value={filters.riskLevel}
          onChange={(e) => setFilters({ ...filters, riskLevel: e.target.value })}
        >
          <option value="">All Risk Levels</option>
          <option value="Normal">Normal</option>
          <option value="Warning">Warning</option>
          <option value="Critical">Critical</option>
        </select>
        <select 
          className="bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white outline-none focus:border-purple-500"
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Resolved">Resolved</option>
          <option value="Ignored">Ignored</option>
        </select>
      </div>

      {/* Activities Table */}
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white/10 text-gray-400 text-xs uppercase tracking-wider">
              <th className="px-6 py-4">Activity / User</th>
              <th className="px-6 py-4">Location / IP</th>
              <th className="px-6 py-4">Risk Level</th>
              <th className="px-6 py-4">Score</th>
              <th className="px-6 py-4">Timestamp</th>
              <th className="px-6 py-4">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-purple-500 mx-auto"></div>
                </td>
              </tr>
            ) : activities.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-gray-500">No suspicious activities detected.</td>
              </tr>
            ) : (
              activities.map((activity) => (
                <Fragment key={activity._id}>
                  <tr 
                    className={`hover:bg-white/5 transition-colors group cursor-pointer ${expandedId === activity._id ? 'bg-white/5' : ''}`}
                    onClick={() => setExpandedId(expandedId === activity._id ? null : activity._id)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-white font-bold text-sm flex items-center gap-2">
                          {activity.activityType.replace(/_/g, ' ')}
                          {activity.activityType === 'MALICIOUS_LINK_DETECTION' && <span className="text-blue-400 text-[10px] bg-blue-400/10 px-1 rounded">AI Crawler</span>}
                        </span>
                        <span className="text-purple-400 text-xs">@{activity.username}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-gray-300 text-sm">
                          {activity.location?.city}, {activity.location?.country}
                          {activity.location?.isVPN && <span className="ml-2 text-red-400 text-[10px] font-bold">[VPN]</span>}
                        </span>
                        <span className="text-gray-500 text-xs">{activity.ipAddress}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getRiskBadge(activity.riskLevel)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`font-mono font-bold ${activity.anomalyScore > 60 ? 'text-red-400' : 'text-gray-400'}`}>
                        {activity.anomalyScore}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500">
                      {new Date(activity.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        {activity.status === 'Pending' ? (
                          <>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleUpdateStatus(activity._id, 'Resolved'); }}
                              className="bg-green-500/10 hover:bg-green-500 text-green-400 hover:text-white p-2 rounded-lg transition-all border border-green-500/20"
                            >
                              ✓
                            </button>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleUpdateStatus(activity._id, 'Ignored'); }}
                              className="bg-gray-500/10 hover:bg-gray-500 text-gray-400 hover:text-white p-2 rounded-lg transition-all border border-gray-500/20"
                            >
                              ✕
                            </button>
                          </>
                        ) : (
                          <span className={`text-[10px] font-bold uppercase ${activity.status === 'Resolved' ? 'text-green-500' : 'text-gray-500'}`}>
                            {activity.status}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                  
                  {/* Expanded Trust Analysis Details */}
                  {expandedId === activity._id && activity.activityType === 'MALICIOUS_LINK_DETECTION' && (
                    <tr className="bg-black/40 border-l-4 border-purple-500">
                      <td colSpan={6} className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="col-span-1">
                            <h4 className="text-purple-400 font-bold text-xs uppercase tracking-widest mb-4">Crawler Context</h4>
                            <div className="space-y-3">
                              {activity.classification && (
                                <div className={`p-3 rounded-lg border ${getStatusColor(activity.classification)} bg-white/5`}>
                                  <p className="text-[10px] uppercase font-bold opacity-70">AI Classification</p>
                                  <p className="text-sm font-bold">{activity.classification}</p>
                                </div>
                              )}
                              <div>
                                <p className="text-gray-500 text-[10px] uppercase">Event Reference</p>
                                <p className="text-white text-sm font-medium line-clamp-1">{activity.eventTitle || 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-gray-500 text-[10px] uppercase">Redirect Hops</p>
                                <p className={`text-sm font-bold ${(activity.redirectCount || 0) > 3 ? 'text-yellow-400' : 'text-white'}`}>
                                  {activity.redirectCount || 0} Redirects
                                </p>
                              </div>
                              <div>
                                <p className="text-gray-500 text-[10px] uppercase">Final Target</p>
                                <p className="text-blue-300 text-[11px] break-all font-mono leading-relaxed">{activity.finalDestinationUrl || 'N/A'}</p>
                              </div>
                            </div>
                          </div>
                          
                          <div className="col-span-1 bg-white/5 rounded-xl p-4 border border-white/10">
                            <h4 className="text-purple-400 font-bold text-xs uppercase tracking-widest mb-4 flex justify-between items-center">
                              Content Analysis
                              <span className={`px-2 py-1 rounded text-[10px] font-bold ${getStatusColor(activity.webpageStatus)} bg-white/5`}>
                                {activity.webpageStatus || 'SCANNED'}
                              </span>
                            </h4>
                            <div className="space-y-4">
                              <div>
                                <p className="text-gray-500 text-[10px] uppercase">Extracted Title</p>
                                <p className="text-white text-xs font-medium truncate">{activity.scannedTitle || 'No Title Found'}</p>
                              </div>
                              <div className="flex gap-4">
                                <div className="flex-1">
                                  <p className="text-gray-500 text-[10px] uppercase">Event Match</p>
                                  <p className="text-white text-xs font-bold">{activity.eventRelevanceScore}%</p>
                                </div>
                                <div className="flex-1">
                                  <p className="text-gray-500 text-[10px] uppercase">Risk Weight</p>
                                  <p className={`text-xs font-bold ${activity.anomalyScore > 40 ? 'text-red-400' : 'text-yellow-400'}`}>{activity.anomalyScore} Points</p>
                                </div>
                              </div>
                              <div className="pt-2 border-t border-white/5">
                                <p className="text-gray-500 text-[10px] uppercase mb-2">Technical Signals</p>
                                <div className="flex flex-wrap gap-1">
                                  {activity.suspicionReasons?.map((reason, i) => (
                                    <span key={i} className="text-[9px] bg-red-500/10 text-red-300 px-2 py-1 rounded border border-red-500/20">
                                      {reason}
                                    </span>
                                  ))}
                                  {(!activity.suspicionReasons || activity.suspicionReasons.length === 0) && (
                                    <span className="text-[9px] bg-green-500/10 text-green-300 px-2 py-1 rounded border border-green-500/20">
                                      No Negative Signals
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="col-span-1 bg-white/5 rounded-xl p-4 border border-white/10">
                            <h4 className="text-purple-400 font-bold text-xs uppercase tracking-widest mb-4">Security Decision</h4>
                            <div className="space-y-4">
                              <div className="flex items-end justify-between">
                                <div>
                                  <p className="text-gray-500 text-[10px] uppercase">Final Trust</p>
                                  <p className={`text-2xl font-bold ${activity.trustScore! > 70 ? 'text-green-400' : 'text-red-400'}`}>{activity.trustScore}/100</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-gray-500 text-[10px] uppercase">Brand Status</p>
                                  <p className={`text-xs font-bold ${activity.matchedBrand ? 'text-red-400' : 'text-green-400'}`}>
                                    {activity.matchedBrand ? 'Impersonated' : 'Neutral'}
                                  </p>
                                </div>
                              </div>
                              
                              <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                                <p className="text-gray-500 text-[10px] uppercase mb-1">AI Recommendation</p>
                                <p className="text-white text-[11px] leading-relaxed">
                                  {activity.classification === 'PHISHING PAGE' 
                                    ? 'HIGH RISK: Phishing signals detected in DOM. Page appears to be a fake login portal.' 
                                    : activity.classification === 'EVENT REGISTRATION FORM' 
                                    ? 'TRUSTED: Active registration form and high event relevance detected.'
                                    : activity.classification === 'BROKEN LINK'
                                    ? 'WARNING: Destination is unreachable or returns error status. Link is likely invalid.'
                                    : 'NEUTRAL: Webpage loads but has low direct relevance to event registration.'}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
