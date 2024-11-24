import Dexie, { Table } from 'dexie';

export interface Story {
  id: number;
  title: string;
  time: number;
  score: number;
  url?: string;
  by: string;
  commentCount: number;
  type: string;
  isBookmarked?: number;
}

class HNDatabase extends Dexie {
  stories!: Table<Story>;

  constructor() {
    super('HNReader');
    this.version(1).stores({
      stories: '++id, time, score, commentCount, isBookmarked'
    });
  }

  async getBookmarkedStories(days?: number): Promise<Story[]> {
    let query = this.stories.where('isBookmarked').equals(1);
    
    if (days) {
      const cutoffTimestamp = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000);
      query = query.and(item => item.time >= cutoffTimestamp);
    }
    
    return query.toArray();
  }

  async addOrUpdateStories(stories: Story[]): Promise<void> {
    console.log(`Adding/updating ${stories.length} stories to database`);
    await this.stories.bulkPut(stories);
  }

  async getStoriesInTimeframe(days: number): Promise<Story[]> {
    const cutoffTimestamp = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000);
    console.log(`Getting stories newer than ${new Date(cutoffTimestamp * 1000).toISOString()}`);
    
    return this.stories
      .where('time')
      .aboveOrEqual(cutoffTimestamp)
      .toArray();
  }

  async syncWithAPI(stories: Story[]): Promise<void> {
    // Get existing bookmarks to preserve them
    const bookmarks = await this.getBookmarkedStories();
    const bookmarkIds = new Set(bookmarks.map(b => b.id));
    
    // Merge new stories with bookmark status
    const mergedStories = stories.map(story => ({
      ...story,
      isBookmarked: bookmarkIds.has(story.id) ? 1 : 0
    }));

    // Clear existing stories and add new ones
    await this.stories.clear();
    await this.stories.bulkPut(mergedStories);
  }
}

export const db = new HNDatabase();