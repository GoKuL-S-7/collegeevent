import { Calendar, MapPin, CreditCard, GraduationCap, ArrowUpRight, TrendingUp, Globe } from 'lucide-react';
import Link from 'next/link';

interface EventProps {
  event: {
    _id: string;
    title: string;
    category: string;
    collegeName: string;
    location: string;
    mode: string;
    entryFee: number;
    dateTime: string;
    description: string;
    posterUrl?: string;
    registrationCount?: number;
    likes?: number;
  };
}

export default function EventCard({ event }: EventProps) {
  const date = new Date(event.dateTime).toLocaleDateString('en-IN', {
    month: 'short', day: 'numeric', year: 'numeric'
  });

  const isFree = event.entryFee === 0;
  const isOnline = event.mode === 'online';

  const posterSrc = event.posterUrl
    ? (event.posterUrl.startsWith('http')
      ? event.posterUrl
      : `${process.env.NEXT_PUBLIC_API_URL}${event.posterUrl.startsWith('/') ? event.posterUrl : '/' + event.posterUrl}`)
    : 'https://placehold.co/600x400/1a1a2e/ffffff?text=Event';

  return (
    <div className="group relative bg-[#1a1a2e]/60 backdrop-blur-md rounded-2xl border border-white/5 hover:border-purple-500/40 transition-all duration-400 overflow-hidden flex flex-col h-full shadow-lg hover:shadow-purple-500/10 hover:-translate-y-1">
      
      {/* Hover glow */}
      <div className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-purple-500/10 via-transparent to-pink-500/5 pointer-events-none" />

      {/* Poster Section */}
      <div className="relative aspect-[16/9] overflow-hidden rounded-t-2xl">
        <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a2e] via-[#1a1a2e]/20 to-transparent z-10" />

        <img
          src={posterSrc}
          alt={event.title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />

        {/* Top Badges */}
        <div className="absolute top-3 left-3 z-20 flex flex-wrap gap-1.5">
          <span className="px-2.5 py-1 rounded-lg bg-black/50 backdrop-blur-md border border-white/10 text-[10px] font-black uppercase tracking-wider text-purple-300">
            {event.category}
          </span>
          <span className={`px-2.5 py-1 rounded-lg backdrop-blur-md border border-white/10 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
            isOnline ? 'bg-blue-500/30 text-blue-200' : 'bg-emerald-500/30 text-emerald-200'
          }`}>
            {isOnline ? <Globe className="w-3 h-3 text-blue-400" /> : <MapPin className="w-3 h-3 text-emerald-400" />}
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>

        {/* Price Badge - top right */}
        <div className="absolute top-3 right-3 z-20">
          <span className={`px-2.5 py-1 rounded-lg backdrop-blur-md border text-[10px] font-black uppercase tracking-wider ${
            isFree
              ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
              : 'bg-white/10 border-white/20 text-white'
          }`}>
            {isFree ? 'FREE' : `₹${event.entryFee}`}
          </span>
        </div>

        {/* Registration count - bottom right of image */}
        {(event.registrationCount ?? 0) > 0 && (
          <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1 px-2 py-1 rounded-lg bg-black/50 backdrop-blur-md border border-white/10">
            <TrendingUp className="w-3 h-3 text-orange-400" />
            <span className="text-[10px] font-black text-orange-300">{event.registrationCount} registered</span>
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="p-4 flex-grow flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-black text-white group-hover:text-purple-300 transition-colors duration-300 line-clamp-2 leading-snug mb-1">
            {event.title}
          </h3>
          <p className="text-gray-500 text-[11px] font-medium line-clamp-1 flex items-center gap-1">
            <GraduationCap className="w-3.5 h-3.5 text-purple-400" />
            {event.collegeName}
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-gray-400">
            <Calendar className="w-3.5 h-3.5 flex-shrink-0 text-purple-400" />
            <span className="text-[11px] font-medium">{date}</span>
          </div>

          <div className="flex items-center gap-2 text-gray-400">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-pink-400" />
            <span className="text-[11px] font-medium line-clamp-1">
              {isOnline ? 'Virtual Event' : event.location}
            </span>
          </div>
        </div>

        <Link
          href={`/events/${event._id}`}
          className="mt-auto group/btn flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-purple-600/10 hover:bg-purple-600 text-purple-400 hover:text-white border border-purple-500/20 hover:border-purple-500 transition-all duration-300 text-xs font-black uppercase tracking-wider"
        >
          Explore
          <ArrowUpRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  );
}
