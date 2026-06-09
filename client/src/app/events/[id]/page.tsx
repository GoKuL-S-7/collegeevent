"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Calendar, MapPin, CreditCard, GraduationCap, ArrowUpRight, Info, User, Phone, Tag, Globe, Clock, ChevronLeft, RefreshCw, Heart } from 'lucide-react';

export default function EventDetailsPage() {
  const params = useParams();
  const router = useRouter();
  
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/events/${params.id}`);
        if (!res.ok) throw new Error("Event not found");
        const data = await res.json();
        setEvent(data);
        
        // Track view
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/events/${params.id}/view`, { method: "POST" });
      } catch (err: any) {
        setError("Failed to load event details.");
      } finally {
        setLoading(false);
      }
    };
    if (params.id) fetchEvent();
  }, [params.id]);

  const handleLike = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/events/${event._id}/like`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setEvent({ ...event, likes: data.likes });
      }
    } catch (err) {
      console.error("Failed to like event");
    }
  };

  const handleRegister = async () => {
    try {
      setRegistering(true);
      setError("");
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/events/${event._id}/register`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (data.success) {
        setTimeout(() => {
          window.open(data.redirectUrl, "_blank", "noopener,noreferrer");
          setRegistering(false);
        }, 800);
      } else {
        throw new Error(data.error || "Registration tracking failed");
      }
    } catch (err: any) {
      setError(err.message);
      setRegistering(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-[#0f0f1b]">
        <div className="w-16 h-16 border-4 border-purple-500/20 border-t-purple-600 rounded-full animate-spin mb-4"></div>
        <p className="text-gray-500 font-medium animate-pulse">Gathering event intelligence...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-[#0f0f1b]">
        <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center mb-6 border border-red-500/20">
          <Info className="w-10 h-10 text-red-500" />
        </div>
        <h1 className="text-4xl font-black text-white mb-4 tracking-tight">Event Not Found</h1>
        <p className="text-gray-400 mb-8 max-w-xs text-center">The event you're looking for might have been removed or the link is broken.</p>
        <Link href="/" className="flex items-center gap-2 px-8 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-2xl border border-white/10 transition-all">
          <ChevronLeft className="w-4 h-4" />
          Back to Hub
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f1b] py-20 px-4 md:px-8">
      <div className="max-w-6xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-gray-500 hover:text-white transition-colors mb-10 group">
          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/5 group-hover:border-white/20 transition-all">
            <ChevronLeft className="w-4 h-4" />
          </div>
          <span className="text-sm font-bold uppercase tracking-widest">Back to Events</span>
        </Link>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-6 py-4 rounded-2xl mb-10 flex items-center gap-3 animate-in fade-in duration-300">
            <Info className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          
          {/* Main Content Column */}
          <div className="lg:col-span-2 space-y-10">
            {/* Hero Card */}
            <div className="relative rounded-[40px] overflow-hidden border border-white/5 bg-[#1a1a2e]/40 backdrop-blur-xl shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f1b] via-[#0f0f1b]/40 to-transparent z-10" />
              
              <div className="relative h-96 w-full">
                <img 
                  src={event.posterUrl ? (event.posterUrl.startsWith('http') ? event.posterUrl : `${process.env.NEXT_PUBLIC_API_URL}${event.posterUrl.startsWith('/') ? event.posterUrl : '/' + event.posterUrl}`) : 'https://placehold.co/600x400/1a1a2e/ffffff?text=Event'} 
                  alt={event.title}
                  className="absolute inset-0 w-full h-full object-cover opacity-60"
                />
                
                <div className="absolute bottom-0 left-0 w-full p-10 z-20">
                  <div className="flex items-center gap-3 mb-6">
                    <span className="px-4 py-1.5 rounded-full bg-purple-600/20 border border-purple-500/30 text-xs font-bold text-purple-300 uppercase tracking-widest backdrop-blur-md">
                      {event.category}
                    </span>
                    <span className={`px-4 py-1.5 rounded-full border text-xs font-bold uppercase tracking-widest backdrop-blur-md ${
                      event.mode === 'online' ? 'bg-blue-600/20 border-blue-500/30 text-blue-300' : 'bg-emerald-600/20 border-emerald-500/30 text-emerald-300'
                    }`}>
                      {event.mode}
                    </span>
                  </div>
                  <h1 className="text-5xl md:text-6xl font-black text-white leading-tight mb-4 tracking-tight">{event.title}</h1>
                  <div className="flex items-center gap-2 text-purple-400 font-bold text-lg">
                    <GraduationCap className="w-6 h-6" />
                    {event.collegeName}
                  </div>
                </div>
              </div>

              <div className="p-10 border-t border-white/5">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                    <Info className="w-5 h-5 text-purple-400" />
                  </div>
                  <h3 className="text-2xl font-black text-white tracking-tight">Event Blueprint</h3>
                </div>
                <p className="text-gray-400 text-lg leading-relaxed whitespace-pre-wrap">
                  {event.description}
                </p>
              </div>
            </div>
          </div>

          {/* Sidebar Column */}
          <div className="space-y-8">
            {/* Logistics Card */}
            <div className="bg-[#1a1a2e]/60 backdrop-blur-xl rounded-[40px] p-8 border border-white/5 shadow-xl">
              <h4 className="text-sm font-black text-gray-500 uppercase tracking-[0.2em] mb-8">Logistics</h4>
              
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5">
                    <Calendar className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Schedule</p>
                    <p className="text-white font-bold">{new Date(event.dateTime).toLocaleDateString(undefined, { dateStyle: 'full' })}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5">
                    <Clock className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Time</p>
                    <p className="text-white font-bold">{new Date(event.dateTime).toLocaleTimeString(undefined, { timeStyle: 'short' })}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5">
                    <MapPin className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Venue</p>
                    <p className="text-white font-bold capitalize">{event.mode === 'online' ? 'Global Virtual' : event.location}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5">
                    <CreditCard className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Access Fee</p>
                    <p className={`font-bold ${event.entryFee === 0 ? "text-emerald-400" : "text-white"}`}>
                      {event.entryFee === 0 ? "FREE ADMISSION" : `₹${event.entryFee} INR`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-10 pt-10 border-t border-white/5 flex gap-4">
                <button 
                  onClick={handleRegister}
                  disabled={registering}
                  className="flex-1 group relative flex items-center justify-center gap-3 py-5 rounded-[20px] bg-gradient-to-r from-purple-600 to-purple-500 text-white font-black uppercase tracking-widest text-sm shadow-xl shadow-purple-600/20 hover:shadow-purple-600/40 transition-all active:scale-[0.98] disabled:opacity-70"
                >
                  {registering ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Reserve Spot
                      <ArrowUpRight className="w-5 h-5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </>
                  )}
                </button>
                <button 
                  onClick={handleLike}
                  className="w-16 h-16 rounded-[20px] bg-white/5 border border-white/10 flex flex-col items-center justify-center group hover:bg-pink-500/10 hover:border-pink-500/30 transition-all"
                >
                  <Heart className={`w-6 h-6 transition-all ${event.likes > 0 ? 'fill-pink-500 text-pink-500 scale-110' : 'text-gray-500 group-hover:text-pink-400'}`} />
                  <span className="text-[10px] font-black text-gray-500 mt-1 group-hover:text-pink-400">{event.likes || 0}</span>
                </button>
              </div>
              <p className="text-center text-[10px] text-gray-600 mt-4 font-bold uppercase tracking-widest">External Secure Gateway</p>
            </div>

            {/* Host Card */}
            <div className="bg-[#1a1a2e]/30 backdrop-blur-xl rounded-[40px] p-8 border border-white/5">
              <h4 className="text-sm font-black text-gray-500 uppercase tracking-[0.2em] mb-6">Convener Details</h4>
              
              <div className="space-y-5">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                    <User className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none mb-1">Lead Contact</p>
                    <p className="text-white font-bold text-sm">@{event.hostUserId || event.createdBy?.username || 'Host'}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                    <Phone className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none mb-1">Direct Line</p>
                    <p className="text-white font-bold text-sm">+91 {event.hostPhoneNumber || event.createdBy?.phoneNumber || 'XXXXXXXXXX'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

