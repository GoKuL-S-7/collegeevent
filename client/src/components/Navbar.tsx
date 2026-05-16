"use client";
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LogOut, PlusCircle, User, LayoutDashboard, Home } from 'lucide-react';

const API_BASE_URL = "http://localhost:5000";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<{ username: string; role: string } | null>(null);

  useEffect(() => {
    const checkUser = () => {
      const userData = localStorage.getItem('user');
      if (userData) {
        try {
          setUser(JSON.parse(userData));
        } catch (e) {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    };

    checkUser();
    window.addEventListener('authChange', checkUser);

    return () => {
      window.removeEventListener('authChange', checkUser);
    };
  }, []);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (pathname === '/setup-admin') return;
      if (sessionStorage.getItem('adminExists') === 'true') return;

      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/check-admin`).catch(() => null);
        if (res && res.ok) {
          const data = await res.json();
          if (!data.adminExists) {
            router.push('/setup-admin');
          } else {
            sessionStorage.setItem('adminExists', 'true');
          }
        }
      } catch (err) {
        // Silent fail for connection errors to avoid console noise
      }
    };

    checkAdminStatus();
  }, [pathname, router]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    router.push('/');
    window.dispatchEvent(new Event('authChange'));
  };

  const isAdmin = user?.role === 'admin';

  return (
    <nav className="fixed w-full z-50 bg-[#0f0f1b]/80 backdrop-blur-xl border-b border-purple-500/10 top-0 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <div className="flex-shrink-0">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20 group-hover:scale-110 transition-transform duration-300">
                <LayoutDashboard className="text-white w-6 h-6" />
              </div>
              <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-purple-200 to-purple-400">
                CampusConnect
              </span>
            </Link>
          </div>
          
          <div className="hidden md:block">
            <div className="ml-10 flex items-center space-x-6">
              <Link href="/" className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${pathname === '/' ? 'text-purple-400 bg-purple-400/10' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
                <Home className="w-4 h-4" />
                Home
              </Link>
              
              {!isAdmin && (
                <Link href="/host" className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${pathname === '/host' ? 'text-purple-400 bg-purple-400/10' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
                  <PlusCircle className="w-4 h-4" />
                  Host Event
                </Link>
              )}

              {user ? (
                <div className="flex items-center space-x-6 pl-6 border-l border-white/10">
                  <Link 
                    href={isAdmin ? '/admin' : '/profile'} 
                    className="flex items-center gap-2 group"
                  >
                    <div className="w-8 h-8 rounded-full bg-purple-500/10 border border-purple-500/30 flex items-center justify-center group-hover:border-purple-400 transition-colors">
                      <User className="w-4 h-4 text-purple-400 group-hover:text-purple-300" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-white group-hover:text-purple-300 transition-colors leading-none">{user.username}</span>
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mt-1">{user.role}</span>
                    </div>
                  </Link>
                  <button 
                    onClick={handleLogout} 
                    className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-red-400 hover:bg-red-400/10 transition-all duration-200"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              ) : (
                <Link href="/login" className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white rounded-full text-sm font-bold transition-all duration-300 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:-translate-y-0.5">
                  Get Started
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>

  );
}
