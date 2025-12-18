
import React, { useState, useEffect } from 'react';
import { RefreshCw, Plus, Trash2, Github, Link as LinkIcon, X, Settings2, ShieldCheck, Link2, Edit3, Save, Loader2 } from 'lucide-react';
import { AppConfig, CustomLink, RepoFile, DEFAULT_SOURCES } from '../types';
import { fetchRawContent, getRepoFile, uploadToRepo, saveCustomLinks, saveSources, fetchRepoDir, deleteRepoFile } from '../services/githubService';

interface AdminDashboardProps {
  config: AppConfig;
  onConfigChange: (newConfig: AppConfig) => void;
  sources: string[];
  onSourcesChange: (newSources: string[]) => void;
  customLinks: CustomLink[];
  onCustomLinksChange: (newLinks: CustomLink[]) => void;
  onClose: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  config, 
  onConfigChange, 
  sources,
  onSourcesChange,
  customLinks,
  onCustomLinksChange,
  onClose
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [localConfig, setLocalConfig] = useState<AppConfig>(config);
  const [localSources, setLocalSources] = useState<string[]>(sources.length ? sources : DEFAULT_SOURCES);
  const [localLinks, setLocalLinks] = useState<CustomLink[]>(customLinks);
  const [showBatchAdd, setShowBatchAdd] = useState(false);
  const [batchInputValue, setBatchInputValue] = useState('');
  const [repoPath, setRepoPath] = useState(`${config.repoOwner}/${config.repoName}`);
  const [editingLink, setEditingLink] = useState<CustomLink | null>(null);

  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  const addLog = (msg: string) => setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === 'admin') {
      setIsAuthenticated(true);
    } else {
      alert("密码错误");
    }
  };

  const handleRepoPathChange = (val: string) => {
    setRepoPath(val);
    if (val.includes('/')) {
      const [owner, repo] = val.split('/').map(s => s.trim());
      setLocalConfig(prev => ({ ...prev, repoOwner: owner || '', repoName: repo || '' }));
    }
  };

  const getExtensionFromUrl = (url: string): string => {
    const match = url.match(/\.(yaml|yml|txt|conf|ini|json)$/i);
    return match ? match[0].toLowerCase() : '.yaml';
  };

  const handleSaveAndSync = async () => {
    if (!localConfig.githubToken || !localConfig.repoName || !localConfig.repoOwner) {
        alert("配置不完整，请填写 GitHub 仓库和 Token");
        return;
    }
    
    setIsProcessing(true);
    setLogs([]); 
    addLog("🚀 开始保存并深度同步...");
    
    try {
        onConfigChange(localConfig);
        onSourcesChange(localSources);
        onCustomLinksChange(localLinks);

        await saveCustomLinks(localConfig, localLinks);
        addLog("✅ 按钮配置 link.json 同步完成");
        await saveSources(localConfig, localSources);
        addLog("✅ 订阅源 sources.json 同步完成");

        const existingFiles = await fetchRepoDir(localConfig, 'clash') || [];
        const neatConfigFiles = existingFiles.filter(f => /^Neat_config\d+\..+$/.test(f.name));
        const filteredSources = localSources.filter(s => s.trim().startsWith('http'));
        const newCount = filteredSources.length;
        
        const activeFileNames = new Set<string>();

        for (let i = 0; i < newCount; i++) {
            const sourceUrl = filteredSources[i];
            const extension = getExtensionFromUrl(sourceUrl);
            const fileName = `Neat_config${i + 1}${extension}`;
            activeFileNames.add(fileName);
            
            const targetFilename = `clash/${fileName}`;
            const existingFile = neatConfigFiles.find(f => f.name === fileName);
            try {
                const rawContent = await fetchRawContent(sourceUrl);
                await uploadToRepo(localConfig, targetFilename, rawContent, `Update ${fileName}`, existingFile?.sha);
                addLog(`✅ 配置更新: ${fileName}`);
            } catch (err: any) {
                addLog(`⚠️ 失败 (${fileName}): ${err.message}`);
            }
        }

        // Cleanup orphans (different extension for same index or index too high)
        const orphans = neatConfigFiles.filter(f => !activeFileNames.has(f.name));

        for (const orphan of orphans) {
          try {
            await deleteRepoFile(localConfig, `clash/${orphan.name}`, orphan.sha);
            addLog(`🗑️ 已清理多余文件: ${orphan.name}`);
          } catch (e: any) {
            addLog(`⚠️ 清理失败: ${e.message}`);
          }
        }

        addLog("✨ 全部任务已圆满完成！");
        alert("配置已成功保存并同步至 GitHub");
    } catch (err: any) {
        addLog(`❌ 致命异常: ${err.message}`);
        alert(`同步失败: ${err.message}`);
    } finally {
        setIsProcessing(false);
    }
  };

  const updateSource = (index: number, val: string) => {
    const newSources = [...localSources];
    newSources[index] = val;
    setLocalSources(newSources);
  };
  
  const removeSource = (index: number) => {
    setLocalSources(localSources.filter((_, i) => i !== index));
  };

  const addSource = () => setLocalSources([...localSources, ""]);

  const removeLink = (id: string) => {
    setLocalLinks(localLinks.filter(l => l.id !== id));
  };

  const handleAddLink = () => {
    setEditingLink({ id: Date.now().toString(), name: '', url: 'https://', color: '#3b82f6', icon: '' });
  };

  const saveEditingLink = () => {
    if (!editingLink) return;
    if (!editingLink.name || !editingLink.url) {
      alert("请完整填写按钮信息");
      return;
    }
    const exists = localLinks.find(l => l.id === editingLink.id);
    setLocalLinks(exists ? localLinks.map(l => l.id === editingLink.id ? editingLink : l) : [...localLinks, editingLink]);
    setEditingLink(null);
  };

  const isUrl = (str: string) => str && str.trim().toLowerCase().startsWith('http');

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 z-[100] bg-day-bg dark:bg-night-bg flex items-center justify-center p-6">
        <div className="w-full max-w-sm p-8 bg-day-card dark:bg-night-card border border-black/5 dark:border-white/5 rounded-[2.5rem] shadow-2xl">
          <div className="text-center mb-8">
             <ShieldCheck className="w-12 h-12 text-day-text dark:text-night-text mx-auto mb-3" />
             <h2 className="text-xl font-black">管理后台登录</h2>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              type="password" 
              className="w-full px-5 py-4 rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 outline-none focus:ring-1 focus:ring-day-text dark:focus:ring-night-text" 
              placeholder="管理员密码" 
              value={passwordInput} 
              onChange={(e) => setPasswordInput(e.target.value)} 
            />
            <button type="submit" className="w-full py-4 rounded-2xl bg-day-text dark:bg-night-text text-day-bg dark:text-night-bg font-black active:scale-95 transition-transform">确认登录</button>
            <button type="button" onClick={onClose} className="w-full py-2 text-xs text-gray-400 font-bold">返回首页</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-day-bg dark:bg-night-bg overflow-y-auto pb-10 sm:pb-20">
      <div className="max-w-6xl mx-auto p-4 sm:p-8 space-y-6 sm:space-y-10 animate-fade-in">
        <div className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-4 sm:pb-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-10 h-10 rounded-xl bg-day-text dark:bg-night-text text-day-bg dark:text-night-bg flex items-center justify-center">
              <Settings2 className="w-5 h-5" />
            </div>
            <h2 className="text-lg sm:text-2xl font-black">后台管理</h2>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={handleSaveAndSync} 
              disabled={isProcessing} 
              className={`flex items-center gap-2 px-6 sm:px-10 py-3 sm:py-4 rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm transition-all shadow-lg ${
                isProcessing 
                ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                : 'bg-day-text dark:bg-night-text text-day-bg dark:text-night-bg hover:opacity-90 active:scale-95'
              }`}
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isProcessing ? '同步中...' : '保存并同步'}
            </button>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-day-text transition-colors">
              <X className="w-7 h-7" />
            </button>
          </div>
        </div>

        <div className="grid gap-6 sm:gap-8 lg:grid-cols-12">
          <div className="lg:col-span-12 grid gap-6 md:grid-cols-2">
            <section className="bg-day-card dark:bg-night-card p-5 sm:p-8 rounded-[2rem] border border-black/5 dark:border-white/5 shadow-sm space-y-4">
              <h3 className="font-black text-base sm:text-lg flex items-center gap-2">
                <Github className="w-4 h-4 text-gray-400" /> GitHub 存储
              </h3>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">仓库路径</label>
                  <input className="w-full px-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 outline-none font-mono text-xs" value={repoPath} onChange={e => handleRepoPathChange(e.target.value)} placeholder="User/Repo" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">GitHub Token</label>
                  <input type="password" className="w-full px-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 outline-none font-mono text-xs" value={localConfig.githubToken} onChange={e => setLocalConfig({...localConfig, githubToken: e.target.value})} placeholder="输入 Token 以启用云同步" />
                </div>
              </div>
            </section>

            <section className="bg-day-card dark:bg-night-card p-5 sm:p-8 rounded-[2rem] border border-black/5 dark:border-white/5 shadow-sm space-y-4">
              <h3 className="font-black text-base sm:text-lg flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-gray-400" /> 同步日志
              </h3>
              <div className="bg-black/5 dark:bg-black/40 p-4 rounded-xl font-mono text-[10px] text-zinc-500 overflow-y-auto h-[120px] sm:h-[150px] border border-black/5 shadow-inner">
                {logs.length > 0 ? logs.map((log, i) => <div key={i} className="mb-1 leading-relaxed">{log}</div>) : <span className="opacity-30 italic">等待操作执行...</span>}
              </div>
            </section>
          </div>

          <section className="lg:col-span-7 bg-day-card dark:bg-night-card p-5 sm:p-8 rounded-[2rem] border border-black/5 dark:border-white/5 shadow-sm space-y-5">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-base sm:text-lg flex items-center gap-2"><Link2 className="w-4 h-4 text-gray-400" /> 订阅源列表</h3>
              <div className="flex gap-2">
                <button onClick={() => setShowBatchAdd(!showBatchAdd)} className="px-3 py-1.5 bg-black/5 dark:bg-white/5 rounded-lg border border-black/5 text-[10px] font-black">批量导入</button>
                <button onClick={addSource} className="p-2 bg-day-text dark:bg-night-text text-day-bg dark:text-night-bg rounded-lg hover:opacity-90 transition-all"><Plus className="w-4 h-4" /></button>
              </div>
            </div>
            
            {showBatchAdd && (
              <div className="space-y-3 animate-fade-in bg-black/5 dark:bg-white/5 p-4 rounded-2xl border border-black/5">
                <textarea className="w-full h-32 p-3 text-xs font-mono rounded-xl bg-white dark:bg-black/60 border border-black/5 dark:border-white/10 outline-none" placeholder="输入多个 URL，每行一个..." value={batchInputValue} onChange={e => setBatchInputValue(e.target.value)} />
                <div className="flex gap-2">
                  <button onClick={() => {
                    const urls = batchInputValue.split('\n').map(u => u.trim()).filter(u => u && u.startsWith('http'));
                    if (urls.length > 0) {
                      setLocalSources([...localSources, ...urls]);
                      setBatchInputValue('');
                      setShowBatchAdd(false);
                    }
                  }} className="flex-1 py-3 bg-day-text dark:bg-night-text text-day-bg dark:text-night-bg rounded-xl text-xs font-black">确认导入</button>
                  <button onClick={() => setShowBatchAdd(false)} className="px-4 py-3 bg-black/5 dark:bg-white/5 rounded-xl text-xs font-bold">取消</button>
                </div>
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-1">
              {localSources.map((url, i) => (
                <div key={i} className="flex gap-3 items-center bg-black/5 dark:bg-white/5 p-3 rounded-xl border border-black/5 transition-all group">
                  <span className="w-5 h-5 rounded-full bg-white dark:bg-black text-[9px] font-black flex items-center justify-center text-gray-400 shrink-0">{i+1}</span>
                  <input className="flex-1 text-xs bg-transparent border-none outline-none font-mono truncate" value={url} onChange={e => updateSource(i, e.target.value)} placeholder="订阅 URL (以 http 开头)" />
                  <button onClick={() => removeSource(i)} className="p-2 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              {localSources.length === 0 && (
                <div className="py-12 text-center opacity-20 italic text-xs border-2 border-dashed border-black/5 rounded-2xl">点击上方按钮添加订阅源</div>
              )}
            </div>
          </section>

          <section className="lg:col-span-5 bg-day-card dark:bg-night-card p-5 sm:p-8 rounded-[2rem] border border-black/5 dark:border-white/5 shadow-sm space-y-5">
             <div className="flex justify-between items-center">
                <h3 className="font-black text-base sm:text-lg flex items-center gap-2"><LinkIcon className="w-4 h-4 text-gray-400" /> 快捷按钮</h3>
                <button onClick={handleAddLink} className="p-2 bg-day-text dark:bg-night-text text-day-bg dark:text-night-bg rounded-lg hover:opacity-90"><Plus className="w-4 h-4" /></button>
             </div>
             
             <div className="grid gap-3">
               {localLinks.map((link) => (
                 <div key={link.id} className="p-3 bg-black/5 dark:bg-white/5 rounded-2xl border border-black/5 flex items-center gap-3 transition-all hover:border-day-text/20">
                    <div className="w-10 h-10 p-1.5 rounded-xl flex items-center justify-center shrink-0 border border-white/20 shadow-sm overflow-hidden" style={{ backgroundColor: link.color }}>
                      {link.icon && isUrl(link.icon) ? (
                        <img src={link.icon} alt={link.name} className="w-full h-full object-contain" />
                      ) : (
                        <span className="text-white drop-shadow-sm text-lg">{link.icon || '🔗'}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black truncate">{link.name}</p>
                      <p className="text-[9px] text-gray-400 truncate opacity-60">{link.url}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setEditingLink({...link})} className="p-2 text-gray-400 hover:text-day-text rounded-lg"><Edit3 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => removeLink(link.id)} className="p-2 text-gray-400 hover:text-red-500 rounded-lg"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                 </div>
               ))}
               {localLinks.length === 0 && (
                 <div className="py-10 text-center opacity-20 italic text-xs border-2 border-dashed border-black/5 rounded-2xl">暂无快捷按钮</div>
               )}
             </div>
          </section>
        </div>
      </div>

      {editingLink && (
        <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-day-bg dark:bg-night-card rounded-[2.5rem] shadow-2xl p-6 sm:p-8 space-y-5 border border-white/10">
            <div className="flex justify-between items-center">
              <h4 className="text-lg font-black">配置按钮</h4>
              <button onClick={() => setEditingLink(null)} className="p-2 text-gray-400 hover:bg-black/5 rounded-full"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-4 bg-black/5 dark:bg-white/5 p-3 rounded-2xl border border-black/5">
                <div className="w-14 h-14 p-2 rounded-xl flex items-center justify-center shrink-0 shadow-lg border-2 border-white/20 overflow-hidden" style={{ backgroundColor: editingLink.color }}>
                  {editingLink.icon && isUrl(editingLink.icon) ? (
                    <img src={editingLink.icon} alt="preview" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-white drop-shadow-sm text-2xl">{editingLink.icon || '🔗'}</span>
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">背景色</label>
                  <div className="flex items-center gap-3">
                    <input type="color" className="w-10 h-8 rounded cursor-pointer border-none bg-transparent p-0" value={editingLink.color} onChange={e => setEditingLink({...editingLink, color: e.target.value})} />
                    <span className="text-[10px] font-mono opacity-40 uppercase">{editingLink.color}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-500 uppercase pl-1">名称</label>
                <input className="w-full px-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 outline-none text-sm" value={editingLink.name} onChange={e => setEditingLink({...editingLink, name: e.target.value})} placeholder="例如: 机场官网" />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-500 uppercase pl-1">图标 (Emoji / URL)</label>
                <input className="w-full px-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 outline-none font-mono text-xs" value={editingLink.icon} onChange={e => setEditingLink({...editingLink, icon: e.target.value})} placeholder="输入 emoji 或图标链接" />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-500 uppercase pl-1">跳转链接</label>
                <input className="w-full px-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 outline-none font-mono text-xs" value={editingLink.url} onChange={e => setEditingLink({...editingLink, url: e.target.value})} placeholder="https://..." />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={saveEditingLink} className="flex-1 py-4 bg-day-text dark:bg-night-text text-day-bg dark:text-night-bg rounded-2xl font-black flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-xl"><Save className="w-4 h-4" /> 完成配置</button>
              <button onClick={() => setEditingLink(null)} className="px-6 py-4 bg-black/5 dark:bg-white/5 rounded-2xl font-bold">关闭</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
