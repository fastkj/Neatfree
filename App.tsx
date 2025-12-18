
import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { PublicHome } from './pages/PublicHome';
import { AdminDashboard } from './pages/AdminDashboard';
import { AppConfig, CustomLink, DEFAULT_SOURCES, DEFAULT_DOMAIN, DEFAULT_OWNER, DEFAULT_REPO } from './types';
import { fetchCustomLinks, fetchSources } from './services/githubService';

// Storage Keys
const STORAGE_CONFIG = 'clashhub_config_v3'; 
const STORAGE_SOURCES = 'clashhub_sources_v3';
const STORAGE_LINKS = 'clashhub_links_v3';

const App: React.FC = () => {
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  
  // App State
  const [config, setConfig] = useState<AppConfig>({
    githubToken: '', 
    repoOwner: DEFAULT_OWNER,
    repoName: DEFAULT_REPO,
    customDomain: DEFAULT_DOMAIN
  });

  const [sources, setSources] = useState<string[]>(DEFAULT_SOURCES);
  const [customLinks, setCustomLinks] = useState<CustomLink[]>([]);

  // Initialize from storage
  useEffect(() => {
    const savedConfig = localStorage.getItem(STORAGE_CONFIG);
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        setConfig({
          ...parsed,
          repoOwner: parsed.repoOwner || DEFAULT_OWNER,
          repoName: parsed.repoName || DEFAULT_REPO
        });
      } catch (e) {
        console.error("Failed to parse config", e);
      }
    }

    const savedSources = localStorage.getItem(STORAGE_SOURCES);
    if (savedSources) {
      try {
        setSources(JSON.parse(savedSources));
      } catch (e) {
        console.error("Failed to parse sources", e);
      }
    }

    const savedLinks = localStorage.getItem(STORAGE_LINKS);
    if (savedLinks) {
      try {
        setCustomLinks(JSON.parse(savedLinks));
      } catch (e) {}
    }
  }, []);

  // Load latest links & sources from GitHub on mount or repo change
  useEffect(() => {
    const loadRemoteData = async () => {
      if (config.repoOwner && config.repoName) {
        try {
          // 同时加载按钮和源列表 (从 link.json 和 sources.json)
          const [links, remoteSources] = await Promise.all([
            fetchCustomLinks(config),
            fetchSources(config)
          ]);

          if (links && Array.isArray(links)) {
            setCustomLinks(links);
            localStorage.setItem(STORAGE_LINKS, JSON.stringify(links));
          }

          if (remoteSources && Array.isArray(remoteSources)) {
            setSources(remoteSources);
            localStorage.setItem(STORAGE_SOURCES, JSON.stringify(remoteSources));
          }
        } catch (e) {
            console.error("Cloud data fetch failed", e);
        }
      }
    };
    loadRemoteData();
  }, [config.repoOwner, config.repoName]);

  const handleConfigChange = (newConfig: AppConfig) => {
    setConfig(newConfig);
    localStorage.setItem(STORAGE_CONFIG, JSON.stringify(newConfig));
  };

  const handleSourcesChange = (newSources: string[]) => {
    setSources(newSources);
    localStorage.setItem(STORAGE_SOURCES, JSON.stringify(newSources));
  };

  const handleLinksChange = (newLinks: CustomLink[]) => {
    setCustomLinks(newLinks);
    localStorage.setItem(STORAGE_LINKS, JSON.stringify(newLinks));
  };

  return (
    <div className="min-h-screen flex flex-col font-sans bg-day-bg text-day-text dark:bg-night-bg dark:text-night-text transition-colors duration-300">
      <Header 
        onOpenAdmin={() => setIsAdminOpen(true)} 
        title="Clash Hub"
      />
      
      <div className="flex-1">
        <PublicHome config={config} sources={sources} customLinks={customLinks} />
      </div>

      <footer className="py-8 text-center text-sm text-gray-500/80 dark:text-gray-400/80 border-t border-black/5 dark:border-white/5">
        <p>&copy; 2025 Neat科技 | 本站仅用于学习研究，请勿非法使用。</p>
      </footer>

      {isAdminOpen && (
        <AdminDashboard 
          config={config} 
          onConfigChange={handleConfigChange}
          sources={sources}
          onSourcesChange={handleSourcesChange}
          customLinks={customLinks}
          onCustomLinksChange={handleLinksChange}
          onClose={() => setIsAdminOpen(false)}
        />
      )}
    </div>
  );
};

export default App;
