"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Calendar, MapPin, CreditCard, GraduationCap, ArrowUpRight, Info, 
  User, Phone, Tag, Globe, Clock, ChevronLeft, RefreshCw, Heart, Check, Shield 
} from 'lucide-react';

export default function EventDetailsPage() {
  const params = useParams();
  const router = useRouter();
  
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);

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

  const handleButtonClick = () => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    setShowConfirmModal(true);
  };

  const handleConfirmRedirect = () => {
    setShowConfirmModal(false);
    handleRegister();
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

  // Loading skeletons
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f1b] py-20 px-4 md:px-8">
        <div className="max-w-6xl mx-auto space-y-10">
          {/* Back button skeleton */}
          <div className="w-32 h-8 bg-white/5 rounded-lg animate-pulse" />
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            {/* Left Column Skeleton */}
            <div className="lg:col-span-2 space-y-10">
              <div className="rounded-[40px] overflow-hidden border border-white/5 bg-[#1a1a2e]/40 backdrop-blur-xl p-10 space-y-6">
                <div className="h-64 bg-white/5 rounded-2xl animate-pulse" />
                <div className="space-y-3">
                  <div className="h-4 bg-white/5 rounded w-1/4 animate-pulse" />
                  <div className="h-10 bg-white/5 rounded w-3/4 animate-pulse" />
                  <div className="h-6 bg-white/5 rounded w-1/2 animate-pulse" />
                </div>
                <div className="pt-6 border-t border-white/5 space-y-4">
                  <div className="h-6 bg-white/5 rounded w-1/3 animate-pulse" />
                  <div className="space-y-2">
                    <div className="h-4 bg-white/5 rounded w-full animate-pulse" />
                    <div className="h-4 bg-white/5 rounded w-5/6 animate-pulse" />
                    <div className="h-4 bg-white/5 rounded w-4/6 animate-pulse" />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column Skeleton */}
            <div className="space-y-8">
              <div className="bg-[#1a1a2e]/60 backdrop-blur-xl rounded-3xl p-6 border border-white/5 space-y-6">
                <div className="h-4 bg-white/5 rounded w-1/3 animate-pulse" />
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex gap-4 items-center">
                      <div className="w-10 h-10 bg-white/5 rounded-xl animate-pulse" />
                      <div className="flex-grow space-y-2">
                        <div className="h-2 bg-white/5 rounded w-1/4 animate-pulse" />
                        <div className="h-4 bg-white/5 rounded w-3/4 animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-[#1a1a2e]/60 backdrop-blur-xl rounded-3xl p-6 border border-white/5 space-y-6">
                <div className="h-4 bg-white/5 rounded w-1/2 animate-pulse" />
                <div className="h-8 bg-white/5 rounded w-full animate-pulse" />
                <div className="h-12 bg-white/5 rounded w-full animate-pulse" />
              </div>
            </div>
          </div>
        </div>
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

  const getPosterSrc = (url?: string) => {
    if (!url) return 'https://placehold.co/600x400/1a1a2e/ffffff?text=Event';
    if (url.startsWith('http')) return url;
    const cleanPath = url.startsWith('/') ? url : '/' + url;
    let baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    if (baseUrl.endsWith('/')) {
      baseUrl = baseUrl.slice(0, -1);
    }
    return `${baseUrl}${cleanPath}`;
  };

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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-start">
          
          {/* Main Content Column */}
          <div className="lg:col-span-2 space-y-10">
            {/* Hero Card */}
            <div className="relative rounded-[40px] overflow-hidden border border-white/5 bg-[#1a1a2e]/40 backdrop-blur-xl shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f1b] via-[#0f0f1b]/40 to-transparent z-10" />
              
              <div className="relative h-[400px] w-full">
                <img 
                  src={getPosterSrc(event.posterUrl)} 
                  alt={event.title}
                  onError={(e) => {
                    e.currentTarget.src = 'https://placehold.co/600x400/1a1a2e/ffffff?text=Event';
                  }}
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
                  <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white leading-tight mb-4 tracking-tight">{event.title}</h1>
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
                <p className="text-gray-400 text-base md:text-lg leading-relaxed whitespace-pre-wrap">
                  {event.description}
                </p>
              </div>
            </div>
          </div>

          {/* Sticky Sidebar Column */}
          <div className="lg:sticky lg:top-24 space-y-8 self-start">
            
            {/* Logistics Card */}
            <div className="bg-[#1a1a2e]/60 backdrop-blur-xl rounded-3xl p-6 border border-white/5 shadow-xl space-y-6">
              <h4 className="text-xs font-black text-purple-400 uppercase tracking-widest">Event Logistics</h4>
              
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 flex-shrink-0">
                    <Calendar className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Event Date</p>
                    <p className="text-white font-semibold text-sm">
                      {new Date(event.dateTime).toLocaleDateString(undefined, { dateStyle: 'full' })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 flex-shrink-0">
                    <Clock className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Event Time</p>
                    <p className="text-white font-semibold text-sm">
                      {new Date(event.dateTime).toLocaleTimeString(undefined, { timeStyle: 'short' })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 flex-shrink-0">
                    <MapPin className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Venue / Location</p>
                    <p className="text-white font-semibold text-sm capitalize">
                      {event.mode === 'online' ? 'Global Virtual' : event.location}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 flex-shrink-0">
                    <Globe className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Event Mode</p>
                    <p className="text-white font-semibold text-sm capitalize">
                      {event.mode}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 flex-shrink-0">
                    <CreditCard className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Entry Fee</p>
                    <p className="text-white font-semibold text-sm">
                      {event.entryFee === 0 ? "FREE" : `₹${event.entryFee}`}
                    </p>
                  </div>
                </div>

                {event.registrationDeadline && (
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 flex-shrink-0">
                      <Clock className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Registration Deadline</p>
                      <p className="text-white font-semibold text-sm">
                        {new Date(event.registrationDeadline).toLocaleDateString(undefined, { dateStyle: 'long' })}
                      </p>
                    </div>
                  </div>
                )}

                {event.seatsAvailable !== undefined && (
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 flex-shrink-0">
                      <Tag className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Seats Available</p>
                      <p className="text-white font-semibold text-sm">
                        {event.seatsAvailable}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Registration & Payment Card */}
            <div className="bg-[#1a1a2e]/60 backdrop-blur-xl rounded-3xl p-6 border border-white/5 shadow-xl space-y-6">
              <h4 className="text-xs font-black text-purple-400 uppercase tracking-widest">Registration & Payment</h4>
              
              {event.entryFee > 0 ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-xs text-gray-400">Registration Fee</span>
                    <span className="text-sm font-bold text-white">₹{event.entryFee}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-xs text-gray-400">Payment Status</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-orange-500/10 text-orange-400 border border-orange-500/20">
                      Payment Required
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-xs text-gray-400">Payment Method</span>
                    <span className="text-xs font-bold text-gray-300">External Gateway</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-xs text-gray-400">Registration Type</span>
                    <span className="text-xs font-bold text-gray-300 capitalize">{event.mode} Event</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2">
                    <span className="text-xs text-gray-400">Registration Status</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Free Registration
                    </span>
                  </div>
                </div>
              )}

              <div className="flex gap-4 pt-2">
                <button 
                  onClick={handleButtonClick}
                  disabled={registering}
                  className="flex-grow group relative flex items-center justify-center gap-2 py-4 rounded-xl bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white font-black uppercase tracking-widest text-xs shadow-xl shadow-purple-600/20 hover:shadow-purple-600/40 transition-all active:scale-[0.98] disabled:opacity-70"
                >
                  {registering ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      {event.entryFee > 0 ? `Pay ₹${event.entryFee} & Register` : 'Register for Free'}
                      <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </>
                  )}
                </button>
                
                <button 
                  onClick={handleLike}
                  className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex flex-col items-center justify-center group hover:bg-pink-500/10 hover:border-pink-500/30 transition-all flex-shrink-0"
                >
                  <Heart className={`w-5 h-5 transition-all ${event.likes > 0 ? 'fill-pink-500 text-pink-500 scale-110' : 'text-gray-500 group-hover:text-pink-400'}`} />
                  <span className="text-[9px] font-black text-gray-500 mt-0.5 group-hover:text-pink-400">{event.likes || 0}</span>
                </button>
              </div>
              <p className="text-center text-[10px] text-gray-600 mt-4 font-bold uppercase tracking-widest">External Secure Gateway</p>
            </div>

            {/* Convener Details Card */}
            <div className="bg-[#1a1a2e]/60 backdrop-blur-xl rounded-3xl p-6 border border-white/5 shadow-xl space-y-6">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <h4 className="text-xs font-black text-purple-400 uppercase tracking-widest">Convener Details</h4>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <Check className="w-3 h-3" /> Organizer Verified
                </span>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 flex-shrink-0">
                    <User className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Organizer Name</p>
                    <p className="text-white font-semibold text-sm">{event.hostName || 'Organizer'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 flex-shrink-0">
                    <GraduationCap className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Institution</p>
                    <p className="text-white font-semibold text-sm">{event.collegeName}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 flex-shrink-0">
                    <Tag className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Host User ID</p>
                    <p className="text-purple-300 font-mono text-xs">@{event.hostUserId || event.createdBy?.username || 'Host'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 flex-shrink-0">
                    <Phone className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Contact Number</p>
                    <p className="text-white font-semibold text-sm">
                      {event.hostPhoneNumber || event.createdBy?.phoneNumber ? `+91 ${event.hostPhoneNumber || event.createdBy?.phoneNumber}` : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleButtonClick}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#0f0f1b] border border-emerald-500/20 hover:border-emerald-500/50 text-emerald-400 text-xs font-bold uppercase tracking-wider transition-all hover:bg-emerald-500/5"
                >
                  <Shield className="w-4 h-4 text-emerald-400 animate-pulse animate-duration-1000" /> Secure Registration Portal
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#16162a] border border-white/10 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-purple-400">
              <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center border border-purple-500/20 flex-shrink-0">
                <Shield className="w-5 h-5 text-purple-400 animate-pulse" />
              </div>
              <h3 className="text-lg font-bold text-white">External Portal Redirect</h3>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">
              You are about to continue to the organizer's external registration portal.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-white transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRedirect}
                className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-lg shadow-purple-600/20 transition-all"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
