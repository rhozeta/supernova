"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../../lib/supabaseClient';
import { useThemeManager } from '../../../lib/useTheme';
import { format, parseISO, subDays, startOfDay, endOfDay } from 'date-fns';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
);

export default function LinkDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const linkId = params?.id as string;
  const { theme } = useThemeManager(); // Get theme from our custom hook
  
  const [link, setLink] = useState<any>(null);
  const [clickData, setClickData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('7d');
  
  // Fetch link details
  useEffect(() => {
    const fetchLinkDetails = async () => {
      if (!linkId) return;
      
      try {
        setLoading(true);
        
        // Fetch link data
        const { data: linkData, error: linkError } = await supabase
          .from('links')
          .select('*')
          .eq('id', linkId)
          .single();
          
        if (linkError) throw linkError;
        
        setLink(linkData);
        
        // Fetch click data based on date range
        await fetchClickData(dateRange);
        
      } catch (err: any) {
        setError(err.message || 'Failed to load link details');
      } finally {
        setLoading(false);
      }
    };
    
    fetchLinkDetails();
  }, [linkId]);
  
  // Fetch click data with date filtering
  const fetchClickData = async (range: '7d' | '30d' | '90d' | 'all') => {
    try {
      let query = supabase
        .from('link_clicks')
        .select('*')
        .eq('link_id', linkId)
        .order('clicked_at', { ascending: true });
      
      // Apply date filtering
      if (range !== 'all') {
        const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
        const startDate = subDays(new Date(), days).toISOString();
        query = query.gte('clicked_at', startDate);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      setClickData(data || []);
      setDateRange(range);
      
    } catch (err: any) {
      setError(err.message || 'Failed to load click data');
    }
  };
  
  // Process data for chart
  const prepareChartData = () => {
    if (!clickData.length) return null;
    
    // Group clicks by day
    const clicksByDay = clickData.reduce((acc: Record<string, number>, click: any) => {
      const day = format(parseISO(click.clicked_at), 'yyyy-MM-dd');
      acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {});
    
    // Fill in missing days with zero clicks
    const days = Object.keys(clicksByDay).sort();
    if (days.length === 0) return null;
    
    const firstDay = parseISO(days[0]);
    const lastDay = parseISO(days[days.length - 1]);
    const allDays = [];
    
    let currentDay = startOfDay(firstDay);
    while (currentDay <= lastDay) {
      const dayStr = format(currentDay, 'yyyy-MM-dd');
      allDays.push(dayStr);
      currentDay = new Date(currentDay.setDate(currentDay.getDate() + 1));
    }
    
    const labels = allDays.map(day => format(parseISO(day), 'MMM d'));
    const data = allDays.map(day => clicksByDay[day] || 0);
    
    return {
      labels,
      datasets: [
        {
          label: 'Clicks',
          data,
          borderColor: '#ff6b35',
          backgroundColor: 'rgba(255, 107, 53, 0.1)',
          fill: true,
          tension: 0.4,
        },
      ],
    };
  };
  
  const chartData = prepareChartData();
  
  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Link Clicks Over Time',
      },
      tooltip: {
        callbacks: {
          title: function(context: any) {
            return context[0].label;
          },
          label: function(context: any) {
            return `${context.parsed.y} clicks`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0
        }
      }
    }
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="text-red-500 mb-4">{error}</div>
        <button 
          onClick={() => router.push('/dashboard')}
          className="btn-accent py-2 px-4 rounded-lg"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }
  
  if (!link) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="text-gray-500 mb-4">Link not found</div>
        <button 
          onClick={() => router.push('/dashboard')}
          className="btn-accent py-2 px-4 rounded-lg"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }
  
  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-8">
      <div className="mb-6">
        <button 
          onClick={() => router.push('/dashboard')}
          className="flex items-center text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-1">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          Back to Dashboard
        </button>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 mb-6">
        {/* Metadata Preview */}
        <div className="flex flex-col sm:flex-row items-center mb-6">
          {link.page_image && (
            <img
              src={link.page_image}
              alt={link.page_title || link.short_code}
              className="w-full sm:w-48 h-32 object-cover rounded-lg sm:mr-6 mb-4 sm:mb-0"
            />
          )}
          <div className="flex-1">
            {link.page_favicon && (
              <img src={link.page_favicon} alt={`${link.page_title || link.short_code} favicon`} className="w-6 h-6 inline-block mr-2" />
            )}
            <h2 className="text-2xl font-semibold inline-block">
  {link.page_title || link.short_code}
  {link.deleted && (
    <span className="inline-block bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 px-2 py-0.5 rounded-full text-xs font-semibold mr-2 mb-2 relative group cursor-pointer ml-2">
      Removed by Creator
      <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 bg-gray-800 text-white text-xs rounded shadow-lg z-50 px-3 py-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity text-center after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-8 after:border-x-transparent after:border-b-transparent after:border-t-gray-800">
        This link has been removed by the creator. You will no longer gain Qubits for clicks on this link.
      </span>
    </span>
  )}
</h2>
            {link.page_description && (
              <p className="mt-2 text-gray-600 dark:text-gray-400">{link.page_description}</p>
            )}
          </div>
        </div>
        <h1 className="text-2xl font-bold mb-2">{link.short_code}</h1>
        <div className="mb-4">
          <div className="text-sm text-gray-500 dark:text-gray-400">Original URL</div>
          <a 
            href={link.original_url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-orange-500 hover:text-orange-600 break-all"
          >
            {link.original_url}
          </a>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          <div className="stat-card p-4">
            <div className="stat-number">{link.click_count || 0}</div>
            <div className="stat-label">Total Clicks</div>
          </div>
          <div className="stat-card p-4">
            <div className="stat-number whitespace-nowrap">{format(parseISO(link.created_at), 'MMM d, yyyy')}</div>
            <div className="stat-label">Created</div>
          </div>
        </div>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Click Analytics</h2>
          <div className="flex space-x-2">
            <button 
              onClick={() => fetchClickData('7d')}
              className={`px-3 py-1 rounded text-sm ${dateRange === '7d' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-200' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}
            >
              7 Days
            </button>
            <button 
              onClick={() => fetchClickData('30d')}
              className={`px-3 py-1 rounded text-sm ${dateRange === '30d' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-200' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}
            >
              30 Days
            </button>
            <button 
              onClick={() => fetchClickData('90d')}
              className={`px-3 py-1 rounded text-sm ${dateRange === '90d' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-200' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}
            >
              90 Days
            </button>
            <button 
              onClick={() => fetchClickData('all')}
              className={`px-3 py-1 rounded text-sm ${dateRange === 'all' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-200' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}
            >
              All Time
            </button>
          </div>
        </div>
        
        {clickData.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            No click data available for this time period
          </div>
        ) : (
          <div className="h-80">
            {chartData && <Line data={chartData} options={chartOptions} />}
          </div>
        )}
      </div>
    </div>
  );
}
