import React from 'react';

interface ProgressBarProps {
  progress: number;
  message?: string;
}

export function ProgressBar({ progress, message }: ProgressBarProps) {
  return (
    <div className="w-full max-w-md mx-auto p-4">
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-orange-500 to-blue-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      {message && (
        <p className="text-center text-sm text-gray-600 mt-2">{message}</p>
      )}
    </div>
  );
}