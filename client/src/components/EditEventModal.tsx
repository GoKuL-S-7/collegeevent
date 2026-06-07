"use client";
import { useState, useEffect } from "react";

interface EditEventModalProps {
  event: any;
  onClose: () => void;
  onUpdate: () => void;
}

export default function EditEventModal({ event, onClose, onUpdate }: EditEventModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    hostName: event.hostName,
    hostUserId: event.hostUserId,
    hostPhoneNumber: event.hostPhoneNumber,
    collegeName: event.collegeName,
    title: event.title,
    category: event.category,
    mode: event.mode,
    location: event.location,
    entryFee: event.entryFee,
    dateTime: new Date(event.dateTime).toISOString().slice(0, 16),
    description: event.description,
    registrationLink: event.registrationLink,
  });
  const [poster, setPoster] = useState<File | null>(null);

  const handleChange = (e: any) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      const submitData = new FormData();
      
      Object.entries(formData).forEach(([key, value]) => {
        submitData.append(key, value.toString());
      });
      
      if (poster) {
        submitData.append('poster', poster);
      }

      const res = await fetch(`https://collegeevent-production-d8bc.up.railway.app/api/events/${event._id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: submitData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");

      onUpdate();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="glass-panel w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 shadow-2xl p-8 relative">
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 text-gray-400 hover:text-white transition-colors"
        >
          <span className="text-2xl">✕</span>
        </button>

        <h2 className="text-3xl font-bold text-white mb-6 text-gradient">Edit Event</h2>
        
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Host Name</label>
              <input required name="hostName" value={formData.hostName} onChange={handleChange} className="w-full bg-[#1a1a2e] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none transition-colors" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Host Website User ID</label>
              <input readOnly name="hostUserId" value={formData.hostUserId} className="w-full bg-[#1a1a2e]/50 border border-white/5 rounded-xl px-4 py-3 text-gray-400 cursor-not-allowed outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Host Phone Number</label>
              <input 
                required 
                type="tel" 
                name="hostPhoneNumber" 
                value={formData.hostPhoneNumber} 
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  setFormData({...formData, hostPhoneNumber: val});
                }} 
                className="w-full bg-[#1a1a2e] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none transition-colors" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Registration Link (External)</label>
              <input 
                required 
                type="url" 
                name="registrationLink" 
                value={formData.registrationLink} 
                onChange={handleChange} 
                className="w-full bg-[#1a1a2e] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none transition-colors" 
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">College / Organization Name</label>
            <input required name="collegeName" value={formData.collegeName} onChange={handleChange} className="w-full bg-[#1a1a2e] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none transition-colors" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Event Title</label>
            <input required name="title" value={formData.title} onChange={handleChange} className="w-full bg-[#1a1a2e] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none transition-colors" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Category</label>
              <select name="category" value={formData.category} onChange={handleChange} className="w-full bg-[#1a1a2e] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none transition-colors appearance-none">
                <option value="hackathon">Hackathon</option>
                <option value="workshop">Workshop</option>
                <option value="concert">Concert</option>
                <option value="seminar">Seminar</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Mode</label>
              <select name="mode" value={formData.mode} onChange={handleChange} className="w-full bg-[#1a1a2e] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none transition-colors appearance-none">
                <option value="offline">Offline</option>
                <option value="online">Online</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">Location</label>
              <input required name="location" value={formData.location} onChange={handleChange} className="w-full bg-[#1a1a2e] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none transition-colors" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Entry Fee (₹)</label>
              <input required type="number" name="entryFee" value={formData.entryFee} onChange={handleChange} className="w-full bg-[#1a1a2e] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none transition-colors" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Date & Time</label>
            <input required type="datetime-local" name="dateTime" value={formData.dateTime} onChange={handleChange} className="w-full bg-[#1a1a2e] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none transition-colors [color-scheme:dark]" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
            <textarea required name="description" value={formData.description} onChange={handleChange} rows={4} className="w-full bg-[#1a1a2e] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none transition-colors resize-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Replace Poster (Optional)</label>
            <input 
              type="file" 
              accept="image/*" 
              onChange={(e) => setPoster(e.target.files?.[0] || null)}
              className="w-full bg-[#1a1a2e] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none transition-colors file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-500 file:text-white hover:file:bg-purple-600" 
            />
          </div>

          <div className="flex justify-end gap-4 pt-4">
            <button 
              type="button" 
              onClick={onClose}
              className="px-6 py-3 rounded-xl border border-white/10 text-white font-medium hover:bg-white/5 transition-all"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="px-8 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold transition-all shadow-[0_0_20px_rgba(168,85,247,0.3)] disabled:opacity-50"
            >
              {loading ? "Updating..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
