import React, { useState } from 'react';
import { Bookmark, MessageSquare, ExternalLink } from 'lucide-react';
import type { Story } from '../lib/db';
import { api } from '../lib/api';

interface StoryCardProps {
  story: Story;
  onToggleBookmark: (id: number) => void;
}

export function StoryCard({ story, onToggleBookmark }: StoryCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const toggleComments = async () => {
    if (!showComments && comments.length === 0) {
      setLoading(true);
      try {
        const newComments = await api.getComments(story.id);
        setComments(newComments);
      } catch (error) {
        console.error('Error loading comments:', error);
      }
      setLoading(false);
    }
    setShowComments(!showComments);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h2 className="text-xl font-semibold mb-2 text-gray-900">
            {story.url ? (
              <a 
                href={story.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:text-orange-600 transition-colors flex items-center gap-2"
              >
                {story.title}
                <ExternalLink size={16} className="inline-block" />
              </a>
            ) : (
              story.title
            )}
          </h2>
          <div className="text-sm text-gray-600">
            {story.score} points by {story.by} on {formatDate(story.time)}
          </div>
        </div>
        <button
          onClick={() => onToggleBookmark(story.id)}
          className="ml-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <Bookmark
            size={20}
            className={story.isBookmarked ? 'fill-blue-500 text-blue-500' : 'text-gray-400'}
          />
        </button>
      </div>

      <div className="mt-4">
        <button
          onClick={toggleComments}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-orange-600 transition-colors"
        >
          <MessageSquare size={16} />
          {story.commentCount} comments
        </button>

        {showComments && (
          <div className="mt-4">
            <div className="mb-4">
              <a
                href={`https://news.ycombinator.com/item?id=${story.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-blue-500 hover:text-blue-600 transition-colors bg-blue-50 px-3 py-1.5 rounded-md"
              >
                <ExternalLink size={16} />
                View full discussion on Hacker News
              </a>
            </div>
            <div className="space-y-4">
              {loading ? (
                <p className="text-sm text-gray-600">Loading comments...</p>
              ) : comments.length > 0 ? (
                comments.map((comment) => (
                  <div key={comment.id} className="pl-4 border-l-2 border-gray-200">
                    <div className="text-sm text-gray-600 mb-1">
                      {comment.by} • {formatDate(comment.time)}
                    </div>
                    <div 
                      className="text-sm text-gray-800"
                      dangerouslySetInnerHTML={{ __html: comment.text }}
                    />
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-600">No comments available.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}