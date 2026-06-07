"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import UserActivityModal from "@/components/UserActivityModal";
import SecurityDashboard from "@/components/SecurityDashboard";
import DeleteConfirmationModal from "@/components/DeleteConfirmationModal";

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("events");
  const [pendingEvents, setPendingEvents] = useState<any[]>([]);
  const [allEvents, setAllEvents] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<any>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    const userStr = localStorage.getItem("user");
    if (!userStr) {
      router.push("/login");
      return;
    }
    const user = JSON.parse(userStr);
    if (user.role !== "admin") {
      router.push("/");
      return;
    }

    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const [pendingRes, allRes, usersRes, logsRes] = await Promise.all([
        fetch("https://collegeevent-production-d8bc.up.railway.app/api/admin/events/pending", { headers }),
        fetch("https://collegeevent-production-d8bc.up.railway.app/api/admin/events/all", { headers }),
        fetch("https://collegeevent-production-d8bc.up.railway.app/api/admin/users", { headers }),
        fetch("https://collegeevent-production-d8bc.up.railway.app/api/admin/activity-logs", { headers })
      ]);

      if (pendingRes.ok) setPendingEvents(await pendingRes.json());
      if (allRes.ok) setAllEvents(await allRes.json());
      if (usersRes.ok) setUsers(await usersRes.json());
      if (logsRes.ok) setLogs(await logsRes.json());
    } catch (error) {
      console.error("Failed to fetch admin data");
    } finally {
      setLoading(false);
    }
  };

  const handleEventAction = async (id: string, status: string) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`https://collegeevent-production-d8bc.up.railway.app/api/admin/events/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        setPendingEvents(pendingEvents.filter(e => e._id !== id));
        setAllEvents(allEvents.map(e => e._id === id ? { ...e, status } : e));
      }
    } catch (error) {
      console.error(`Failed to ${status} event`);
    }
  };
  
  const handleDeleteEvent = async () => {
    if (!deletingEvent) return;
    setDeleteLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`https://collegeevent-production-d8bc.up.railway.app/api/events/${deletingEvent._id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        setPendingEvents(pendingEvents.filter(e => e._id !== deletingEvent._id));
        setAllEvents(allEvents.filter(e => e._id !== deletingEvent._id));
        setDeletingEvent(null);
      }
    } catch (error) {
      console.error("Failed to delete event");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleBlockUser = async (id: string) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`https://collegeevent-production-d8bc.up.railway.app/api/admin/users/${id}/block`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(users.map(u => u._id === id ? { ...u, isBlocked: data.isBlocked } : u));
      }
    } catch (error) {
      console.error("Failed to toggle block status");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gradient">Admin Dashboard</h1>
          <p className="text-gray-400 mt-1">Manage events, users, and system security</p>
        </div>
      </div>

      <div className="flex space-x-4 mb-8 border-b border-white/10 pb-4 overflow-x-auto">
        <button onClick={() => setActiveTab("events")} className={`px-6 py-2 rounded-full font-medium transition-colors ${activeTab === 'events' ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
          Pending ({pendingEvents.length})
        </button>
        <button onClick={() => setActiveTab("all-events")} className={`px-6 py-2 rounded-full font-medium transition-colors ${activeTab === 'all-events' ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
          All Events ({allEvents.length})
        </button>
        <button onClick={() => setActiveTab("users")} className={`px-6 py-2 rounded-full font-medium transition-colors ${activeTab === 'users' ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
          Users ({users.length})
        </button>
        <button onClick={() => setActiveTab("security")} className={`px-6 py-2 rounded-full font-medium transition-colors ${activeTab === 'security' ? 'bg-red-600 text-white' : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'}`}>
          🛡️ AI Monitoring
        </button>
        <button onClick={() => setActiveTab("logs")} className={`px-6 py-2 rounded-full font-medium transition-colors ${activeTab === 'logs' ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
          System Logs
        </button>
      </div>

      <div className="glass-panel rounded-2xl p-6 border border-white/10">
        
        {/* Events Tab */}
        {activeTab === "events" && (
          <div className="space-y-4">
            {pendingEvents.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No pending events to review.</p>
            ) : (
              pendingEvents.map((event) => (
                <div key={event._id} className="bg-[#1a1a2e] rounded-xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center border border-white/5 hover:border-purple-500/30 transition-colors">
                  <div className="mb-4 md:mb-0">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      {event.title}
                      <span className="bg-purple-500/20 text-purple-300 text-xs px-2 py-1 rounded capitalize">{event.category}</span>
                    </h3>
                    <p className="text-gray-400 text-sm mt-1">{event.collegeName} • {new Date(event.dateTime).toLocaleDateString()}</p>
                    <p className="text-gray-500 text-sm mt-2 line-clamp-2 max-w-2xl">{event.description}</p>
                  </div>
                  <div className="flex gap-3 w-full md:w-auto">
                    <button onClick={() => handleEventAction(event._id, 'approved')} className="flex-1 md:flex-none bg-green-500/20 text-green-400 hover:bg-green-500/30 px-6 py-2 rounded-lg font-medium transition-colors border border-green-500/30">
                      Approve
                    </button>
                    <button onClick={() => handleEventAction(event._id, 'rejected')} className="flex-1 md:flex-none bg-red-500/20 text-red-400 hover:bg-red-500/30 px-6 py-2 rounded-lg font-medium transition-colors border border-red-500/30 text-sm">
                      Reject
                    </button>
                    <button onClick={() => setDeletingEvent(event)} className="flex-1 md:flex-none bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white px-4 py-2 rounded-lg font-bold transition-all border border-red-600/30 text-xs">
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* All Events Tab */}
        {activeTab === "all-events" && (
          <div className="space-y-4">
            {allEvents.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No events found in the system.</p>
            ) : (
              allEvents.map((event) => (
                <div key={event._id} className="bg-[#1a1a2e] rounded-xl p-6 border border-white/5 hover:border-purple-500/30 transition-colors flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-bold text-white">{event.title}</h3>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        event.status === 'approved' ? 'bg-green-500/20 text-green-400' : 
                        event.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' : 
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {event.status}
                      </span>
                    </div>
                    <p className="text-gray-400 text-xs">Host: <span className="text-white">{event.createdBy?.username || 'Unknown'}</span> • {event.collegeName}</p>
                    <p className="text-gray-500 text-xs mt-1">📅 {new Date(event.dateTime).toLocaleString()}</p>
                  </div>
                  <button 
                    onClick={() => setDeletingEvent(event)}
                    className="bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white px-4 py-2 rounded-lg font-bold transition-all border border-red-500/30 text-xs"
                  >
                    🗑️ Delete Globally
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Users Tab */}
        {activeTab === "users" && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 justify-between mb-6">
              <div className="relative flex-1">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                <input 
                  type="text" 
                  placeholder="Search by username..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white focus:border-purple-500 outline-none transition-all"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-gray-300">
                <thead className="text-gray-400 bg-black/20 text-sm uppercase">
                  <tr>
                    <th className="px-6 py-4 rounded-tl-xl">Username (ID)</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Location</th>
                    <th className="px-6 py-4">Activity Status</th>
                    <th className="px-6 py-4">Account Status</th>
                    <th className="px-6 py-4 rounded-tr-xl">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {users
                    .filter(user => user.username.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map((user) => (
                      <tr key={user._id} className="hover:bg-white/5 transition-colors">
                        <td className="px-6 py-4">
                          <button 
                            onClick={() => setSelectedUserId(user._id)}
                            className="font-medium text-white hover:text-purple-400 transition-colors cursor-pointer"
                          >
                            {user.username}
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-sm ${
                            user.role === 'admin' 
                              ? 'bg-gradient-to-r from-purple-600/20 to-red-500/20 text-purple-300 border-purple-500/40 shadow-purple-500/10' 
                              : user.role === 'host' 
                              ? 'bg-gradient-to-r from-blue-600/20 to-purple-600/20 text-blue-300 border-blue-500/40 shadow-blue-500/10' 
                              : 'bg-white/5 text-gray-500 border-white/10'
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">{user.location || 'N/A'}</td>
                        <td className="px-6 py-4">
                          {user.isSuspicious ? (
                            <span className="text-red-400 bg-red-400/10 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border border-red-500/20">Suspicious</span>
                          ) : (
                            <span className="text-green-400 bg-green-400/10 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border border-green-500/20">Active</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {user.isBlocked ? (
                            <span className="text-red-500 font-bold">Blocked</span>
                          ) : (
                            <span className="text-green-500 font-bold">Live</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {user.role !== 'admin' && (
                            <button 
                              onClick={() => handleBlockUser(user._id)}
                              className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                                user.isBlocked 
                                ? 'bg-green-600 hover:bg-green-700 text-white' 
                                : 'bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30'
                              }`}
                            >
                              {user.isBlocked ? 'Unblock' : 'Block'}
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Security Dashboard Tab */}
        {activeTab === "security" && (
          <SecurityDashboard />
        )}

        {/* System Logs Tab */}
        {activeTab === "logs" && (
          <div className="space-y-4">
            {logs.map((log) => (
              <div key={log._id} className={`rounded-xl p-4 border ${log.status === 'flagged' ? 'bg-red-500/5 border-red-500/30' : 'bg-[#1a1a2e] border-white/5'} flex flex-col md:flex-row justify-between items-start md:items-center`}>
                <div>
                  <div className="flex items-center gap-3">
                    <span className={`font-bold ${log.status === 'flagged' ? 'text-red-400' : 'text-blue-400'}`}>
                      {log.activityType.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-gray-400 text-sm mt-1">
                    <span className="text-white">{log.username}</span> • IP: {log.ipAddress} • {new Date(log.timestamp).toLocaleString()}
                  </div>
                  {log.details && <div className="text-red-300/80 text-sm mt-2 bg-red-500/10 p-2 rounded">{log.details}</div>}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {selectedUserId && (
        <UserActivityModal 
          userId={selectedUserId} 
          onClose={() => setSelectedUserId(null)} 
        />
      )}

      <DeleteConfirmationModal 
        isOpen={!!deletingEvent}
        onClose={() => setDeletingEvent(null)}
        onConfirm={handleDeleteEvent}
        title={deletingEvent?.title || ""}
        loading={deleteLoading}
      />
    </div>
  );
}
