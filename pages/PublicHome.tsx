
import React, { useEffect, useState } from 'react';
import { Database, WifiOff, Loader2 } from 'lucide-react';
import { AppConfig, CustomLink, RepoFile } from '../types';
import { fetchRepoDir } from '../services/githubService';

interface PublicHomeProps {
  config: AppConfig;
  sources: string[];
  customLinks: CustomLink[];
}

const STORAGE_KEY_FILES = 'clashhub_cached_files';

export const PublicHome: React.FC<PublicHomeProps> = ({ config, sources, customLinks }) => {
  const [repoFiles, setRepoFiles] = useState<RepoFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFromCache, setIsFromCache] = useState(false);
  const [isError, setIsError] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [updateTime, setUpdateTime] = useState<string>('');

  useEffect(() => {
    const now = new Date();
    const formatted = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    setUpdateTime(formatted);

    const cached = localStorage.getItem(STORAGE_KEY_FILES);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.length > 0) {
          setRepoFiles(sortFiles(parsed));
          setIsFromCache(true);
        }
      } catch (e) {}
    }

    if (config.repoOwner && config.repoName) {
      loadContent();
    }
  }, [config.repoOwner, config.repoName]);

  const sortFiles = (files: RepoFile[]) => {
    return [...files].sort((a, b) => {
      const numA = parseInt(a.name.match(/\d+/)?.[0] || '999');
      const numB = parseInt(b.name.match(/\d+/)?.[0] || '999');
      return numA - numB;
    });
  };

  const loadContent = async () => {
    setIsLoading(true);
    setIsError(false);
    
    try {
      const files = await fetchRepoDir(config, 'clash');
      
      if (files === null || (Array.isArray(files) && files.length === 0)) {
        await probeKnownFiles();
      } else {
        const subFiles = files.filter(f => 
          (f.name.endsWith('.yaml') || f.name.endsWith('.yml')) && f.type === 'file'
        );
        const sorted = sortFiles(subFiles);
        setRepoFiles(sorted);
        setIsFromCache(false);
        setIsError(false);
        localStorage.setItem(STORAGE_KEY_FILES, JSON.stringify(sorted));
      }

    } catch (e: any) {
      console.error("Content load failed", e);
      if (repoFiles.length === 0) setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const probeKnownFiles = async () => {
    // 默认查找 .yaml 后缀的文件
    const knownNames = [
      'Neat_config1.yaml', 'Neat_config2.yaml', 'Neat_config3.yaml', 
      'Neat_config4.yaml', 'Neat_config5.yaml', 'Neat_config6.yaml', 'Neat_config7.yaml'
    ];
    const found: RepoFile[] = [];
    await Promise.all(knownNames.map(async (name) => {
      const url = `https://raw.githubusercontent.com/${config.repoOwner}/${config.repoName}/main/clash/${name}`;
      try {
        const res = await fetch(url, { method: 'HEAD' });
        if (res.ok) found.push({ name, sha: name, size: 0 } as any);
      } catch (e) {}
    }));

    if (found.length > 0) {
      const sorted = sortFiles(found);
      setRepoFiles(sorted);
      setIsFromCache(false);
      setIsError(false);
    } else if (repoFiles.length === 0) {
      setIsError(true);
    }
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const isUrl = (str: string | undefined) => {
    if (!str) return false;
    return str.startsWith('http');
  };

  const getFormatName = (name: string) => {
    // 移除 .yml 或 .yaml 后缀
    let cleanName = name.replace(/\.(yml|yaml)$/i, '');
    // 如果是 Neat_config 开头的，改为 Clash订阅源
    if (cleanName.startsWith('Neat_config')) {
      const index = cleanName.replace('Neat_config', '');
      return `Clash订阅源 ${index}`.trim();
    }
    return cleanName;
  };

  return (
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-12 space-y-6 sm:space-y-10 animate-fade-in">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-black tracking-tight sm:text-5xl text-day-text dark:text-night-text">
          Clash节点分享
        </h2>
        <p className="text-xs sm:text-lg text-gray-400 dark:text-zinc-500 max-w-2xl mx-auto font-medium px-4">
          免费订阅 · 自动获取合并互联网上的公开节点。
        </p>
      </div>

      <section className="p-5 sm:p-8 rounded-[2rem] bg-day-card dark:bg-night-card border border-black/5 dark:border-white/5 shadow-xl relative overflow-hidden">
        <div className="space-y-5 sm:space-y-8 relative z-10">
          <div className="space-y-3 sm:space-y-4">
            <h2 className="text-lg sm:text-2xl font-black text-day-text dark:text-night-text">
              使用说明
            </h2>
            <div className="text-[10px] sm:text-xs font-bold text-gray-400 dark:text-zinc-500">
              更新时间：{updateTime}
            </div>
            <div className="space-y-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400 leading-relaxed font-medium">
              <p>写了个自动获取公开节点脚本，该项目自动获取以及自动推送，如果某个订阅源失效请及时反馈以便修复，后期维护还得靠大家及时反馈，该项目只能当备用方案使用。</p>
              <p className="font-bold text-day-text dark:text-night-text">域名随时更换</p>
            </div>
          </div>

          {customLinks.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-2">
              {customLinks.map((link) => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative flex items-center gap-3 p-2.5 rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 border border-white/10 overflow-hidden"
                  style={{ 
                    backgroundColor: link.color || '#3b82f6',
                    color: '#fff'
                  }}
                >
                  <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
                  
                  <div className="w-8 h-8 sm:w-10 sm:h-10 p-1.5 rounded-xl flex items-center justify-center shrink-0 bg-white/20 backdrop-blur-md border border-white/20 shadow-sm relative z-10 overflow-hidden">
                    {link.icon && isUrl(link.icon) ? (
                      <img src={link.icon} alt={link.name} className="w-full h-full object-contain" />
                    ) : (
                      <span className="drop-shadow-lg text-sm sm:text-lg">{link.icon || '🔗'}</span>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0 relative z-10">
                    <span className="font-black text-xs sm:text-sm truncate block tracking-tight">
                      {link.name}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-lg sm:text-xl font-bold text-day-text dark:text-night-text flex items-center gap-2">
            节点订阅
            <span className="text-[10px] px-2 py-0.5 bg-black/5 dark:bg-white/5 rounded-full opacity-50">{repoFiles.length}</span>
            {isFromCache && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-bold inline-flex items-center gap-1"><Database className="w-2.5 h-2.5" /> 缓存</span>}
          </h3>
        </div>

        <div className="grid gap-3 sm:gap-4">
          {isError && repoFiles.length === 0 && (
            <div className="text-center py-12 border-2 border-dashed border-black/5 dark:border-white/5 rounded-3xl">
              <WifiOff className="w-8 h-8 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 font-bold text-xs">数据获取异常，请稍后刷新</p>
            </div>
          )}

          {isLoading && repoFiles.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <Loader2 className="w-6 h-6 text-day-text dark:text-night-text animate-spin opacity-50" />
              <p className="text-gray-400 font-bold text-[10px] sm:text-xs">加载订阅列表中...</p>
            </div>
          )}

          {repoFiles.map((file, index) => {
            const displayDomain = config.customDomain || "https://clash.fastkj.eu.org";
            const subUrl = `${displayDomain.replace(/\/$/, '')}/clash/${file.name}`;
            const isCopied = copiedIndex === index;
            const displayName = getFormatName(file.name);

            return (
              <div key={file.name} className="flex flex-col sm:flex-row items-center justify-between p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] bg-day-card dark:bg-night-card shadow-sm border border-black/5 dark:border-white/5 hover:border-black/10 dark:hover:border-white/20 transition-all duration-300 group">
                <div className="flex-1 min-w-0 w-full sm:mr-4">
                  <div className="flex items-center mb-1.5">
                    <span className="font-black text-day-text dark:text-night-text text-sm sm:text-lg truncate">{displayName}</span>
                  </div>
                  <p className="text-[9px] sm:text-[11px] font-mono break-all text-gray-400 bg-black/5 dark:bg-white/5 p-2 sm:p-3 rounded-xl select-all border border-black/5 dark:border-white/5 group-hover:border-black/10 transition-colors">
                    {subUrl}
                  </p>
                </div>
                <div className="w-full sm:w-auto mt-3 sm:mt-0 flex items-center h-full">
                  <button 
                    onClick={() => handleCopy(subUrl, index)} 
                    className={`w-full sm:w-auto flex items-center justify-center px-5 sm:px-10 py-2.5 sm:py-4 rounded-xl sm:rounded-2xl text-[11px] sm:text-sm font-black transition-all shadow-sm ${
                      isCopied 
                        ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500' 
                        : 'bg-day-text dark:bg-night-text text-day-bg dark:text-night-bg hover:shadow-lg hover:-translate-y-0.5 active:scale-95'
                    }`}
                  >
                    {isCopied ? '已复制' : '复制订阅'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
};
