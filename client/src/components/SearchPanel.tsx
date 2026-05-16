"use client";
import { useState } from 'react';
import { Search, Tag, Globe, Calendar } from 'lucide-react';

export default function SearchPanel({ onSearch }: { onSearch: (filters: any) => void }) {
  const [category, setCategory] = useState('');
  const [mode, setMode] = useState('');
  const [date, setDate] = useState('');

  const handleSearch = () => {
    onSearch({ category, mode, date });
  };

  return (
    <div className="bg-[#1a1a2e]/60 backdrop-blur-2xl p-2 rounded-[32px] border border-white/5 shadow-2xl relative z-10">
      <div className="bg-[#0f0f1b]/50 rounded-[28px] p-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
        
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">
            <Tag className="w-3 h-3" />
            Category
          </div>
          <div className="relative group">
            <select 
              value={category} 
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-[#1a1a2e] border border-white/5 rounded-2xl px-5 py-4 text-sm text-white appearance-none focus:outline-none focus:border-purple-500/50 transition-all cursor-pointer hover:bg-[#1a1a2e]/80"
            >
              <option value="">All Categories</option>
              <option value="hackathon">Hackathon</option>
              <option value="workshop">Workshop</option>
              <option value="concert">Concert</option>
              <option value="seminar">Seminar</option>
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 group-hover:text-purple-400 transition-colors">
              <Search className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">
            <Globe className="w-3 h-3" />
            Environment
          </div>
          <select 
            value={mode} 
            onChange={(e) => setMode(e.target.value)}
            className="w-full bg-[#1a1a2e] border border-white/5 rounded-2xl px-5 py-4 text-sm text-white appearance-none focus:outline-none focus:border-purple-500/50 transition-all cursor-pointer hover:bg-[#1a1a2e]/80"
          >
            <option value="">Any Mode</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">
            <Calendar className="w-3 h-3" />
            Timeline
          </div>
          <input 
            type="date" 
            value={date} 
            onChange={(e) => setDate(e.target.value)}
            className="w-full bg-[#1a1a2e] border border-white/5 rounded-2xl px-5 py-4 text-sm text-white focus:outline-none focus:border-purple-500/50 transition-all [color-scheme:dark] hover:bg-[#1a1a2e]/80"
          />
        </div>

        <button 
          onClick={handleSearch}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white font-black uppercase tracking-widest text-xs py-5 rounded-2xl shadow-xl shadow-purple-600/20 transition-all active:scale-[0.98]"
        >
          <Search className="w-4 h-4" />
          Filter Pulse
        </button>
      </div>
    </div>
  );
}

