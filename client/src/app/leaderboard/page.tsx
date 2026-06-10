"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Trophy, 
  Crown, 
  TrendingUp, 
  Users, 
  Eye, 
  Heart, 
  ChevronLeft, 
  Search, 
  Filter,
  Calendar,
  Zap,
  ArrowUpRight,
  Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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

export default function LeaderboardPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [timeTab, setTimeTab] = useState("all-time");
  const [categoryFilter, setCategoryFilter] = useState("all");

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  useEffect(() => {
    let result = [...events];
    
    if (searchTerm) {
      result = result.filter(e => 
        e.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        e.collegeName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (categoryFilter !== "all") {
      result = result.filter(e => e.category === categoryFilter);
    }

    setFilteredEvents(result);
  }, [searchTerm, categoryFilter, events]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/events/leaderboard`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
        setFilteredEvents(data);
      }
    } catch (error) {
      console.error("Failed to fetch leaderboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const categories = ["all", "hackathon", "workshop", "concert", "seminar"];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f1b] flex flex-col items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }} 
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Loader2 className="w-12 h-12 text-purple-500" />
        </motion.div>
        <p className="mt-4 text-gray-500 font-bold tracking-widest uppercase text-xs">Recalculating Pulse...</p>
      </div>
    );
  }

  const top3 = filteredEvents.slice(0, 3);
  const remaining = filteredEvents.slice(3);

  return (
    <div className="min-h-screen bg-[#0f0f1b] pt-32 pb-20 px-4 md:px-8 relative overflow-hidden">
      {/* Background Neon Elements */}
      <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px]" />

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <Link href="/" className="inline-flex items-center gap-2 text-gray-500 hover:text-white transition-colors mb-6 group">
              <ChevronLeft className="w-4 h-4" />
              <span className="text-xs font-black uppercase tracking-widest">Back to Hub</span>
            </Link>
            <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter leading-none">
              Social <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-blue-400">Leaderboard</span>
            </h1>
            <p className="text-gray-400 mt-4 text-lg max-w-xl">
              Real-time rankings based on student engagement, registrations, and digital impact across the campus.
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap gap-4"
          >
            <div className="bg-white/5 border border-white/10 rounded-2xl p-1 flex">
              {["This Week", "This Month", "All Time"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setTimeTab(tab.toLowerCase().replace(" ", "-"))}
                  className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                    timeTab === tab.toLowerCase().replace(" ", "-")
                      ? "bg-purple-600 text-white shadow-lg shadow-purple-600/20"
                      : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-16">
          <div className="flex-1 relative group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-purple-400 transition-colors" />
            <input
              type="text"
              placeholder="Search by event or college..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-3xl py-5 pl-14 pr-6 text-white focus:outline-none focus:border-purple-500/50 transition-all placeholder:text-gray-600 font-medium"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-8 py-4 rounded-3xl text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all border ${
                  categoryFilter === cat
                    ? "bg-purple-600/20 border-purple-500/50 text-purple-400"
                    : "bg-white/5 border-white/10 text-gray-500 hover:border-white/20"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {filteredEvents.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-32 bg-white/5 rounded-[40px] border border-white/10"
          >
            <Zap className="w-20 h-20 text-gray-700 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-white mb-2">No trending events available yet.</h2>
            <p className="text-gray-500 max-w-md mx-auto">Try adjusting your filters or check back later for live rankings.</p>
          </motion.div>
        ) : (
          <>
            {/* Podium Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20 items-end">
              {/* Rank 2 */}
              {top3[1] && (
                <motion.div 
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="order-2 md:order-1"
                >
                  <LeaderboardPodiumCard event={top3[1]} rank={2} color="text-blue-400" />
                </motion.div>
              )}
              {/* Rank 1 */}
              {top3[0] && (
                <motion.div 
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="order-1 md:order-2"
                >
                  <LeaderboardPodiumCard event={top3[0]} rank={1} color="text-yellow-400" isWinner />
                </motion.div>
              )}
              {/* Rank 3 */}
              {top3[2] && (
                <motion.div 
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="order-3"
                >
                  <LeaderboardPodiumCard event={top3[2]} rank={3} color="text-orange-400" />
                </motion.div>
              )}
            </div>

            {/* List Section */}
            <div className="space-y-4">
              <AnimatePresence>
                {remaining.map((event, index) => (
                  <motion.div
                    key={event._id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <LeaderboardListRow event={event} rank={index + 4} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function LeaderboardPodiumCard({ event, rank, color, isWinner = false }: any) {
  return (
    <div className={`relative group ${isWinner ? 'md:mb-12' : ''}`}>
      <div className={`absolute -inset-0.5 bg-gradient-to-b ${isWinner ? 'from-yellow-500/50 to-orange-500/0' : 'from-blue-500/30 to-transparent'} rounded-[40px] blur opacity-30 group-hover:opacity-100 transition duration-1000 group-hover:duration-200`} />
      <div className="relative bg-[#1a1a2e]/80 backdrop-blur-xl rounded-[40px] border border-white/5 p-8 flex flex-col items-center text-center">
        {isWinner && (
          <motion.div 
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="absolute -top-10"
          >
            <Crown className="w-16 h-16 text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]" />
          </motion.div>
        )}
        
        <div className="relative mb-6 mt-4">
          <div className={`w-32 h-32 rounded-[32px] overflow-hidden border-4 ${isWinner ? 'border-yellow-500/50' : 'border-white/10'}`}>
            <img 
              src={getPosterSrc(event.posterUrl)} 
              alt={event.title}
              onError={(e) => {
                e.currentTarget.src = 'https://placehold.co/600x400/1a1a2e/ffffff?text=Event';
              }}
              className="w-full h-full object-cover"
            />
          </div>
          <div className={`absolute -bottom-4 -right-4 w-12 h-12 rounded-2xl ${isWinner ? 'bg-yellow-500 shadow-yellow-500/40' : 'bg-white/10'} flex items-center justify-center font-black text-xl text-[#0f0f1b] shadow-lg`}>
            {rank}
          </div>
        </div>

        <h3 className="text-2xl font-black text-white leading-tight mb-2 line-clamp-1">{event.title}</h3>
        <p className={`text-sm font-bold uppercase tracking-widest ${color} mb-6`}>{event.collegeName}</p>

        <div className="grid grid-cols-2 gap-4 w-full pt-6 border-t border-white/5">
          <div>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Impact Score</p>
            <p className="text-white font-black text-xl">{event.popularityScore.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Registrations</p>
            <p className="text-white font-black text-xl">{event.registrationCount}</p>
          </div>
        </div>

        <Link 
          href={`/events/${event._id}`}
          className="mt-8 flex items-center gap-2 text-gray-400 hover:text-white text-xs font-black uppercase tracking-widest transition-all group/btn"
        >
          View Insight
          <ArrowUpRight className="w-3 h-3 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  );
}

function LeaderboardListRow({ event, rank }: any) {
  return (
    <div className="group relative">
      <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600/0 via-purple-600/20 to-purple-600/0 rounded-3xl blur opacity-0 group-hover:opacity-100 transition duration-500" />
      <div className="relative bg-[#1a1a2e]/40 backdrop-blur-xl rounded-3xl border border-white/5 p-4 md:p-6 flex flex-col md:flex-row items-center gap-6 group-hover:border-white/10 transition-all">
        <div className="w-12 text-center">
          <span className="text-2xl font-black text-gray-600 group-hover:text-purple-400 transition-colors">#{rank}</span>
        </div>

        <div className="w-20 h-20 md:w-16 md:h-16 rounded-2xl overflow-hidden border border-white/5 flex-shrink-0">
          <img 
            src={getPosterSrc(event.posterUrl)} 
            alt={event.title}
            onError={(e) => {
              e.currentTarget.src = 'https://placehold.co/600x400/1a1a2e/ffffff?text=Event';
            }}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="flex-1 text-center md:text-left">
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
            <h4 className="text-xl font-black text-white">{event.title}</h4>
            <span className="px-3 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-[10px] font-black text-purple-400 uppercase tracking-widest w-fit mx-auto md:mx-0">
              {event.category}
            </span>
          </div>
          <p className="text-gray-500 font-bold text-sm mt-1">{event.collegeName}</p>
        </div>

        <div className="grid grid-cols-3 gap-8 md:gap-12 px-8">
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <Eye className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">Views</span>
            </div>
            <p className="text-white font-black">{event.views.toLocaleString()}</p>
          </div>
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <Heart className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">Likes</span>
            </div>
            <p className="text-white font-black">{event.likes.toLocaleString()}</p>
          </div>
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-2 text-purple-400 mb-1">
              <TrendingUp className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">Score</span>
            </div>
            <p className="text-purple-400 font-black">{event.popularityScore.toLocaleString()}</p>
          </div>
        </div>

        <Link 
          href={`/events/${event._id}`}
          className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all text-white"
        >
          <ArrowUpRight className="w-5 h-5" />
        </Link>
      </div>
    </div>
  );
}
