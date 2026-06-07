"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HostEvent() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    hostName: "",
    hostUserId: "",
    hostPhoneNumber: "",
    collegeName: "",
    title: "",
    category: "hackathon",
    mode: "offline",
    location: "",
    entryFee: 0,
    dateTime: "",
    description: "",
    registrationLink: "",
  });
  const [poster, setPoster] = useState<File | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const userData = localStorage.getItem("user");
    
    if (!token || !userData) {
      router.push("/login");
      return;
    }

    try {
      const user = JSON.parse(userData);
      if (user.role === 'admin') {
        router.push("/admin");
        return;
      }
      
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload && payload.username) {
        setFormData(prev => ({ ...prev, hostUserId: payload.username }));
      }
    } catch (e) {
      console.error("Auth check failed", e);
      router.push("/login");
    }
  }, [router]);

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
      
      // Append all text fields
      Object.entries(formData).forEach(([key, value]) => {
        submitData.append(key, value.toString());
      });
      
      // Append the poster file if it exists
      if (poster) {
        submitData.append('poster', poster);
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/events`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: submitData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");

      setSuccess(true);
      setTimeout(() => router.push("/"), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
        <div className="glass-panel p-12 rounded-3xl text-center max-w-md border border-green-500/30">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-green-400 mb-2">Event Submitted!</h2>
          <p className="text-gray-400">Your event is under review by our admin team. You will be redirected shortly.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-gradient mb-4">Host an Event</h1>
        <p className="text-gray-400">Fill out the details below to publish your event on CampusConnect.</p>
      </div>

      <div className="glass-panel p-8 rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
        {/* Progress indicator */}
        <div className="flex mb-8 relative">
          <div className="absolute top-1/2 left-0 w-full h-1 bg-white/10 -translate-y-1/2 rounded-full" />
          <div className={`absolute top-1/2 left-0 h-1 bg-purple-500 -translate-y-1/2 rounded-full transition-all duration-500 ${step === 1 ? 'w-1/2' : 'w-full'}`} />
          
          <div className="w-1/2 flex justify-center z-10">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${step >= 1 ? 'bg-purple-600 text-white' : 'bg-[#1a1a2e] text-gray-400 border border-white/20'}`}>1</div>
          </div>
          <div className="w-1/2 flex justify-center z-10">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${step === 2 ? 'bg-purple-600 text-white' : 'bg-[#1a1a2e] text-gray-400 border border-white/20'}`}>2</div>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-xl mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={step === 2 ? handleSubmit : (e) => { e.preventDefault(); setStep(2); }}>
          
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <h2 className="text-2xl font-bold mb-6 text-white border-b border-white/10 pb-4">Host Information</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Host Name</label>
                  <input required name="hostName" value={formData.hostName} onChange={handleChange} placeholder="Enter your full name" className="w-full bg-[#1a1a2e] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none transition-colors" />
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
                    placeholder="Enter contact number"
                    className="w-full bg-[#1a1a2e] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none transition-colors" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">College / Organization Name</label>
                  <input required name="collegeName" value={formData.collegeName} onChange={handleChange} placeholder="Enter institution name" className="w-full bg-[#1a1a2e] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none transition-colors" />
                </div>
              </div>
              
              <div className="flex justify-end pt-4">
                <button 
                  type="button" 
                  onClick={() => {
                    if (formData.hostPhoneNumber.length < 10) {
                      setError("Host phone number must be at least 10 digits");
                      return;
                    }
                    setError("");
                    setStep(2);
                  }} 
                  className="bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 text-white font-bold py-3 px-8 rounded-xl transition-all"
                >
                  Next Step →
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <h2 className="text-2xl font-bold mb-6 text-white border-b border-white/10 pb-4">Event Details</h2>
              
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
                  <label className="block text-sm font-medium text-gray-300 mb-2">Location (City, State / Virtual Link)</label>
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
                <label className="block text-sm font-medium text-gray-300 mb-2">Registration Link (External)</label>
                <input 
                  required 
                  type="url" 
                  name="registrationLink" 
                  value={formData.registrationLink} 
                  onChange={handleChange} 
                  placeholder="https://your-event-registration-link.com"
                  className="w-full bg-[#1a1a2e] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none transition-colors" 
                />
                <p className="text-xs text-gray-400 mt-2">Provide a Google Form, Unstop, or official registration page link.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Poster Upload</label>
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={(e) => setPoster(e.target.files?.[0] || null)}
                  className="w-full bg-[#1a1a2e] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-purple-500 outline-none transition-colors file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-500 file:text-white hover:file:bg-purple-600" 
                />
                <p className="text-xs text-gray-400 mt-2">Max file size: 5MB.</p>
              </div>

              <div className="flex justify-between pt-4">
                <button type="button" onClick={() => setStep(1)} className="bg-white/5 hover:bg-white/10 text-white font-medium py-3 px-8 rounded-xl transition-all border border-white/10">
                  ← Back
                </button>
                <button type="submit" disabled={loading} className="bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-[0_0_20px_rgba(168,85,247,0.4)] disabled:opacity-50">
                  {loading ? "Submitting..." : "Submit Event"}
                </button>
              </div>
            </div>
          )}

        </form>
      </div>
    </div>
  );
}
