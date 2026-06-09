"use client";
import { useState, useEffect } from "react";
import { BarChart3, Calendar, MapPin, Trash2, Ticket, Award, X as XIcon } from 'lucide-react';

interface ActivityModalProps {
  userId: string;
  onClose: () => void;
}

export default function UserActivityModal({ userId, onClose }: ActivityModalProps) {
  const [activity, setActivity] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivity = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/users/${userId}/activity`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          setActivity(await res.json());
        }
      } catch (err) {
        console.error("Failed to fetch user activity");
      } finally {
        setLoading(false);
      }
    };
    fetchActivity();
  }, [userId]);

  const handleDeleteEvent = async (id: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this event? This will remove it for ALL users.")) return;
    
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/events/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        // Update local state
        setActivity((prev: any) => ({
          ...prev,
          hostedEvents: prev.hostedEvents.filter((e: any) => e._id !== id)
        }));
      }
    } catch (error) {
      console.error("Failed to delete event");
    }
  };

  if (loading) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="glass-panel w-full max-w-4xl max-h-[85vh] overflow-y-auto rounded-3xl border border-white/10 shadow-2xl p-8 relative">
        <button onClick={onClose} className="absolute top-6 right-6 text-gray-400 hover:text-white transition-colors">
          <XIcon className="w-6 h-6" />
        </button>

        <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-purple-400" /> User Activity
        </h2>
        <p className="text-purple-400 font-medium mb-6">UserID: <span className="text-white">@{activity?.username}</span></p>

        {/* Security Profile & Session Details */}
        {activity && (
          <div className="mb-8 bg-white/5 border border-white/10 rounded-2xl p-6 grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="flex flex-col">
              <span className="text-gray-500 text-[10px] uppercase font-bold tracking-wider">Public IP</span>
              <span className="text-purple-300 font-mono font-bold text-sm mt-1">
                {activity.ipAddress && activity.ipAddress !== 'Unknown' ? activity.ipAddress : 'Location Unavailable'}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-gray-500 text-[10px] uppercase font-bold tracking-wider">Location</span>
              <span className="text-white font-medium text-sm mt-1">
                {activity.location || 'Location Unavailable'}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-gray-500 text-[10px] uppercase font-bold tracking-wider">Source</span>
              <span className="text-white font-medium text-sm mt-1 uppercase">
                {activity.locationSource || 'IP'}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-gray-500 text-[10px] uppercase font-bold tracking-wider">Latitude</span>
              <span className="text-white font-mono font-medium text-sm mt-1">
                {activity.latitude && activity.latitude !== 0 ? activity.latitude.toFixed(4) : 'Location Unavailable'}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-gray-500 text-[10px] uppercase font-bold tracking-wider">Longitude</span>
              <span className="text-white font-mono font-medium text-sm mt-1">
                {activity.longitude && activity.longitude !== 0 ? activity.longitude.toFixed(4) : 'Location Unavailable'}
              </span>
            </div>
            <div className="flex flex-col col-span-2 md:col-span-1">
              <span className="text-gray-500 text-[10px] uppercase font-bold tracking-wider">Last Login</span>
              <span className="text-white font-medium text-xs mt-1.5 leading-none">
                {activity.lastLogin ? new Date(activity.lastLogin).toLocaleString() : 'N/A'}
              </span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Hosted Events */}
          <section>
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-blue-400" /> Hosted Events ({activity?.hostedEvents.length})
            </h3>
            <div className="space-y-4">
              {activity?.hostedEvents.length === 0 ? (
                <p className="text-gray-500 italic text-sm">No events hosted yet.</p>
              ) : (
                activity?.hostedEvents.map((event: any) => (
                  <div key={event._id} className="bg-white/5 border border-white/5 rounded-xl p-4 hover:border-purple-500/30 transition-colors flex justify-between items-center group">
                    <div>
                      <p className="text-white font-bold mb-1">{event.title}</p>
                      <div className="flex flex-col gap-1 text-gray-400 text-xs mt-1">
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-pink-400" />
                          {event.location}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-purple-400" />
                          {new Date(event.dateTime).toLocaleString()}
                        </span>
                      </div>
                      <span className={`inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        event.status === 'approved' ? 'bg-green-500/20 text-green-400' : 
                        event.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' : 
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {event.status}
                      </span>
                    </div>
                    <button 
                      onClick={() => handleDeleteEvent(event._id)}
                      className="opacity-0 group-hover:opacity-100 bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white p-2 rounded-lg transition-all border border-red-500/30 flex items-center justify-center"
                      title="Delete Event Globally"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* Registered Events */}
          <section>
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Ticket className="w-5 h-5 text-green-400" /> Registered Events ({activity?.registeredEvents.length})
            </h3>
            <div className="space-y-4">
              {activity?.registeredEvents.length === 0 ? (
                <p className="text-gray-500 italic text-sm">No events registered yet.</p>
              ) : (
                activity?.registeredEvents.map((event: any) => (
                  <div key={event._id} className="bg-white/5 border border-white/5 rounded-xl p-4 hover:border-purple-500/30 transition-colors">
                    <p className="text-white font-bold mb-1">{event.title}</p>
                    <div className="flex flex-col gap-1 text-gray-400 text-xs mt-1">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-pink-400" />
                        {event.location}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-purple-400" />
                        {new Date(event.dateTime).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
