const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fetch = require('node-fetch');

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();
const logger = functions.logger;

const HN_API_BASE = 'https://hacker-news.firebaseio.com/v0';
const BATCH_SIZE = 400;
const BACKLOG_BATCHES = 30;
const THIRTY_DAYS = 30 * 24 * 60 * 60;
const THIRTY_DAYS_AGO = Math.floor(Date.now() / 1000) - THIRTY_DAYS;
const INITIAL_JUMP_SIZE = 100000; // Start with 100k jumps
const FIRESTORE_CHUNK_SIZE = 100;

// Retry logic
async function fetchWithRetry(url, retries = 3, backoff = 300) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, backoff * (i + 1)));
      } else {
        throw error;
      }
    }
  }
}

// Fetch a single post from Hacker News
async function fetchStory(id) {
  try {
    const story = await fetchWithRetry(`${HN_API_BASE}/item/${id}.json`);
    return story;
  } catch (error) {
    logger.error(`Error fetching story ${id}:`, error);
    return null;
  }
}


// Check if post meets criteria for inclusion in the database
function isValidStory(story) {
  if (!story || story.type !== 'story') return false;

  const score = story.score || 0;
  const commentCount = story.descendants || 0;

  if (score <= 0 || commentCount <= 0) return false;
  if (score < 10 && commentCount < 10) return false;

  const timestamp = story.time || 0;
  return timestamp >= THIRTY_DAYS_AGO;
}


// Returns the most current post ID from Hacker News
async function getMaxItemId() {
  try {
    const response = await fetchWithRetry(`${HN_API_BASE}/maxitem.json`);
    return response;
  } catch (error) {
    logger.error('Error fetching maxitem:', error);
    throw error;
  }
}

// Pulls exiting saved story IDs from the database
async function getExistingStoryIds(ids) {
  const docRefs = ids.map(id => db.collection('stories').doc(id.toString()));
  const snapshots = await db.getAll(...docRefs);

  const existingIds = snapshots
    .filter(doc => doc.exists)
    .map(doc => parseInt(doc.id));

  return existingIds;
}


// Process batch of new IDs
async function processBatch(batchIds) {

  // Check for existing stories
  const existingIds = await getExistingStoryIds(batchIds);
  const newStoryIds = batchIds.filter(id => !existingIds.includes(id));

  if (newStoryIds.length === 0) {
    logger.info('No new stories in this batch.');
    return;
  }

  const stories = await Promise.all(newStoryIds.map(fetchStory));
  const validStories = stories.filter(isValidStory);

  if (validStories.length > 0) {

    // We have new stories, save them to the database.
    const writeBatch = db.batch();

    for (const story of validStories) {
      const storyRef = db.collection('stories').doc(story.id.toString());
      writeBatch.set(storyRef, {
        id: story.id,
        title: story.title,
        url: story.url || null,
        score: story.score || 0,
        commentCount: story.descendants || 0,
        by: story.by,
        timestamp: story.time,
        date: new Date(story.time * 1000).toISOString().split('T')[0]
      });
    }

    await writeBatch.commit();
    logger.info(`Saved ${validStories.length} stories from batch`);
  } else {
    logger.info('No valid stories found in this batch.');
  }
}



// Clears out outdated stories from the database
async function removeOldStories() {
  const oldStoriesSnapshot = await db.collection('stories')
    .where('timestamp', '<', THIRTY_DAYS_AGO)
    .get();

  if (oldStoriesSnapshot.empty) return;

  const batch = db.batch();
  oldStoriesSnapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  logger.info(`Removed ${oldStoriesSnapshot.size} old stories`);
}


// Clears all stories from the database
async function clearStories() {
  const snapshot = await db.collection('stories').get();

  if (snapshot.empty) return;

  const batch = db.batch();
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  logger.info('Cleared all stories from the database.');
}


// Clears all batches from the backlog database
async function clearBacklog() {
  const snapshot = await db.collection('backlog').get();

  if (snapshot.empty) return;

  const batch = db.batch();
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  logger.info('Cleared all backlog batches from the database.');
}


// Process new stories from today (every 30 minutes)
// Process new stories from today (every 30 minutes)
async function processNewStoriesFromToday() {
  try {
    const maxItemId = await getMaxItemId();

    // Get the max item ID in the database
    const snapshot = await db.collection('stories')
      .orderBy('id', 'desc')
      .limit(1)
      .get();

    if (snapshot.empty) {
      // Handle the case where 'stories' is empty (unexpected state)
      logger.error("The 'stories' collection is empty. This function should only be used to update an existing dataset.");
      return; // Exit the function
    }

    let maxStoredId = snapshot.docs[0].data().id;

    if (maxItemId <= maxStoredId) {
      logger.info('No new stories to process.');
      return;
    }

    const newIdsCount = maxItemId - maxStoredId;
    logger.info(`Found ${newIdsCount} new IDs to process.`);

    // Generate list of new IDs
    const newIds = [];
    for (let id = maxStoredId + 1; id <= maxItemId; id++) {
      newIds.push(id);
    }

    // Divide the IDs into batches of BATCH_SIZE and process
    for (let i = 0; i < newIds.length; i += BATCH_SIZE) {
      const batchIds = newIds.slice(i, i + BATCH_SIZE);
      await processBatch(batchIds);
    }

    logger.info(`Processed ${newIds.length} new stories.`);

  } catch (error) {
    logger.error('Error in processNewStoriesFromToday:', error);
  }
}


// Save batches of Post IDs to review to the database
async function saveBacklogBatches(backlogBatches) {
  try {
    logger.info(`Saving ${backlogBatches.length} batches to backlog`);

    for (let i = 0; i < backlogBatches.length; i += FIRESTORE_CHUNK_SIZE) {
      const batchChunk = backlogBatches.slice(i, i + FIRESTORE_CHUNK_SIZE);
      const writeBatch = db.batch();
      
      batchChunk.forEach((batchIds, index) => {
        // Create a document reference with an auto-generated ID
        const batchDocRef = db.collection('backlog').doc();
        
        // Store the entire batch of IDs as a single array in the document
        writeBatch.set(batchDocRef, {
          batchIds: batchIds,
          status: 'pending',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          batchNumber: i + index // Keep track of batch order
        });
      });
      
      await writeBatch.commit();
      logger.info(`Saved batch chunk ${i} to ${i + batchChunk.length}`);
    }
    
  } catch (error) {
    logger.error('Error saving backlog batches:', error);
    throw error;
  }
}

// Process a backlog batch
async function processBacklogBatches(numBatches) {
  try {
    const backlogSnapshot = await db.collection('backlog')
      .where('status', '==', 'pending')
      .orderBy('batchNumber') // Process in order
      .limit(numBatches)
      .get();

    if (backlogSnapshot.empty) {
      logger.info('No backlog batches to process.');
      return;
    }

    for (const doc of backlogSnapshot.docs) {
      const batchData = doc.data();
      const batchIds = batchData.batchIds;
      
      await processBatch(batchIds);
      
      // Update the batch status to 'processed'
      await doc.ref.update({ 
        status: 'processed', 
        processedAt: admin.firestore.FieldValue.serverTimestamp() 
      });
      
      logger.info(`Processed batch ${batchData.batchNumber}`);
    }
  } catch (error) {
    logger.error('Error processing backlog batches:', error);
    throw error;
  }
}


// Helper function to check if a story's timestamp is within 30 days
async function isWithinThirtyDays(storyId) {
  const story = await fetchStory(storyId);
  return story && story.time && story.time >= THIRTY_DAYS_AGO;
}

// Binary search-like approach to find the cutoff point
async function findCutoffPoint(maxId) {
  let high = maxId;
  let low = Math.max(1, maxId - INITIAL_JUMP_SIZE);
  
  // Find rough range with exponential search
  for (let attempts = 0; attempts < 10; attempts++) {
    try {
      const isWithin = await isWithinThirtyDays(low);
      if (!isWithin) break;
      high = low;
      low = Math.max(1, low - INITIAL_JUMP_SIZE);
      attempts = 0;  // Reset on success
    } catch (error) {
      logger.error(`Network error at ID ${low}, attempt ${attempts + 1}/10`);
      if (attempts === 9) throw new Error('Failed to find cutoff point');
    }
  }

  // Binary search for precise cutoff
  while (high - low > BATCH_SIZE) {
    const mid = Math.floor((high + low) / 2);
    try {
      await isWithinThirtyDays(mid) ? (high = mid) : (low = mid);
    } catch (error) {
      logger.error(`Network error at ID ${mid}, retrying...`);
    }
  }
  
  return high;
}


// Generate batches once we know the cutoff point
function generateBatches(maxId, cutoffId) {
  const batches = [];
  let currentId = maxId;
  
  while (currentId >= cutoffId) {
    const batchEnd = Math.max(cutoffId, currentId - BATCH_SIZE + 1);
    const batch = [];
    
    for (let id = currentId; id >= batchEnd; id--) {
      batch.push(id);
    }
    
    batches.push(batch);
    currentId = batchEnd - 1;
  }
  
  return batches;
}

// Main function to create backlog batches efficiently
async function createBacklogBatches() {
  try {
    const maxItemId = await getMaxItemId();
    console.log(`Starting search with max ID: ${maxItemId}`);
    
    // Find the cutoff point using binary search approach
    const cutoffId = await findCutoffPoint(maxItemId);
    console.log(`Found cutoff ID: ${cutoffId}`);
    
    // Generate the final batches
    const batches = generateBatches(maxItemId, cutoffId);
    console.log(`Generated ${batches.length} batches`);
    
    await saveBacklogBatches(batches);

    console.log('Backlog batches saved successfully.');

    return;

  } catch (error) {
    console.error('Error creating backlog batches:', error);
    throw error;
  }
}


// Main process for updating posts
async function fullUpdateProcess(isInitialLoad = false) {
  try {

    logger.info(`Starting update process (${isInitialLoad ? 'initial load' : 'scheduled update'})`);

    if (isInitialLoad) {

      // First load or reload.

      // Generate backlog batches during initial load
      await createBacklogBatches();
      logger.info('Successfully created backlog batches');

    } else {

      // Normal Update Scedule

      // Regular scheduled update
      // Process new stories since the last update
      await processNewStoriesFromToday();
      logger.info('Processed new stories from today');

      // Process a specified number of backlog batches
      await processBacklogBatches(BACKLOG_BATCHES);
      logger.info(`Processed ${BACKLOG_BATCHES} backlog batches`);

      // Remove stories older than 30 days
      await removeOldStories();
      logger.info('Removed old stories');

    }


    logger.info('Update process completed.');

  } catch (error) {
    logger.error('Error in update process:', error);
    throw error;
  }
}


// API Function: Manual Update
exports.manualUpdate = functions.runWith({
  timeoutSeconds: 540,
  memory: '2GB'
}).https.onRequest(async (req, res) => {
  try {
    logger.info('Manual update triggered');

    // CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'GET') {
      res.status(405).json({
        success: false,
        error: 'Method not allowed'
      });
      return;
    }

    // Clear existing stories and backlog
    logger.info('Clearing existing data...');
    await Promise.all([
      clearStories(),
      clearBacklog()
    ]);

    // Start the update process
    logger.info('Starting full update process...');
    
    try {
      await fullUpdateProcess(true);  // Wait for the process to complete
      
      res.json({
        success: true,
        message: 'Database cleared and update completed.'
      });

    } catch (error) {
      logger.error('Error during update process:', error);
      res.status(500).json({
        success: false,
        error: 'Update process failed'
      });
    }
  } catch (error) {
    logger.error('Error in manual update:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});


// API Function: Scheduled Update (30 mins)
exports.scheduledUpdate = functions.runWith({
  timeoutSeconds: 540,
  memory: '2GB',
  maxInstances: 1
}).pubsub.schedule('every 30 minutes').onRun(async () => {
  logger.info('Starting scheduled update');
  try {
    await fullUpdateProcess(false);
    logger.info('Scheduled update completed successfully');
  } catch (error) {
    logger.error('Error in scheduled update:', error);
  }
});


// API Function: API (Main Post function)
exports.api = functions.runWith({
  timeoutSeconds: 60,
  memory: '2GB'
}).https.onRequest(async (req, res) => {
  logger.info('API request received');

  res.set('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const snapshot = await db.collection('stories')
      .where('timestamp', '>=', THIRTY_DAYS_AGO)
      .orderBy('timestamp', 'desc')
      .get();

    const stories = snapshot.docs.map(doc => doc.data());
    logger.info(`Returning ${stories.length} stories`);
    res.json({ stories });

  } catch (error) {
    logger.error('Error fetching stories:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
});


// API Function: Stats
exports.stats = functions.runWith({
  timeoutSeconds: 60,
  memory: '2GB'
}).https.onRequest(async (req, res) => {
  logger.info('Stats request received');

  // Set CORS headers for preflight requests
  res.set('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') {
    // Handle preflight requests
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }

  if (req.method !== 'GET') {
    // Only allow GET requests
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    // 1. Total stored posts in the database
    const totalPostsSnapshot = await db.collection('stories').count().get();
    const totalPosts = totalPostsSnapshot.data().count || 0;

    // 2. Total stored posts by day (distribution by date)
    // Fetch only the 'date' field from stories to minimize data transfer
    const storiesQuery = db.collection('stories').select('date');

    // Initialize an empty object to store counts per day
    const postsPerDay = {};

    // Use Firestore pagination to handle large datasets efficiently
    let lastVisible = null;
    const pageSize = 1000; // Adjust as needed; Firestore's maximum is 10,000
    let hasMore = true;

    while (hasMore) {
      let query = storiesQuery.orderBy('date').limit(pageSize);
      if (lastVisible) {
        query = query.startAfter(lastVisible);
      }

      const snapshot = await query.get();

      if (snapshot.empty) {
        hasMore = false;
        break;
      }

      snapshot.docs.forEach(doc => {
        const date = doc.data().date;
        if (date) {
          postsPerDay[date] = (postsPerDay[date] || 0) + 1;
        }
      });

      lastVisible = snapshot.docs[snapshot.docs.length - 1];

      if (snapshot.size < pageSize) {
        hasMore = false;
      }
    }

    // 3. Progress towards backfilling the database
    // Get counts of total and pending batches from the backlog collection
    const [totalBatchesSnapshot, pendingBatchesSnapshot] = await Promise.all([
      db.collection('backlog').count().get(),
      db.collection('backlog').where('status', '==', 'pending').count().get()
    ]);

    const totalBatches = totalBatchesSnapshot.data().count || 0;
    const pendingBatches = pendingBatchesSnapshot.data().count || 0;
    const processedBatches = totalBatches - pendingBatches;
    const percentComplete = totalBatches > 0
      ? parseFloat(((processedBatches / totalBatches) * 100).toFixed(2))
      : 100;

    // Construct the stats object with the KPIs
    const stats = {
      total_posts: totalPosts,
      posts_per_day: postsPerDay,
      progress: {
        total_batches: totalBatches,
        pending_batches: pendingBatches,
        processed_batches: processedBatches,
        percent_complete: percentComplete
      }
    };

    // Respond with the stats
    res.json(stats);
  } catch (error) {
    logger.error('Error generating stats:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      details: error.message
    });
  }
});
