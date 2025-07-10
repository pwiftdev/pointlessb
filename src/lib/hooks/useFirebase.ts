import { useState, useEffect } from 'react';
import { 
  addBlockToFirebase, 
  getBlocksFromFirebase, 
  subscribeToBlocks,
  addMessageToFirebase,
  subscribeToMessages,
  updateGlobalStats,
  incrementStats,
  getGlobalStats,
  randomHash,
  getNow,
  shortenWalletAddress,
  type Block,
  type ChatMessage,
  type GlobalStats
} from '../firebase/firebaseUtils';

export function useFirebase() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Load initial data
  useEffect(() => {
    async function loadInitialData() {
      try {
        const [initialBlocks, initialStats] = await Promise.all([
          getBlocksFromFirebase(),
          getGlobalStats()
        ]);
        setBlocks(initialBlocks);
        setStats(initialStats);
      } catch (error) {
        console.error('Error loading initial data:', error);
      } finally {
        setLoading(false);
      }
    }

    loadInitialData();
  }, []);

  // Subscribe to real-time updates
  useEffect(() => {
    const unsubscribeBlocks = subscribeToBlocks(setBlocks);
    return () => unsubscribeBlocks();
  }, []);

  // Subscribe to messages when needed
  function subscribeToChatMessages() {
    return subscribeToMessages(setMessages);
  }

  // Block operations
  const addBlock = async (walletAddress?: string) => {
    try {
      const prevHash = blocks.length > 0 ? blocks[0].hash : '0000000000000000000000000000000000000000000000000000000000000000';
      const newBlock: Omit<Block, 'id'> = {
        number: blocks.length + 1,
        hash: randomHash(),
        prevHash,
        timestamp: getNow(),
        wallet: walletAddress
      };

      await addBlockToFirebase(newBlock);
      await incrementStats('totalBlocks');
      
      return newBlock;
    } catch (error) {
      console.error('Error adding block:', error);
      throw error;
    }
  };

  // Message operations
  const sendMessage = async (walletAddress: string, message: string) => {
    try {
      const username = shortenWalletAddress(walletAddress);
      await addMessageToFirebase({
        wallet: walletAddress,
        username,
        message
      });
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  };

  // Stats operations
  const updateStats = async (updates: Partial<GlobalStats>) => {
    try {
      await updateGlobalStats(updates);
      const newStats = await getGlobalStats();
      if (newStats) {
        setStats(newStats);
      }
    } catch (error) {
      console.error('Error updating stats:', error);
      throw error;
    }
  };

  const incrementStatsField = async (field: 'totalBlocks' | 'totalClicks' | 'totalTimeWasted', amount: number = 1) => {
    try {
      await incrementStats(field, amount);
      const newStats = await getGlobalStats();
      if (newStats) {
        setStats(newStats);
      }
    } catch (error) {
      console.error('Error incrementing stats:', error);
      throw error;
    }
  };

  return {
    // State
    blocks,
    messages,
    stats,
    loading,
    
    // Operations
    addBlock,
    sendMessage,
    updateStats,
    incrementStatsField,
    subscribeToChatMessages,
    
    // Utilities
    randomHash,
    getNow,
    shortenWalletAddress
  };
} 