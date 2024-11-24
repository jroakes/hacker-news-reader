interface HNStory {
  id: number;
  title: string;
  url: string | null;
  score: number;
  commentCount: number;
  by: string;
  timestamp: number;
  date: string;
}

interface APIResponse {
  stories: HNStory[];
}

class HNFetcher {
  private baseUrl = 'https://cleanhackernewsapi.web.app/api';
  private abortController: AbortController;

  constructor() {
    this.abortController = new AbortController();
  }

  private async fetchJson<T>(url: string): Promise<T> {
    try {
      const response = await fetch(url, {
        signal: this.abortController.signal,
        headers: { 'Accept': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching data:', error);
      throw error;
    }
  }

  async fetchStories(onProgress?: (progress: number) => void) {
    try {
      console.log('Fetching stories from API...');
      const response = await this.fetchJson<APIResponse>(`${this.baseUrl}/posts`);
      
      const stories = response.stories.map(story => ({
        id: story.id,
        title: story.title,
        time: story.timestamp,
        score: story.score,
        url: story.url || undefined,
        by: story.by,
        commentCount: story.commentCount,
        type: 'story'
      }));

      if (onProgress) {
        onProgress(100);
      }

      return stories;
    } catch (error) {
      console.error('Error fetching stories:', error);
      throw error;
    }
  }

  async getComments(storyId: number): Promise<any[]> {
    try {
      const story = await this.fetchJson<any>(`https://hacker-news.firebaseio.com/v0/item/${storyId}.json`);
      if (!story || !story.kids) return [];

      const topCommentIds = story.kids.slice(0, 5);
      const comments = await Promise.all(
        topCommentIds.map(id => 
          this.fetchJson<any>(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
        )
      );
      
      return comments.filter(comment => 
        comment && !comment.deleted && !comment.dead
      );
    } catch (error) {
      console.error('Error fetching comments:', error);
      throw error;
    }
  }

  abort() {
    this.abortController.abort();
    this.abortController = new AbortController();
  }
}

export const api = new HNFetcher();