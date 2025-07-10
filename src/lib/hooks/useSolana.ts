'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { useConnection } from '@solana/wallet-adapter-react';
import { useState, useCallback } from 'react';
import { Transaction, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';

export const useSolana = () => {
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getBalance = useCallback(async () => {
    if (!publicKey) return 0;
    try {
      const balance = await connection.getBalance(publicKey);
      return balance / LAMPORTS_PER_SOL;
    } catch (err) {
      console.error('Error getting balance:', err);
      return 0;
    }
  }, [publicKey, connection]);

  const sendPointlessTransaction = useCallback(async (message: string = "I was here.") => {
    if (!publicKey) {
      setError('Please connect your wallet first');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Create a pointless transaction that sends a tiny amount to a burn address
      // This is the most useless transaction possible
      const burnAddress = new PublicKey('11111111111111111111111111111111');
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: burnAddress,
          lamports: 1000, // 0.000001 SOL - the most pointless amount
        })
      );

      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature, 'confirmed');
      
      return signature;
    } catch (err) {
      console.error('Error sending transaction:', err);
      setError(err instanceof Error ? err.message : 'Failed to send transaction');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [publicKey, sendTransaction, connection]);

  return {
    publicKey,
    isLoading,
    error,
    getBalance,
    sendPointlessTransaction,
  };
}; 