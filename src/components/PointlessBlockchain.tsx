'use client';

import { useState, useEffect, useRef } from 'react';
import { useSolana } from '../lib/hooks/useSolana';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import Image from 'next/image';
import { collection, addDoc, getDocs, orderBy, query, serverTimestamp, doc, getDoc, setDoc, increment, updateDoc, onSnapshot, limit } from 'firebase/firestore';
import app, { db } from '../lib/firebase/firebase';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';

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
  const [isMobile, setIsMobile] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const blocksPerPage = 35;
  const totalPages = Math.ceil(blocks.length / blocksPerPage);
  const startIndex = (currentPage - 1) * blocksPerPage;
  const endIndex = startIndex + blocksPerPage;
  // Show all blocks on mobile, paginated on desktop
  const currentBlocks = isMobile ? blocks : blocks.slice(startIndex, endIndex);

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

  // Detect mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
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
        '================================',
        `Total Blocks: ${blocks.length}`,
        `Total Time Wasted: ${Math.floor(totalTimeWasted / 60)} minutes`,
        `Current Hashrate: ${hashrate}`,
        `Connected Wallet: ${publicKey ? 'Yes' : 'No'}`,
        ''
      ];
    } else if (trimmed === 'chat') {
      setIsChatMode(true);
      output = ['Entering pointless chatroom...', ''];
    } else if (trimmed === 'clear') {
      setTerminalLines([]);
      return;
    } else {
      output = [`Command not found: ${trimmed}. Type "help" for available commands.`];
    }
   }
   
   if (output.length > 0) {
     setTerminalLines(prev => [...prev, ...output]);
   }
  }

  // Handle send button click
  const handleSend = () => {
    handleCommand(command);
    setCommand('');
  };

  async function sendMessage(message: string) {
    if (!publicKey) return;
    
    try {
      const username = `User${publicKey.toString().slice(0, 4)}`;
      const messageData = {
        wallet: publicKey.toString(),
        username: username,
        message: message,
        timestamp: serverTimestamp()
      };
      
      await addDoc(collection(db, 'messages'), messageData);
    } catch (error) {
      console.error('Error sending message:', error);
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
    <div className="min-h-screen w-full bg-black text-green-400 font-mono text-sm md:text-base flex flex-col px-2 md:px-4">
      {/* Terminal UI */}
      <div className="w-full max-w-4xl mx-auto mt-4 md:mt-8 mb-4 bg-black text-green-400 font-mono text-sm md:text-base rounded shadow-lg border border-green-800 p-2 md:p-4">
        {/* Terminal Header Prompt */}
        <div className="flex items-center mb-2">
          <span className="text-green-500 text-xs md:text-sm">user@pointlessblockchain:~$</span>
          <span className="ml-2 text-green-200 font-bold text-xs md:text-sm">POINTLESS BLOCKCHAIN</span>
        </div>
        {/* Terminal Output (stats and command output) */}
        <div className="min-h-[100px] md:min-h-[120px] whitespace-pre-wrap text-green-200 text-xs md:text-sm mb-2 overflow-y-auto max-h-[200px] md:max-h-[300px]">
          {isChatMode ? (
            <div className="space-y-1">
              <div className="text-green-400 font-bold mb-2 text-xs md:text-sm">[POINTLESS CHATROOM]</div>
              <div className="text-green-300 text-xs mb-3 border-b border-green-700 pb-2">
                Commands: send &lt;message&gt; | back | exit | help
              </div>
              {messages.length === 0 ? (
                <div className="text-green-300 text-xs md:text-sm">No messages yet. Be the first to say something pointless!</div>
              ) : (
                messages.map((msg, i) => (
                  <div key={msg.id || i} className="text-green-200 text-xs md:text-sm">
                    <span className="text-green-400">[{msg.timestamp}]</span>
                    <span className="text-green-300 font-bold"> {msg.username}:</span>
                    <span className="text-green-200"> {msg.message}</span>
                  </div>
                ))
              )}
            </div>
          ) : (
            terminalLines.map((line, i) => (
              <div key={i} className="text-xs md:text-sm">{line}</div>
            ))
          )}
        </div>
        {/* Command Input with Send Button */}
        <div className="flex items-center bg-black px-2 md:px-3 py-2 rounded-none gap-2">
          <span className="text-green-300 font-bold mr-2 text-xs md:text-sm flex-shrink-0">
            {publicKey ? `pointlessuser@${publicKey.toString().slice(0, 4)}...${publicKey.toString().slice(-4)}` : 'pointlessuser'}$
          </span>
          <div 
            className="flex-1 bg-transparent text-green-400 font-mono outline-none cursor-text text-xs md:text-sm"
            onClick={() => inputRef.current?.focus()}
          >
            <span className="text-green-400">{command}</span>
            <span className="text-green-300 animate-pulse">_</span>
          </div>
          {/* Send Button for Mobile */}
          <button
            onClick={handleSend}
            disabled={!command.trim()}
            className="bg-green-900 text-green-200 px-3 py-1 border border-green-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-800 text-xs md:text-sm rounded flex-shrink-0"
          >
            Send
          </button>
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
      <div className="w-full max-w-4xl mx-auto">
        <pre className="text-green-200 whitespace-pre overflow-x-auto text-xs">
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
        {/* Pagination Controls - Desktop Only */}
        {blocks.length > 0 && (
          <div className="hidden md:flex flex-row items-center justify-between mt-4 text-green-200 text-sm gap-2">
            <div className="text-left">
              Showing blocks {startIndex + 1}-{Math.min(endIndex, blocks.length)} of {blocks.length}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="bg-green-900 text-green-200 px-3 py-1 border border-green-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-800 rounded"
              >
                ← Previous
              </button>
              <span className="px-2">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="bg-green-900 text-green-200 px-3 py-1 border border-green-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-800 rounded"
              >
                Next →
              </button>
            </div>
          </div>
        )}
        
        {/* Mobile Block Count */}
        {blocks.length > 0 && (
          <div className="md:hidden text-center mt-4 text-green-200 text-xs">
            Showing all {blocks.length} blocks
          </div>
        )}

        {/* Social/Community Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 mt-8 items-center justify-center">
          <a
            href="https://x.com/pointlesschain"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-green-900 hover:bg-green-800 text-green-200 border border-green-600 px-6 py-2 rounded font-mono text-xs md:text-sm transition-colors shadow"
          >
            Twitter @pointlesschain
          </a>
          <a
            href="https://x.com/i/communities/1943440306277634548"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-green-900 hover:bg-green-800 text-green-200 border border-green-600 px-6 py-2 rounded font-mono text-xs md:text-sm transition-colors shadow"
          >
            Twitter Community
          </a>
          <a
            href="https://dexscreener.com/solana/enj7cgnkltr9uxxasfkefxvjpepgtfoo85vqbrrysxnq"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-green-900 hover:bg-green-800 text-green-200 border border-green-600 px-6 py-2 rounded font-mono text-xs md:text-sm transition-colors shadow"
          >
            DexScreener
          </a>
        </div>
      </div>

      {/* Terminal Footer */}
    </div>
  );
} 