import { Video } from 'lucide-react';
import Link from 'next/link';

export default function Layout({ children }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center space-x-2">
              <Video className="h-8 w-8 text-indigo-600" />
              <span className="text-2xl font-bold text-gray-800">Clips</span>
            </Link>
            <nav className="flex items-center space-x-6">
              <Link href="/" className="text-gray-600 hover:text-indigo-600 transition-colors">
                New Clip
              </Link>
              <Link href="/transcripts" className="text-gray-600 hover:text-indigo-600 transition-colors">
                My Library
              </Link>
            </nav>
          </div>
        </div>
      </header>
      <main className="flex-grow">
        {children}
      </main>
      <footer className="bg-gray-100 border-t border-gray-200">
        <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8 text-center text-gray-500">
          <p>&copy; {new Date().getFullYear()} Clips. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
} 