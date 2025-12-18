
import React from 'react';
import { ThemeToggle } from './ThemeToggle';
import { Settings, Zap } from 'lucide-react';

interface HeaderProps {
  onOpenAdmin: () => void;
  title?: string;
}

export const Header: React.FC<HeaderProps> = ({ onOpenAdmin, title }) => {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-day-bg/80 dark:bg-night-bg/80 border-b border-black/5 dark:border-white/5">
      <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <Zap className="w-6 h-6 text-day-text dark:text-night-text" />
          {title || "Clash Hub"}
        </h1>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button 
            onClick={onOpenAdmin}
            className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            title="Admin Dashboard"
          >
            <Settings className="w-5 h-5 text-day-text dark:text-night-text" />
          </button>
        </div>
      </div>
    </header>
  );
};
