'use client';

import { useState, useEffect, useRef } from 'react';
import { useSolana } from '../lib/hooks/useSolana';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import Image from 'next/image';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, orderBy, query, serverTimestamp, doc, getDoc, setDoc, increment, updateDoc, onSnapshot, limit } from 'firebase/firestore';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyB5a83r68LXLCwrn82tgYl8TlPoJCO7qhc",
  authDomain: "pointlessblockchain.firebaseapp.com",
  projectId: "pointlessblockchain",
  storageBucket: "pointlessblockchain.firebasestorage.app",
  messagingSenderId: "54354428082",
  appId: "1:54354428082:web:2af3b887ac566b94c5c9ab"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function randomHash() {
  const chars = 'abcdef0123456789';
  return Array.from({ length: 64 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function getNow() {
  return new Date().toLocaleString();
}

interface Block {
  id?: string;
  number: number;
  hash: string;
  prevHash: string;
  timestamp: string;
  wallet?: string;
}

interface ChatMessage {
  id?: string;
  wallet: string;
  username: string;
  message: string;
  timestamp: string;
}

function useTypewriter(text: string, speed = 60) {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    setDisplayed('');
    let i = 0;
    const interval = setInterval(() => {
      setDisplayed((prev) => prev + text[i]);
      i++;
      if (i >= text.length) clearInterval(interval);
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);
  return displayed;
}

export default function PointlessBlockchain() {
  const { publicKey, isLoading, error } = useSolana();
  const wallet = useWallet();
  const { setVisible } = useWalletModal();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [totalClicks, setTotalClicks] = useState(0);
  const [totalTimeWasted, setTotalTimeWasted] = useState(0);
  const [hashrate, setHashrate] = useState(() => Math.floor(Math.random() * 1000000) + 100000 + ' H/s');
  const [isAddingBlock, setIsAddingBlock] = useState(false);
  const typewriter = useTypewriter('POINTLESS BLOCKCHAIN', 60);
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const [command, setCommand] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sessionStartTime, setSessionStartTime] = useState<number>(Date.now());
  const [isChatMode, setIsChatMode] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const blocksPerPage = 25;
  const totalPages = Math.ceil(blocks.length / blocksPerPage);
  const startIndex = (currentPage - 1) * blocksPerPage;
  const endIndex = startIndex + blocksPerPage;
  const currentBlocks = blocks.slice(startIndex, endIndex);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
    setSessionStartTime(Date.now());
    // Initialize terminal with welcome message and help
    setTerminalLines([
      'Everything here is pointless, why bother?',
      '',
      'Available commands:',
      '  help              - Show this help',
      '  connect-wallet    - Open wallet connection modal',
      '  disconnect-wallet - Disconnect current wallet',
      '  add-empty-block   - Add a new empty block to the chain',
      '  pointless-stats   - Show blockchain statistics',
      '  chat              - Enter chatroom mode',
      '  clear             - Clear terminal output',
      ''
    ]);
  }, []);

  // Update time wasted every 10 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      const currentTime = Date.now();
      const sessionTime = Math.floor((currentTime - sessionStartTime) / 1000);
      
      if (sessionTime > 0) {
        try {
          const statsRef = doc(db, 'stats', 'global');
          await updateDoc(statsRef, {
            totalTimeWasted: increment(sessionTime)
          });
          // Reset session start time after updating
          setSessionStartTime(currentTime);
        } catch (error) {
          console.error('Error updating time wasted:', error);
        }
      }
    }, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, [sessionStartTime]);

  // Reset to first page when blocks change
  useEffect(() => {
    setCurrentPage(1);
  }, [blocks]);

  // Watch for wallet connection changes
  useEffect(() => {
    if (publicKey) {
      const shortenedAddress = `${publicKey.toString().slice(0, 4)}...${publicKey.toString().slice(-4)}`;
      setTerminalLines(prev => [
        ...prev,
        `Wallet connected successfully: ${shortenedAddress}`,
        ''
      ]);
    }
  }, [publicKey]);

  // Load chat messages
  useEffect(() => {
    if (isChatMode) {
      const q = query(collection(db, 'messages'), orderBy('timestamp', 'desc'), limit(50));
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const loadedMessages: ChatMessage[] = [];
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
          loadedMessages.push({
            id: doc.id,
            wallet: data.wallet,
            username: data.username,
            message: data.message,
            timestamp: timestamp
          });
        });
        setMessages(loadedMessages.reverse()); // Show oldest first
      });
      return () => unsubscribe();
    }
  }, [isChatMode]);

  // Command handler
  function handleCommand(cmd: string) {
    const trimmed = cmd.trim();
    if (!trimmed) return;
    let output: string[] = [];
   
   if (isChatMode) {
     // Chat mode commands
     if (trimmed === 'back' || trimmed === 'exit') {
       setIsChatMode(false);
       setTerminalLines(prev => [...prev, 'Exited chatroom. Back to terminal.', '']);
       return;
     } else if (trimmed.startsWith('send ')) {
       const message = trimmed.substring(5);
       if (message.trim() && publicKey) {
         sendMessage(message.trim());
         setCommand('');
         return;
       } else {
         output = ['Usage: send <message>'];
       }
     } else if (trimmed === 'help') {
       output = [
         'Chat Commands:',
         '  send <message>  - Send a message',
         '  back            - Exit chatroom',
         '  exit            - Exit chatroom',
         '  help            - Show this help',
         ''
       ];
     } else {
       output = [`Unknown chat command: ${trimmed}. Type "help" for available commands.`];
     }
   } else {
     // Normal terminal commands
    if (trimmed === 'help') {
      output = [
        'Available commands:',
        '  help              - Show this help',
        '  connect-wallet    - Open wallet connection modal',
        '  disconnect-wallet - Disconnect current wallet',
        '  add-empty-block   - Add a new empty block to the chain',
        '  pointless-stats   - Show blockchain statistics',
        '  chat              - Enter chatroom mode',
        '  clear             - Clear terminal output',
        ''
      ];
    } else if (trimmed === 'connect-wallet') {
      if (publicKey) {
        output = ['Wallet already connected. Use "disconnect-wallet" to disconnect.'];
      } else {
        setVisible(true);
        output = ['Opening wallet connection modal...'];
      }
    } else if (trimmed === 'disconnect-wallet') {
      if (publicKey) {
        wallet.disconnect();
        output = ['Wallet disconnected successfully.'];
      } else {
        output = ['No wallet connected. Use "connect-wallet" to connect.'];
      }
    } else if (trimmed === 'add-empty-block') {
      if (!publicKey) {
        output = ['Please connect a wallet first using "connect-wallet".'];
      } else {
        addBlock();
        output = ['Adding empty block to the chain...'];
      }
    } else if (trimmed === 'pointless-stats') {
      output = [
        'POINTLESS BLOCKCHAIN STATISTICS',
        '==============================',
        `Total Empty Blocks: ${blocks.length}`,
        `Button Presses:     ${totalClicks}`,
        `Time Wasted:        ${totalTimeWasted} s`,
        `Hashrate:           ${hashrate} H/s`,
        ''
      ];
    } else if (trimmed === 'chat') {
      if (!publicKey) {
        output = ['Please connect a wallet first using "connect-wallet".'];
      } else {
        output = [
          'Entering chatroom...',
          'Type "send <message>" to send a message.',
          'Type "back" or "exit" to return to terminal.',
          ''
        ];
        // Add delay before entering chat mode
        setTimeout(() => {
          setIsChatMode(true);
        }, 2000); // 2 second delay
      }
    } else if (trimmed === 'clear') {
      setTerminalLines([]);
      return;
    } else {
      output = [`Command not found: ${trimmed}. Type "help" for available commands.`];
    }
   }
    
    setTerminalLines(prev => [...prev, `$ ${trimmed}`, ...output]);
  }

  // Send chat message
  async function sendMessage(message: string) {
    if (!publicKey) return;
    
    try {
      const username = `${publicKey.toString().slice(0, 4)}...${publicKey.toString().slice(-4)}`;
      const chatMessage: ChatMessage = {
        wallet: publicKey.toString(),
        username: username,
        message: message,
        timestamp: getNow()
      };
      
      await addDoc(collection(db, 'messages'), chatMessage);
    } catch (error) {
      console.error('Error sending message:', error);
      setTerminalLines(prev => [...prev, 'Error: Failed to send message.', '']);
    }
  }

  useEffect(() => {
    loadBlocksFromFirebase();
    loadGlobalStats();
  }, []);

  async function loadBlocksFromFirebase() {
    try {
      const q = query(collection(db, 'blocks'), orderBy('timestamp', 'desc'));
      const querySnapshot = await getDocs(q);
      const loadedBlocks: Block[] = [];
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
        loadedBlocks.push({
          id: doc.id,
          number: data.number,
          hash: data.hash,
          prevHash: data.prevHash,
          timestamp: timestamp,
          wallet: data.wallet
        });
      });
      setBlocks(loadedBlocks);
      setTotalClicks(loadedBlocks.length);
    } catch (error) {
      console.error('Error loading blocks:', error);
    }
  }

  async function loadGlobalStats() {
    try {
      const statsDoc = doc(db, 'stats', 'global');
      const statsSnapshot = await getDoc(statsDoc);
      if (statsSnapshot.exists()) {
        const data = statsSnapshot.data();
        setTotalTimeWasted(data.totalTimeWasted || 0);
      } else {
        await setDoc(statsDoc, {
          totalTimeWasted: 0,
          totalClicks: 0
        });
        setTotalTimeWasted(0);
      }
    } catch (error) {
      console.error('Error loading global stats:', error);
    }
  }

  async function addBlock() {
    if (!publicKey) return;
    console.log('Adding block for wallet:', publicKey.toString());
    setIsAddingBlock(true);
    try {
      // Calculate the next block number based on existing blocks
      const nextBlockNumber = blocks.length > 0 ? Math.max(...blocks.map(b => b.number)) + 1 : 0;
      console.log('Next block number:', nextBlockNumber);
      
      const lastBlock = blocks[0]; // Get the most recent block (first in the array since we order by desc)
      const newBlock: Block = {
        number: nextBlockNumber,
        hash: randomHash(),
        prevHash: lastBlock ? lastBlock.hash : '0'.repeat(64),
        timestamp: getNow(),
        wallet: publicKey.toString()
      };
      
      // Add block to Firestore
      const docRef = await addDoc(collection(db, 'blocks'), newBlock);
      
      // Update local state immediately
      const blockWithId = { ...newBlock, id: docRef.id };
      setBlocks(prevBlocks => [blockWithId, ...prevBlocks]);
      setTotalClicks(prev => prev + 1);
      
      // Update global stats
      const statsRef = doc(db, 'stats', 'global');
      await updateDoc(statsRef, {
        totalBlocks: increment(1),
        buttonPresses: increment(1),
      });
      
      console.log('Block added successfully:', newBlock);
      setTerminalLines(prev => [...prev, `Empty block #${newBlock.number} added successfully!`, '']);
    } catch (error) {
      console.error('Error adding block:', error);
      setTerminalLines(prev => [...prev, 'Error: Failed to add empty block.', '']);
    } finally {
      setIsAddingBlock(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-black text-green-400 font-mono text-base flex flex-col">
      {/* Terminal UI */}
      <div className="w-full max-w-3xl mx-auto mt-8 mb-4 bg-black text-green-400 font-mono text-base rounded shadow-lg border border-green-800 p-4">
        {/* Terminal Header Prompt */}
        <div className="flex items-center mb-2">
          <span className="text-green-500">user@pointlessblockchain:~$</span>
          <span className="ml-2 text-green-200 font-bold">POINTLESS BLOCKCHAIN</span>
        </div>
        {/* Terminal Output (stats and command output) */}
        <div className="min-h-[120px] whitespace-pre-wrap text-green-200 text-sm mb-2">
          {isChatMode ? (
            <div className="space-y-1">
              <div className="text-green-400 font-bold mb-2">[POINTLESS CHATROOM]</div>
              <div className="text-green-300 text-xs mb-3 border-b border-green-700 pb-2">
                Commands: send &lt;message&gt; | back | exit | help
              </div>
              {messages.length === 0 ? (
                <div className="text-green-300">No messages yet. Be the first to say something pointless!</div>
              ) : (
                messages.map((msg, i) => (
                  <div key={msg.id || i} className="text-green-200">
                    <span className="text-green-400">[{msg.timestamp}]</span>
                    <span className="text-green-300 font-bold"> {msg.username}:</span>
                    <span className="text-green-200"> {msg.message}</span>
                  </div>
                ))
              )}
            </div>
          ) : (
            terminalLines.map((line, i) => (
              <div key={i}>{line}</div>
            ))
          )}
        </div>
        {/* Command Input */}
        <div className="flex items-center bg-black px-3 py-2 rounded-none">
          <span className="text-green-300 font-bold mr-2">
            {publicKey ? `pointlessuser@${publicKey.toString().slice(0, 4)}...${publicKey.toString().slice(-4)}` : 'pointlessuser'}$
          </span>
          <div 
            className="flex-1 bg-transparent text-green-400 font-mono outline-none cursor-text"
            onClick={() => inputRef.current?.focus()}
          >
            <span className="text-green-400">{command}</span>
            <span className="text-green-300 animate-pulse">_</span>
          </div>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={command}
          onChange={e => setCommand(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleCommand(command);
              setCommand('');
            }
          }}
          placeholder={isChatMode ? "Type 'send <message>' or 'back' to exit..." : "Type a command..."}
          className="opacity-0 pointer-events-none absolute"
          autoComplete="off"
          spellCheck="false"
        />
      </div>

      {/* Blockchain Explorer Table (always below terminal) */}
      <div className="w-full max-w-3xl mx-auto">
        <pre className="text-green-200 whitespace-pre overflow-x-auto text-xs md:text-sm">
{`[BLOCKCHAIN EXPLORER]
${blocks.length === 0 ? '  No blocks yet. Connect wallet and add the first empty block.' :
  '  BLOCK# HASH                 PREV_HASH            TIMESTAMP              WALLET           '
}
${currentBlocks.map(block =>
  `  ${block.number.toString().padStart(6)} ` +
  `${(block.hash.slice(0, 8) + '...' + block.hash.slice(-8)).padEnd(20)} ` +
  `${(block.prevHash.slice(0, 8) + '...' + block.prevHash.slice(-8)).padEnd(20)} ` +
  `${block.timestamp.padEnd(22)} ` +
  `${block.wallet ? block.wallet.slice(0, 6) + '...' + block.wallet.slice(-6) : 'Unknown'.padEnd(18)}`
).join('\n')}
`}
        </pre>
        {/* Pagination Controls */}
        {blocks.length > 0 && (
          <div className="flex items-center justify-between mt-4 text-green-200 text-sm">
            <div>
              Showing blocks {startIndex + 1}-{Math.min(endIndex, blocks.length)} of {blocks.length}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="bg-green-900 text-green-200 px-3 py-1 border border-green-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-800"
              >
                ← Previous
              </button>
              <span className="px-2">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="bg-green-900 text-green-200 px-3 py-1 border border-green-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-800"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Terminal Footer */}
    </div>
  );
} 