"use client";

/**
 * Theme utility functions for managing dark/light mode across the application
 */

type Theme = 'dark' | 'light';

// Initialize theme from localStorage or system preference
export function initializeTheme(): Theme {
  // Check if we're in the browser environment
  if (typeof window === 'undefined') return 'light';
  
  // First try to get from localStorage
  const storedTheme = localStorage.getItem('theme') as Theme | null;
  
  if (storedTheme === 'dark' || storedTheme === 'light') {
    // Apply stored theme
    applyTheme(storedTheme);
    return storedTheme;
  } else {
    // Check system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = prefersDark ? 'dark' : 'light';
    applyTheme(theme);
    // Save the preference
    localStorage.setItem('theme', theme);
    return theme;
  }
}

// Toggle between dark and light mode
export function toggleTheme(): Theme {
  // Check if we're in the browser environment
  if (typeof window === 'undefined') return 'light';
  
  const currentTheme = getCurrentTheme();
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  applyTheme(newTheme);
  localStorage.setItem('theme', newTheme);
  
  return newTheme;
}

// Apply theme to document
export function applyTheme(theme: Theme): void {
  // Check if we're in the browser environment
  if (typeof window === 'undefined') return;
  
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
  } else {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
  }
}

// Get current theme
export function getCurrentTheme(): Theme {
  // Check if we're in the browser environment
  if (typeof window === 'undefined') return 'light';
  
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}
