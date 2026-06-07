"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import EventCard from "@/components/EventCard";
import EditEventModal from "@/components/EditEventModal";
import DeleteConfirmationModal from "@/components/DeleteConfirmationModal";

export default function UserProfile() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [myEvents, setMyEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    approved: 0,
    pending: 0,
    rejected: 0
  });
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [deletingEvent, setDeletingEvent] = useState<any>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) {
      router.push("/login");
      return;
    }
    const user = JSON.parse(userData);
    if (user.role === "admin") {
      router.push("/admin");
      return;
    }
    setUser(user);
    fetchMyEvents();
  }, [router]);

  const fetchMyEvents = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:5000/api/events/my-events", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error("Failed to fetch activities");
      const data = await res.json();
      setMyEvents(data);
      
      // Calculate stats
      const newStats = {
        total: data.length,
        approved: data.filter((e: any) => e.status === 'approved').length,
        pending: data.filter((e: any) => e.status === 'pending').length,
        rejected: data.filter((e: any) => e.status === 'rejected').length
      };
      setStats(newStats);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!deletingEvent) return;
    setDeleteLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:5000/api/events/${deletingEvent._id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete event");
      }

      setMyEvents(prev => prev.filter(e => e._id !== deletingEvent._id));
      setToast({ message: "Event deleted permanently.", type: "success" });
      setDeletingEvent(null);
      
      // Update stats
      const statusKey = deletingEvent.status as 'approved' | 'pending' | 'rejected';
      setStats(prev => ({
        ...prev,
        total: prev.total - 1,
        [statusKey]: prev[statusKey] - 1
      }));
    } catch (err: any) {
      setToast({ message: err.message, type: "error" });
    } finally {
      setDeleteLoading(false);
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen flex justify-center items-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      {/* Header & Stats */}
      <div className="mb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
              <span className="text-3xl">👤</span> {user?.username}'s Dashboard
            </h1>
            <p className="text-gray-400">Track your event submissions and activities</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-panel p-6 rounded-2xl border border-white/5 text-center">
            <p className="text-gray-400 text-sm mb-1">Total Submissions</p>
            <p className="text-3xl font-bold text-white">{stats.total}</p>
          </div>
          <div className="glass-panel p-6 rounded-2xl border border-green-500/20 text-center">
            <p className="text-green-400 text-sm mb-1">Approved</p>
            <p className="text-3xl font-bold text-green-400">{stats.approved}</p>
          </div>
          <div className="glass-panel p-6 rounded-2xl border border-yellow-500/20 text-center">
            <p className="text-yellow-400 text-sm mb-1">Pending</p>
            <p className="text-3xl font-bold text-yellow-400">{stats.pending}</p>
          </div>
          <div className="glass-panel p-6 rounded-2xl border border-red-500/20 text-center">
            <p className="text-red-400 text-sm mb-1">Rejected</p>
            <p className="text-3xl font-bold text-red-400">{stats.rejected}</p>
          </div>
        </div>
      </div>

      {/* Activities Section */}
      <div className="space-y-12">
        <section>
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <span className="text-purple-500">📋</span> My Hosted Events
          </h2>
          
          {myEvents.length === 0 ? (
            <div className="glass-panel p-12 rounded-3xl text-center border border-white/5">
              <div className="text-5xl mb-4">📢</div>
              <p className="text-gray-400 text-lg">You haven't hosted any events yet.</p>
              <Link href="/host" className="text-purple-400 hover:text-purple-300 mt-4 inline-block font-medium">
                Start by hosting your first event →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {myEvents.map((event) => (
                <div key={event._id} className="relative group">
                  {/* Status Badge */}
                  <div className={`absolute top-4 right-4 z-20 px-3 py-1 rounded-full text-xs font-bold shadow-lg backdrop-blur-md border ${
                    event.status === 'approved' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                    event.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                    'bg-red-500/20 text-red-400 border-red-500/30'
                  }`}>
                    {event.status.toUpperCase()}
                  </div>
                  
                  <EventCard event={event} />
                  
                  {/* Timeline info overlay & Actions */}
                  <div className="mt-4 glass-panel p-4 rounded-xl border border-white/5 text-xs text-gray-500 flex justify-between items-center">
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col">
                        <span>Submitted: {new Date(event.createdAt).toLocaleDateString()}</span>
                        {event.updatedAt && (
                          <span className="text-purple-400/70">Updated: {new Date(event.updatedAt).toLocaleDateString()}</span>
                        )}
                      </div>
                      
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setEditingEvent(event)}
                          className="px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600 text-purple-400 hover:text-white border border-purple-500/30 transition-all font-bold"
                        >
                          ✏️ Edit
                        </button>
                        <button 
                          onClick={() => setDeletingEvent(event)}
                          className="px-3 py-1.5 rounded-lg bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/20 transition-all font-bold"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                    
                    <div className="flex items-center pr-6">
                      <div className="text-center">
                        <p className="text-[10px] uppercase text-gray-500 mb-1 font-bold tracking-wider">Regs</p>
                        <p className="text-purple-400 font-black text-2xl">{event.registrationsCount || 0}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Edit Modal */}
      {editingEvent && (
        <EditEventModal 
          event={editingEvent} 
          onClose={() => setEditingEvent(null)} 
          onUpdate={() => {
            setToast({ message: "Event updated! Pending admin re-approval.", type: "success" });
            fetchMyEvents();
          }}
        />
      )}

      {/* Delete Modal */}
      <DeleteConfirmationModal 
        isOpen={!!deletingEvent}
        onClose={() => setDeletingEvent(null)}
        onConfirm={handleDeleteEvent}
        title={deletingEvent?.title || ""}
        loading={deleteLoading}
      />

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-8 right-8 z-[100] px-6 py-3 rounded-2xl shadow-2xl border animate-in slide-in-from-bottom-4 duration-300 ${
          toast.type === 'success' ? 'bg-green-500/20 border-green-500/50 text-green-400' : 'bg-red-500/10 border-red-500/50 text-red-400'
        }`}>
          <div className="flex items-center gap-3">
            <span className="text-xl">{toast.type === 'success' ? '✅' : '❌'}</span>
            <span className="font-medium">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
