import React, { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export const ThemeToggle: React.FC = () => {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const checkTimeAndApply = () => {
      const hour = new Date().getHours();
      // 早上5点(含)到晚上8点(不含20:00)为日间
      const isDayTime = hour >= 5 && hour < 20;
      const shouldBeDark = !isDayTime;
      
      setIsDark(shouldBeDark);
      if (shouldBeDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    checkTimeAndApply();
    // 每分钟检查一次，确保准时切换
    const interval = setInterval(checkTimeAndApply, 60000);
    return () => clearInterval(interval);
  }, []);

  const toggle = () => {
    const newMode = !isDark;
    setIsDark(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <button 
      onClick={toggle}
      className="p-2 rounded-full transition-colors hover:bg-black/10 dark:hover:bg-white/10"
      aria-label="Toggle Theme"
    >
      {isDark ? <Moon className="w-5 h-5 text-night-text" /> : <Sun className="w-5 h-5 text-day-text" />}
    </button>
  );
};