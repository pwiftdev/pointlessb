import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  doc, 
  updateDoc, 
  increment,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from './firebase';

// Types
export interface Block {
  id?: string;
  number: number;
  hash: string;
  prevHash: string;
  timestamp: string;
  wallet?: string;
}

export interface ChatMessage {
  id?: string;
  wallet: string;
  username: string;
  message: string;
  timestamp: string;
}

export interface GlobalStats {
  totalBlocks: number;
  totalClicks: number;
  totalTimeWasted: number;
  lastUpdated: any;
}

// Block operations
export async function addBlockToFirebase(block: Omit<Block, 'id'>) {
  try {
    const docRef = await addDoc(collection(db, 'blocks'), {
      ...block,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding block:', error);
    throw error;
  }
}

export async function getBlocksFromFirebase(): Promise<Block[]> {
  try {
    const q = query(collection(db, 'blocks'), orderBy('number', 'desc'));
    const querySnapshot = await getDocs(q);
    const blocks: Block[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      blocks.push({
        id: doc.id,
        number: data.number,
        hash: data.hash,
        prevHash: data.prevHash,
        timestamp: data.timestamp,
        wallet: data.wallet
      });
    });
    return blocks;
  } catch (error) {
    console.error('Error getting blocks:', error);
    return [];
  }
}

export function subscribeToBlocks(callback: (blocks: Block[]) => void) {
  const q = query(collection(db, 'blocks'), orderBy('number', 'desc'));
  return onSnapshot(q, (querySnapshot) => {
    const blocks: Block[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      blocks.push({
        id: doc.id,
        number: data.number,
        hash: data.hash,
        prevHash: data.prevHash,
        timestamp: data.timestamp,
        wallet: data.wallet
      });
    });
    callback(blocks);
  });
}

// Message operations
export async function addMessageToFirebase(message: Omit<ChatMessage, 'id' | 'timestamp'>) {
  try {
    const docRef = await addDoc(collection(db, 'messages'), {
      ...message,
      timestamp: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding message:', error);
    throw error;
  }
}

export function subscribeToMessages(callback: (messages: ChatMessage[]) => void) {
  const q = query(collection(db, 'messages'), orderBy('timestamp', 'desc'), limit(50));
  return onSnapshot(q, (querySnapshot) => {
    const messages: ChatMessage[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      let timestamp = '';
      if (data.timestamp) {
        if (data.timestamp.toDate) {
          timestamp = data.timestamp.toDate().toLocaleString();
        } else if (data.timestamp.seconds) {
          timestamp = new Date(data.timestamp.seconds * 1000).toLocaleString();
        } else {
          timestamp = data.timestamp;
        }
      }
      messages.push({
        id: doc.id,
        wallet: data.wallet,
        username: data.username,
        message: data.message,
        timestamp: timestamp
      });
    });
    callback(messages.reverse()); // Show oldest first
  });
}

// Stats operations
export async function updateGlobalStats(updates: Partial<GlobalStats>) {
  try {
    const statsRef = doc(db, 'stats', 'global');
    await updateDoc(statsRef, {
      ...updates,
      lastUpdated: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating stats:', error);
    throw error;
  }
}

export async function incrementStats(field: 'totalBlocks' | 'totalClicks' | 'totalTimeWasted', amount: number = 1) {
  try {
    const statsRef = doc(db, 'stats', 'global');
    await updateDoc(statsRef, {
      [field]: increment(amount),
      lastUpdated: serverTimestamp()
    });
  } catch (error) {
    console.error('Error incrementing stats:', error);
    throw error;
  }
}

export async function getGlobalStats(): Promise<GlobalStats | null> {
  try {
    const statsRef = doc(db, 'stats', 'global');
    const statsDoc = await getDocs(collection(db, 'stats'));
    if (!statsDoc.empty) {
      const data = statsDoc.docs[0].data();
      return {
        totalBlocks: data.totalBlocks || 0,
        totalClicks: data.totalClicks || 0,
        totalTimeWasted: data.totalTimeWasted || 0,
        lastUpdated: data.lastUpdated
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting stats:', error);
    return null;
  }
}

// Utility functions
export function randomHash(): string {
  const chars = 'abcdef0123456789';
  return Array.from({ length: 64 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function getNow(): string {
  return new Date().toLocaleString();
}

export function shortenWalletAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
} 