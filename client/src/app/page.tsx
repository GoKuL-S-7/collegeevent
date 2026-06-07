"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Globe, Calendar, Search, RefreshCw,
  Zap, ChevronLeft, ChevronRight, ArrowRight, Flame
} from "lucide-react";
import EventCard from "@/components/EventCard";
import SearchPanel from "@/components/SearchPanel";

// ── Reusable Horizontal Carousel ─────────────────────────────────────────────
function EventCarousel({ events }: { events: any[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);

  const sync = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 8);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 8);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", sync, { passive: true });
    // Re-check after images load
    setTimeout(sync, 300);
    return () => el.removeEventListener("scroll", sync);
  }, [events]);

  const shift = (dir: "l" | "r") =>
    scrollRef.current?.scrollBy({ left: dir === "l" ? -360 : 360, behavior: "smooth" });

  const onWheel = (e: React.WheelEvent) => {
    const el = scrollRef.current;
    if (!el) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      el.scrollLeft += e.deltaY * 1.5;
    }
  };

  if (events.length === 0)
    return (
      <p className="text-gray-600 text-sm py-10 text-center">
        No events here yet. Check back soon!
      </p>
    );

  return (
    <div className="relative">
      {/* Left fade */}
      <div
        className="absolute left-0 top-0 bottom-4 w-16 bg-gradient-to-r from-[#0f0f1b] to-transparent z-10 pointer-events-none transition-opacity duration-300"
        style={{ opacity: canLeft ? 1 : 0 }}
      />
      {/* Left btn */}
      <button
        onClick={() => shift("l")}
        aria-label="Scroll left"
        className={`absolute -left-4 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-[#1e1e30] border border-white/10 flex items-center justify-center text-white shadow-lg hover:bg-white/10 transition-all duration-200 ${canLeft ? "opacity-100 scale-100" : "opacity-0 scale-75 pointer-events-none"}`}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Scrollable track */}
      <div
        ref={scrollRef}
        onWheel={onWheel}
        className="flex gap-4 overflow-x-auto pb-4"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {events.map((event) => (
          <div
            key={event._id}
            className="flex-none w-[260px] sm:w-[280px] lg:w-[300px]"
          >
            <EventCard event={event} />
          </div>
        ))}
      </div>

      {/* Right fade */}
      <div
        className="absolute right-0 top-0 bottom-4 w-16 bg-gradient-to-l from-[#0f0f1b] to-transparent z-10 pointer-events-none transition-opacity duration-300"
        style={{ opacity: canRight ? 1 : 0 }}
      />
      {/* Right btn */}
      <button
        onClick={() => shift("r")}
        aria-label="Scroll right"
        className={`absolute -right-4 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-[#1e1e30] border border-white/10 flex items-center justify-center text-white shadow-lg hover:bg-white/10 transition-all duration-200 ${canRight ? "opacity-100 scale-100" : "opacity-0 scale-75 pointer-events-none"}`}
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ── Section Header ────────────────────────────────────────────────────────────
function SectionHeader({
  icon: Icon,
  label,
  count,
  color,
  linkHref,
  linkLabel = "See all",
}: {
  icon: any;
  label: string;
  count: number;
  color: string;
  linkHref?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <Icon className={`w-5 h-5 ${color}`} />
        <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
          {label}
        </h2>
        <span
          className={`hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest ${color}`}
        >
          {count}
        </span>
      </div>
      {linkHref && (
        <Link
          href={linkHref}
          className="flex items-center gap-1 text-gray-500 hover:text-white text-xs font-black uppercase tracking-widest transition-colors group"
        >
          {linkLabel}
          <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
        </Link>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Home() {
  const [trending, setTrending] = useState<any[]>([]);
  const [virtual, setVirtual] = useState<any[]>([]);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSearch, setIsSearch] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [tRes, vRes, uRes] = await Promise.all([
          fetch("https://collegeevent-production-d8bc.up.railway.app/api/events/trending"),
          fetch("https://collegeevent-production-d8bc.up.railway.app/api/events/virtual"),
          fetch("https://collegeevent-production-d8bc.up.railway.app/api/events/upcoming"),
        ]);
        if (tRes.ok) setTrending(await tRes.json());
        if (vRes.ok) setVirtual(await vRes.json());
        if (uRes.ok) setUpcoming(await uRes.json());
      } catch {
        // silent – backend may be starting up
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSearch = async (filters: any) => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (filters.category) q.append("category", filters.category);
      if (filters.mode) q.append("mode", filters.mode);
      if (filters.date) q.append("date", filters.date);
      const res = await fetch(`https://collegeevent-production-d8bc.up.railway.app/api/events?${q}`);
      if (res.ok) {
        setFiltered(await res.json());
        setIsSearch(true);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const clearSearch = () => {
    setIsSearch(false);
    setFiltered([]);
  };

  const totalEvents = new Set([
    ...trending.map((e) => e._id),
    ...virtual.map((e) => e._id),
    ...upcoming.map((e) => e._id),
  ]).size;

  return (
    <div className="min-h-screen bg-[#0f0f1b]">

      {/* ══════════════════════ HERO ══════════════════════════ */}
      <section className="relative flex flex-col items-center justify-center text-center overflow-hidden pt-32 pb-20 px-4">
        {/* Background orbs */}
        <div className="absolute top-0 left-[10%] w-[40vw] h-[40vw] max-w-[600px] max-h-[600px] bg-purple-600/15 rounded-full blur-[120px] -z-0 pointer-events-none" />
        <div className="absolute bottom-0 right-[5%] w-[35vw] h-[35vw] max-w-[500px] max-h-[500px] bg-pink-600/12 rounded-full blur-[100px] -z-0 pointer-events-none" />

        <div className="relative z-10 w-full max-w-4xl mx-auto flex flex-col items-center gap-6">

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm text-purple-400 text-xs sm:text-sm font-bold">
            <Zap className="w-3.5 h-3.5 flex-shrink-0 fill-purple-400" />
            <span className="whitespace-nowrap">India&apos;s Largest Campus Event Network</span>
            <span className="flex-shrink-0 bg-purple-500/25 text-purple-300 text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full font-black tracking-wider">LIVE</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black text-white tracking-tighter leading-[1.05]">
            India&apos;s Premier{" "}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-500 via-pink-400 to-orange-400">
              Campus Ecosystem
            </span>
          </h1>

          {/* Sub */}
          <p className="text-gray-400 text-base sm:text-lg max-w-xl leading-relaxed">
            Discover, participate, and host the most exclusive college events — from
            high-stakes hackathons to cultural fests.
          </p>


        </div>

        {/* Bottom soft fade into search */}
        <div className="absolute bottom-0 inset-x-0 h-20 bg-gradient-to-t from-[#0f0f1b] to-transparent pointer-events-none" />
      </section>

      {/* ══════════════════════ SEARCH ═════════════════════════ */}
      <div className="relative z-20 px-4 max-w-6xl mx-auto mb-6">
        <SearchPanel onSearch={handleSearch} />
      </div>

      {/* ══════════════════════ EVENTS ═════════════════════════ */}
      <div id="events" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-28 pt-10">

        {loading ? (
          <div className="flex flex-col items-center justify-center h-72 gap-5">
            <div className="w-14 h-14 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
            <p className="text-gray-600 text-xs uppercase tracking-widest font-bold animate-pulse">
              Syncing events...
            </p>
          </div>

        ) : isSearch ? (
          /* ── Search Results ── */
          <section>
            <div className="flex items-center justify-between mb-8 pb-6 border-b border-white/5">
              <div>
                <h2 className="text-2xl font-black text-white flex items-center gap-3">
                  <Search className="w-6 h-6 text-purple-400" />
                  Search Results
                </h2>
                <p className="text-gray-500 text-sm mt-1">
                  {filtered.length} event{filtered.length !== 1 ? "s" : ""} found
                </p>
              </div>
              <button
                onClick={clearSearch}
                className="flex items-center gap-2 text-xs font-black uppercase tracking-widest px-4 py-2 rounded-xl bg-purple-500/10 text-purple-400 hover:bg-purple-500 hover:text-white border border-purple-500/20 transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Clear
              </button>
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-28 rounded-[32px] bg-white/3 border border-white/5">
                <Search className="w-16 h-16 text-gray-700 mx-auto mb-4" />
                <p className="text-white font-bold text-lg mb-1">No events found</p>
                <p className="text-gray-500 text-sm">Try different filters.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {filtered.map((e) => <EventCard key={e._id} event={e} />)}
              </div>
            )}
          </section>

        ) : (
          /* ── Three Main Sections ── */
          <div className="space-y-16">

            {/* 1 · Trending Now */}
            <section>
              <SectionHeader
                icon={Flame}
                label="Trending Now"
                count={trending.length}
                color="text-orange-400"
              />
              <EventCarousel events={trending} />
            </section>

            {/* 2 · Virtual Events */}
            <section>
              <SectionHeader
                icon={Globe}
                label="Virtual Events"
                count={virtual.length}
                color="text-blue-400"
              />
              <EventCarousel events={virtual} />
            </section>

            {/* 3 · Upcoming Events */}
            <section>
              <SectionHeader
                icon={Calendar}
                label="Upcoming Events"
                count={upcoming.length}
                color="text-emerald-400"
              />
              <EventCarousel events={upcoming} />
            </section>

          </div>
        )}
      </div>
    </div>
  );
}
