import Image from 'next/image';

export default function Footer() {
  return (
    <footer className="w-full border-t border-green-800 bg-black py-6 flex flex-col items-center justify-center">
      <div className="relative w-16 h-16 mb-2">
        <Image
          src="/pointlessblockchainnobg.png"
          alt="Pointless Blockchain Logo"
          fill
          className="object-contain"
          priority
        />
      </div>
      <div className="text-green-600 text-xs font-mono text-center">
        most pointless thing ever built. no vision. no future. why bother?
      </div>
    </footer>
  );
} 