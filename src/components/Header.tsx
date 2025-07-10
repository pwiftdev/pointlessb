import Image from 'next/image';

export default function Header() {
  return (
    <header className="bg-black border-b border-green-800 py-4 px-6">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        {/* Logo and Brand */}
        <div className="flex items-center space-x-4">
          <div className="relative w-12 h-12">
            <Image
              src="/pointlessblockchainnobg.png"
              alt="Pointless Blockchain Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
          <div className="text-green-400">
            <h1 className="text-xl font-bold font-mono">POINTLESS BLOCKCHAIN</h1>
            <p className="text-xs text-green-600">The most pointless blockchain ever</p>
          </div>
        </div>
        
        {/* Navigation/Status */}
        <div className="text-green-400 text-sm font-mono">
          <div className="text-green-600">Status: Online</div>
          <div className="text-green-500">Network: PointlessNet</div>
        </div>
      </div>
    </header>
  );
} 