"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { User, Menu, X, Home, Search, Coins, ChevronLeft, ChevronRight } from "lucide-react";
import Tooltip from './Tooltip';

interface NavMenuProps { 
  onProfileClick?: () => void;
  className?: string;
}

export default function NavMenu({ onProfileClick, className = '' }: NavMenuProps) {
  const [contentCreator, setContentCreator] = useState(false);
  const [checked, setChecked] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    async function fetchContentCreator() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      
      // Use maybeSingle() and add error handling
      const { data, error } = await supabase
        .from("profiles")
        .select("content_creator, username")
        .eq("id", user.id)
        .maybeSingle(); 

      if (error) {
        console.error('Error fetching profile:', error);
        // Default to non-creator view on error for safety
        setContentCreator(false); 
      } else {
        // Safely access content_creator, default to false if data is null/undefined
        setContentCreator(!!data?.content_creator);
        setUsername(data?.username || null);
      }
      setChecked(true);
    }
    fetchContentCreator();
  }, []);

  if (!checked) return null;

  const navLinks = [
    {
      href: contentCreator ? "/dashboard" : "/dashboard-user",
      label: "Dashboard",
      icon: <Home className="w-5 h-5" />
    },
    {
      href: "/find-content",
      label: "Find Content",
      icon: <Search className="w-5 h-5" />
    },
    {
      href: "/qubits",
      label: "Qubits",
      icon: <Coins className="w-5 h-5" />
    }
  ];

  return (
    <>
      {/* Mobile menu button - only shown on small screens */}
      <button 
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="fixed top-4 left-4 z-50 md:hidden p-2 rounded-md bg-white dark:bg-gray-800 shadow-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        aria-label="Toggle menu"
      >
        {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Side Navigation Menu */}
      <nav className={`
        fixed top-0 left-0 z-40 h-full bg-white dark:bg-gray-800 shadow-lg transition-all duration-300
        ${isExpanded ? 'w-64' : 'w-20'}
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        ${className}
      `}>
        <div className="h-full flex flex-col">
          {/* Expand/Collapse Button */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="hidden md:block absolute -right-3 top-8 p-1 bg-orange-500 text-white rounded-full shadow-lg hover:bg-orange-600 transition-colors"
            aria-label={isExpanded ? 'Collapse menu' : 'Expand menu'}
          >
            {isExpanded ? 
              <ChevronLeft className="w-4 h-4" /> : 
              <ChevronRight className="w-4 h-4" />
            }
          </button>

          {/* Navigation Links */}
          <div className="flex-1 py-8 px-4 flex flex-col gap-2">
            {navLinks.map((link) => 
              isExpanded ? (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={`
                    flex items-center gap-4 p-3 rounded-lg text-gray-700 dark:text-gray-300
                    hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors
                  `}
                >
                  {link.icon}
                  <span>{link.label}</span>
                </Link>
              ) : (
                <Tooltip key={link.href} content={link.label}>
                  <Link
                    href={link.href}
                    onClick={() => setIsMobileOpen(false)}
                    className="flex items-center justify-center p-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    {link.icon}
                  </Link>
                </Tooltip>
              )
            )}
          </div>

          {/* Profile Link */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            {isExpanded ? (
              onProfileClick ? (
                <button 
                  onClick={() => {
                    setIsMobileOpen(false);
                    onProfileClick();
                  }}
                  className="flex items-center gap-4 p-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors"
                  aria-label="Profile"
                >
                  <User className="w-5 h-5" />
                  <span>Profile</span>
                </button>
              ) : (
                <Link 
                  href={username ? `/creator/${username}` : "/profile"}
                  onClick={() => setIsMobileOpen(false)}
                  className="flex items-center gap-4 p-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors"
                  aria-label="Profile"
                >
                  <User className="w-5 h-5" />
                  <span>Profile</span>
                </Link>
              )
            ) : (
              <Tooltip content="Profile">
                {onProfileClick ? (
                  <button 
                    onClick={() => {
                      setIsMobileOpen(false);
                      onProfileClick();
                    }}
                    className="flex items-center justify-center p-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors"
                    aria-label="Profile"
                  >
                    <User className="w-5 h-5" />
                  </button>
                ) : (
                  <Link 
                    href={username ? `/creator/${username}` : "/profile"}
                    onClick={() => setIsMobileOpen(false)}
                    className="flex items-center justify-center p-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors"
                    aria-label="Profile"
                  >
                    <User className="w-5 h-5" />
                  </Link>
                )}
              </Tooltip>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black bg-opacity-50 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}
    </>
  );
}
