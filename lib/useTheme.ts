"use client";

import { useState, useEffect } from 'react';

export type Theme = 'light' | 'dark';

export function useThemeManager() {
  const [theme, setTheme] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  // Initialize theme on client side only
  useEffect(() => {
    setMounted(true);
    
    // Get theme from localStorage or system preference
    const storedTheme = localStorage.getItem('theme') as Theme | null;
    
    if (storedTheme === 'dark' || storedTheme === 'light') {
      setTheme(storedTheme);
      applyTheme(storedTheme);
    } else {
      // Set dark mode as default
      const initialTheme = 'dark';
      setTheme(initialTheme);
      applyTheme(initialTheme);
      localStorage.setItem('theme', initialTheme);
    }
  }, []);

  // Toggle theme
  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    applyTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  return { theme, toggleTheme, mounted };
}

// Apply theme to document
function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
  } else {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
  }
}
