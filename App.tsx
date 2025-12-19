
import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { PublicHome } from './pages/PublicHome';
import { AdminDashboard } from './pages/AdminDashboard';
import { AppConfig, CustomLink, DEFAULT_SOURCES, DEFAULT_DOMAIN, DEFAULT_OWNER, DEFAULT_REPO } from './types';
import { fetchCustomLinks, fetchSources, fetchRawContent, fetchRepoDir, uploadToRepo, deleteRepoFile } from './services/githubService';

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
    customDomain: DEFAULT_DOMAIN,
    autoPushEnabled: false
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
          repoName: parsed.repoName || DEFAULT_REPO,
          autoPushEnabled: !!parsed.autoPushEnabled
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

  // 24小时自动推送逻辑
  useEffect(() => {
    const handleAutoPush = async () => {
      if (!config.autoPushEnabled || !config.githubToken || !config.repoOwner || !config.repoName) return;
      
      const now = Date.now();
      const lastPush = config.lastPushTime || 0;
      const twentyFourHours = 24 * 60 * 60 * 1000;

      if (now - lastPush >= twentyFourHours) {
        console.log("🚀 触发 24 小时自动推送...");
        try {
          const filteredSources = sources.filter(s => s.trim().startsWith('http'));
          const existingFiles = await fetchRepoDir(config, 'clash') || [];
          const neatConfigFiles = existingFiles.filter(f => /^Neat_config\d+\..+$/.test(f.name));
          
          const activeFileNames = new Set<string>();
          for (let i = 0; i < filteredSources.length; i++) {
            const url = filteredSources[i];
            const extMatch = url.match(/\.(yaml|yml|txt|conf|ini|json)$/i);
            const ext = extMatch ? extMatch[0].toLowerCase() : '.yaml';
            const fileName = `Neat_config${i + 1}${ext}`;
            activeFileNames.add(fileName);

            const content = await fetchRawContent(url);
            const existing = neatConfigFiles.find(f => f.name === fileName);
            await uploadToRepo(config, `clash/${fileName}`, content, `Auto-update ${fileName}`, existing?.sha);
          }

          // 清理旧文件
          const orphans = neatConfigFiles.filter(f => !activeFileNames.has(f.name));
          for (const orphan of orphans) {
            await deleteRepoFile(config, `clash/${orphan.name}`, orphan.sha);
          }

          // 更新推送时间
          const newConfig = { ...config, lastPushTime: now };
          setConfig(newConfig);
          localStorage.setItem(STORAGE_CONFIG, JSON.stringify(newConfig));
          console.log("✅ 自动推送圆满完成");
        } catch (e) {
          console.error("❌ 自动推送失败:", e);
        }
      }
    };

    handleAutoPush();
  }, [config.autoPushEnabled, config.githubToken, sources]);

  // Load latest links & sources from GitHub on mount or repo change
  useEffect(() => {
    const loadRemoteData = async () => {
      if (config.repoOwner && config.repoName) {
        try {
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
