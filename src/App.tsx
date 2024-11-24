import React, { useEffect, useState } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { Menu, RefreshCw, Bookmark, X } from 'lucide-react';
import { api } from './lib/api';
import { db, type Story } from './lib/db';
import { ProgressBar } from './components/ProgressBar';
import { StoryCard } from './components/StoryCard';
import { Filters } from './components/Filters';

function App() {
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [stories, setStories] = useState<Story[]>([]);
  const [timeframe, setTimeframe] = useState(30);
  const [sortBy, setSortBy] = useState<'score' | 'comments'>('score');
  const [postsPerPage, setPostsPerPage] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [storyCount, setStoryCount] = useState(0);
  const [showBookmarked, setShowBookmarked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const loadStoriesFromDB = async (days: number) => {
    const allStories = showBookmarked 
      ? await db.getBookmarkedStories(days)
      : await db.getStoriesInTimeframe(days);
    setStories(allStories);
    setStoryCount(allStories.length);
    setCurrentPage(1);
  };

  const refreshStories = async () => {
    setLoading(true);
    setProgress(0);

    try {
      const stories = await api.fetchStories(setProgress);
      await db.syncWithAPI(stories);
      await loadStoriesFromDB(timeframe);
      setMenuOpen(false);
      toast.success('Stories updated successfully');
    } catch (error) {
      console.error('Error refreshing stories:', error);
      toast.error('Failed to refresh stories');
    } finally {
      setLoading(false);
    }
  };

  const handleTimeframeChange = async (days: number) => {
    setTimeframe(days);
    await loadStoriesFromDB(days);
  };

  const handleToggleBookmark = async (id: number) => {
    const story = stories.find(s => s.id === id);
    if (!story) return;

    const updatedStory = { 
      ...story, 
      isBookmarked: story.isBookmarked ? 0 : 1 
    };
    
    try {
      await db.addOrUpdateStories([updatedStory]);
      
      if (showBookmarked) {
        // If in bookmarked view, refresh the bookmarked stories list
        const bookmarkedStories = await db.getBookmarkedStories(timeframe);
        setStories(bookmarkedStories);
        setStoryCount(bookmarkedStories.length);
      } else {
        // If in all stories view, just update the story in the current list
        setStories(stories.map(s => s.id === id ? updatedStory : s));
      }
      
      toast.success(
        updatedStory.isBookmarked 
          ? 'Story bookmarked' 
          : 'Bookmark removed'
      );
    } catch (error) {
      console.error('Error toggling bookmark:', error);
      toast.error('Failed to update bookmark');
    }
  };

  const handleToggleBookmarks = async () => {
    setShowBookmarked(!showBookmarked);
    setMenuOpen(false);
    setLoading(true);
    
    try {
      if (showBookmarked) {
        // Switching to all stories view
        const allStories = await db.getStoriesInTimeframe(timeframe);
        setStories(allStories);
        setStoryCount(allStories.length);
      } else {
        // Switching to bookmarked view
        const bookmarkedStories = await db.getBookmarkedStories(timeframe);
        setStories(bookmarkedStories);
        setStoryCount(bookmarkedStories.length);
      }
      setCurrentPage(1);
    } catch (error) {
      console.error('Error toggling bookmarks view:', error);
      toast.error('Failed to switch views');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initializeApp = async () => {
      setLoading(true);
      try {
        const stories = await api.fetchStories(setProgress);
        await db.syncWithAPI(stories);
        await loadStoriesFromDB(timeframe);
      } catch (error) {
        console.error('Error initializing app:', error);
        toast.error('Failed to load stories');
      } finally {
        setLoading(false);
      }
    };

    initializeApp();
  }, []);

  const sortedStories = [...stories].sort((a, b) => {
    if (sortBy === 'score') {
      return b.score - a.score;
    }
    return b.commentCount - a.commentCount;
  });

  const totalPages = Math.ceil(sortedStories.length / postsPerPage);
  const startIndex = (currentPage - 1) * postsPerPage;
  const displayedStories = sortedStories.slice(startIndex, startIndex + postsPerPage);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(Math.max(1, Math.min(newPage, totalPages)));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />
      
      <header className="bg-white shadow-sm relative">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">
              {showBookmarked ? 'Bookmarked Stories' : 'Hacker News Reader'}
            </h1>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 hover:bg-gray-100 rounded-md transition-colors"
              aria-label="Menu"
            >
              {menuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Dropdown Menu */}
        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
            <button
              onClick={handleToggleBookmarks}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
            >
              <Bookmark size={16} className={showBookmarked ? 'text-blue-500' : ''} />
              {showBookmarked ? 'Show All Stories' : 'Show Bookmarks'}
            </button>
            <button
              onClick={refreshStories}
              disabled={loading}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Refresh Database
            </button>
          </div>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8" onClick={() => menuOpen && setMenuOpen(false)}>
        {loading ? (
          <ProgressBar 
            progress={progress} 
            message="Loading stories..." 
          />
        ) : (
          <>
            <Filters
              timeframe={timeframe}
              sortBy={sortBy}
              postsPerPage={postsPerPage}
              onTimeframeChange={handleTimeframeChange}
              onSortChange={setSortBy}
              onPostsPerPageChange={setPostsPerPage}
            />
            
            <div className="space-y-6 mb-8">
              {displayedStories.map((story) => (
                <StoryCard
                  key={story.id}
                  story={story}
                  onToggleBookmark={handleToggleBookmark}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-700">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </main>

      <footer className="bg-gray-50 border-t border-gray-200 py-4">
        <div className="max-w-5xl mx-auto px-4">
          <p className="text-sm text-gray-600 text-center">
            {storyCount.toLocaleString()} stories in database
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;