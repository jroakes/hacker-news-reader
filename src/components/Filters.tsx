import React from 'react';
import { Calendar, TrendingUp, MessageSquare } from 'lucide-react';

interface FiltersProps {
  timeframe: number;
  sortBy: 'score' | 'comments';
  postsPerPage: number;
  onTimeframeChange: (days: number) => void;
  onSortChange: (sort: 'score' | 'comments') => void;
  onPostsPerPageChange: (count: number) => void;
}

export function Filters({
  timeframe,
  sortBy,
  postsPerPage,
  onTimeframeChange,
  onSortChange,
  onPostsPerPageChange,
}: FiltersProps) {
  return (
    <div className="flex flex-wrap gap-4 items-center justify-end mb-6">
      <div className="flex gap-2">
        {[1, 7, 30].map((days) => (
          <button
            key={days}
            onClick={() => onTimeframeChange(days)}
            className={`
              flex items-center gap-1 px-3 py-1.5 rounded-md text-sm
              ${timeframe === days 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}
              transition-colors
            `}
          >
            <Calendar size={16} />
            {days}d
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onSortChange('score')}
          className={`
            flex items-center gap-1 px-3 py-1.5 rounded-md text-sm
            ${sortBy === 'score' 
              ? 'bg-orange-500 text-white' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}
            transition-colors
          `}
        >
          <TrendingUp size={16} />
          By Points
        </button>
        <button
          onClick={() => onSortChange('comments')}
          className={`
            flex items-center gap-1 px-3 py-1.5 rounded-md text-sm
            ${sortBy === 'comments' 
              ? 'bg-orange-500 text-white' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}
            transition-colors
          `}
        >
          <MessageSquare size={16} />
          By Comments
        </button>
      </div>

      <select
        value={postsPerPage}
        onChange={(e) => onPostsPerPageChange(Number(e.target.value))}
        className="px-3 py-1.5 rounded-md text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
      >
        {[25, 50, 100].map((count) => (
          <option key={count} value={count}>
            {count} per page
          </option>
        ))}
      </select>
    </div>
  );
}