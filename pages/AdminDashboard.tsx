
import React, { useState, useEffect } from 'react';
import { RefreshCw, Plus, Trash2, Github, Link as LinkIcon, X, Settings2, ShieldCheck, Link2, Edit3, Save, Loader2, Clock, DownloadCloud } from 'lucide-react';
import { AppConfig, CustomLink, RepoFile, DEFAULT_SOURCES } from '../types';
import { fetchRawContent, getRepoFile, uploadToRepo, saveCustomLinks, saveSources, fetchRepoDir, deleteRepoFile, fetchCustomLinks, fetchSources } from '../services/githubService';

interface AdminDashboardProps {
  config: AppConfig;
  onConfigChange: (newConfig: AppConfig) => void;
  sources: string[];
  onSourcesChange: (newSources: string[]) => void;
  customLinks: CustomLink[];
  onCustomLinksChange: (newLinks: CustomLink[]) => void;
  onClose: () => void;
}

const STORAGE_CONFIG = 'clashhub_config_v3';

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
  const [isPulling, setIsPulling] = useState(false);
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
    if (passwordInput === 'qazwsx') {
      setIsAuthenticated(true);
    } else {
      alert("密码错误");
    }
  };

  const handleRepoPathChange = (val: string) => {
    setRepoPath(val);
    if (val.includes('/')) {
      const [owner, repo] = val.split('/').map(s => s.trim());
      const updated = { ...localConfig, repoOwner: owner || '', repoName: repo || '' };
      setLocalConfig(updated);
      localStorage.setItem(STORAGE_CONFIG, JSON.stringify(updated));
      onConfigChange(updated);
    }
  };

  const handleTokenChange = (val: string) => {
    const updated = { ...localConfig, githubToken: val };
    setLocalConfig(updated);
    localStorage.setItem(STORAGE_CONFIG, JSON.stringify(updated));
    onConfigChange(updated);
  };

  const handlePullFromCloud = async () => {
    if (!localConfig.githubToken || !localConfig.repoName || !localConfig.repoOwner) {
      alert("请先填写 GitHub Token 和仓库路径");
      return;
    }

    setIsPulling(true);
    setLogs([]);
    addLog("☁️ 开始从云端拉取配置...");

    try {
      // 1. 拉取快捷按钮
      addLog("🔍 正在拉取快捷按钮配置...");
      const remoteLinks = await fetchCustomLinks(localConfig);
      if (remoteLinks && Array.isArray(remoteLinks)) {
        setLocalLinks(remoteLinks);
        onCustomLinksChange(remoteLinks);
        addLog(`✅ 已获取 ${remoteLinks.length} 个快捷按钮`);
      }

      // 2. 拉取订阅源
      addLog("🔍 正在拉取订阅源配置...");
      const remoteSources = await fetchSources(localConfig);
      if (remoteSources && Array.isArray(remoteSources)) {
        setLocalSources(remoteSources);
        onSourcesChange(remoteSources);
        addLog(`✅ 已获取 ${remoteSources.length} 个订阅源`);
      }

      addLog("✨ 云端数据同步至本地成功！");
      alert("拉取成功！已同步云端配置到当前设备。");
    } catch (err: any) {
      addLog(`❌ 拉取失败: ${err.message}`);
      alert(`拉取失败: ${err.message}`);
    } finally {
      setIsPulling(false);
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
    addLog("🚀 开始保存并同步...");
    
    try {
        const now = Date.now();
        const configToSave = { ...localConfig, lastPushTime: now };
        
        onConfigChange(configToSave);
        onSourcesChange(localSources);
        onCustomLinksChange(localLinks);

        await saveCustomLinks(configToSave, localLinks);
        addLog("✅ 按钮配置同步完成");
        await saveSources(configToSave, localSources);
        addLog("✅ 订阅源同步完成");

        const existingFiles = await fetchRepoDir(configToSave, 'clash') || [];
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
                await uploadToRepo(configToSave, targetFilename, rawContent, `Update ${fileName}`, existingFile?.sha);
                addLog(`✅ 更新: ${fileName}`);
            } catch (err: any) {
                addLog(`⚠️ 失败 (${fileName}): ${err.message}`);
            }
        }

        const orphans = neatConfigFiles.filter(f => !activeFileNames.has(f.name));
        for (const orphan of orphans) {
          try {
            await deleteRepoFile(configToSave, `clash/${orphan.name}`, orphan.sha);
            addLog(`🗑️ 清理: ${orphan.name}`);
          } catch (e: any) {
            addLog(`⚠️ 清理失败: ${e.message}`);
          }
        }

        addLog("✨ 全部同步任务完成！");
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
      <div className="fixed inset-0 z-[100] bg-day-bg dark:bg-night-bg flex items-center justify-center p-4 pt-[env(safe-area-inset-top)]">
        <div className="w-full max-w-[360px] p-6 sm:p-8 bg-day-card dark:bg-night-card border border-black/5 dark:border-white/5 rounded-[2.5rem] sm:rounded-[2.5rem] shadow-2xl">
          <div className="text-center mb-6 sm:mb-8">
             <ShieldCheck className="w-10 h-10 sm:w-12 sm:h-12 text-day-text dark:text-night-text mx-auto mb-3" />
             <h2 className="text-lg sm:text-xl font-black">管理后台登录</h2>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              type="password" 
              className="w-full px-5 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 outline-none focus:ring-1 focus:ring-day-text dark:focus:ring-night-text text-sm" 
              placeholder="管理员密码" 
              value={passwordInput} 
              onChange={(e) => setPasswordInput(e.target.value)} 
            />
            <button type="submit" className="w-full py-3.5 sm:py-4 rounded-xl sm:rounded-2xl bg-day-text dark:bg-night-text text-day-bg dark:text-night-bg font-black active:scale-95 transition-transform text-sm sm:text-base">确认登录</button>
            <button type="button" onClick={onClose} className="w-full py-2 text-[10px] sm:text-xs text-gray-400 font-bold">返回首页</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-day-bg dark:bg-night-bg overflow-y-auto pb-10 overflow-x-hidden">
      <div className="max-w-6xl mx-auto px-3 sm:px-8 py-4 sm:py-8 space-y-4 sm:space-y-8 animate-fade-in w-full overflow-hidden">
        <div className="flex flex-col border-b border-black/5 dark:border-white/5 sticky top-0 bg-day-bg/80 dark:bg-night-bg/80 backdrop-blur-lg z-20 pt-[env(safe-area-inset-top)]">
          <div className="flex items-center justify-between pb-4 sm:pb-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-day-text dark:bg-night-text text-day-bg dark:text-night-bg flex items-center justify-center">
                <Settings2 className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <h2 className="text-base sm:text-xl font-black truncate">后台管理</h2>
            </div>
            
            <div className="flex items-center gap-2">
              {/* 拉取按钮 */}
              <button 
                onClick={handlePullFromCloud} 
                disabled={isPulling || isProcessing} 
                className={`flex items-center gap-1.5 px-3 sm:px-5 py-2 sm:py-3.5 rounded-lg sm:rounded-xl font-black text-[10px] sm:text-sm transition-all border ${
                  isPulling 
                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border-transparent cursor-not-allowed' 
                  : 'bg-white dark:bg-zinc-900 text-day-text dark:text-night-text border-black/10 dark:border-white/10 hover:bg-black/5 active:scale-95'
                }`}
              >
                {isPulling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <DownloadCloud className="w-3.5 h-3.5" />}
                <span>{isPulling ? '拉取中' : '拉取配置'}</span>
              </button>

              <button 
                onClick={handleSaveAndSync} 
                disabled={isProcessing || isPulling} 
                className={`flex items-center gap-1.5 px-3 sm:px-6 py-2 sm:py-3.5 rounded-lg sm:rounded-xl font-black text-[10px] sm:text-sm transition-all shadow-md ${
                  isProcessing 
                  ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                  : 'bg-day-text dark:bg-night-text text-day-bg dark:text-night-bg hover:opacity-90 active:scale-95'
                }`}
              >
                {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>{isProcessing ? '同步中' : '同步云端'}</span>
              </button>
              <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-day-text transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:gap-6 lg:grid-cols-12 w-full overflow-hidden">
          {/* 配置 & 日志 */}
          <div className="lg:col-span-12 grid gap-4 sm:gap-6 md:grid-cols-2">
            <section className="bg-day-card dark:bg-night-card p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] border border-black/5 dark:border-white/5 shadow-sm space-y-4 overflow-hidden">
              <h3 className="font-black text-sm sm:text-base flex items-center gap-2 uppercase tracking-tight">
                <Github className="w-4 h-4 text-gray-400" /> GitHub 配置
              </h3>
              <div className="space-y-3 sm:space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase px-1">仓库路径 (User/Repo)</label>
                  <input className="w-full px-3 py-2.5 rounded-lg bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 outline-none font-mono text-xs focus:ring-1 focus:ring-day-text/20" value={repoPath} onChange={e => handleRepoPathChange(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase px-1">GitHub Access Token</label>
                  <input type="password" className="w-full px-3 py-2.5 rounded-lg bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 outline-none font-mono text-xs focus:ring-1 focus:ring-day-text/20" value={localConfig.githubToken} onChange={e => handleTokenChange(e.target.value)} placeholder="输入后自动保存至浏览器" />
                </div>
                
                <div className="flex items-center justify-between p-3 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-[11px] font-black">24小时自动推送</span>
                  </div>
                  <button 
                    onClick={() => {
                      const updated = {...localConfig, autoPushEnabled: !localConfig.autoPushEnabled};
                      setLocalConfig(updated);
                      localStorage.setItem(STORAGE_CONFIG, JSON.stringify(updated));
                      onConfigChange(updated);
                    }}
                    className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none ${localConfig.autoPushEnabled ? 'bg-day-text dark:bg-night-text' : 'bg-gray-200 dark:bg-zinc-700'}`}
                  >
                    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white dark:bg-night-bg transition-transform ${localConfig.autoPushEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
            </section>

            <section className="bg-day-card dark:bg-night-card p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] border border-black/5 dark:border-white/5 shadow-sm space-y-4 overflow-hidden">
              <h3 className="font-black text-sm sm:text-base flex items-center gap-2 uppercase tracking-tight">
                <RefreshCw className="w-4 h-4 text-gray-400" /> 操作日志
              </h3>
              <div className="bg-black/5 dark:bg-black/40 p-3 sm:p-4 rounded-xl font-mono text-[9px] sm:text-[10px] text-zinc-500 overflow-y-auto h-[140px] border border-black/5 shadow-inner leading-relaxed">
                {logs.length > 0 ? logs.map((log, i) => <div key={i} className="mb-1 border-b border-black/[0.02] dark:border-white/[0.02] pb-1">{log}</div>) : <span className="opacity-30 italic">等待操作执行...</span>}
              </div>
            </section>
          </div>

          {/* 订阅源列表 */}
          <section className="lg:col-span-7 bg-day-card dark:bg-night-card p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] border border-black/5 dark:border-white/5 shadow-sm space-y-4 overflow-hidden">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-sm sm:text-base flex items-center gap-2 uppercase tracking-tight"><Link2 className="w-4 h-4 text-gray-400" /> 订阅源列表</h3>
              <div className="flex gap-2">
                <button onClick={() => setShowBatchAdd(!showBatchAdd)} className="px-2.5 py-1.5 bg-black/5 dark:bg-white/5 rounded-lg border border-black/5 text-[10px] font-black hover:bg-black/10 transition-colors">批量</button>
                <button onClick={addSource} className="p-1.5 bg-day-text dark:bg-night-text text-day-bg dark:text-night-bg rounded-lg hover:opacity-90 transition-all"><Plus className="w-4 h-4" /></button>
              </div>
            </div>
            
            {showBatchAdd && (
              <div className="space-y-3 animate-fade-in bg-black/5 dark:bg-white/5 p-3 rounded-xl border border-black/5">
                <textarea className="w-full h-32 p-3 text-xs font-mono rounded-lg bg-white dark:bg-black/60 border border-black/5 dark:border-white/10 outline-none" placeholder="输入多个 URL，每行一个..." value={batchInputValue} onChange={e => setBatchInputValue(e.target.value)} />
                <div className="flex gap-2">
                  <button onClick={() => {
                    const urls = batchInputValue.split('\n').map(u => u.trim()).filter(u => u && u.startsWith('http'));
                    if (urls.length > 0) {
                      setLocalSources([...localSources, ...urls]);
                      setBatchInputValue('');
                      setShowBatchAdd(false);
                    }
                  }} className="flex-1 py-2 bg-day-text dark:bg-night-text text-day-bg dark:text-night-bg rounded-lg text-xs font-black">导入</button>
                  <button onClick={() => setShowBatchAdd(false)} className="px-3 py-2 bg-black/5 dark:bg-white/5 rounded-lg text-xs font-bold">取消</button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {localSources.map((url, i) => (
                <div key={i} className="flex gap-2 items-center bg-black/5 dark:bg-white/5 p-2 rounded-xl border border-black/5 transition-all group overflow-hidden">
                  <span className="w-6 h-6 rounded-lg bg-white dark:bg-black text-[9px] font-black flex items-center justify-center text-gray-400 shrink-0 border border-black/5">{i+1}</span>
                  <input className="flex-1 min-w-0 text-[11px] bg-transparent border-none outline-none font-mono truncate focus:ring-0" value={url} onChange={e => updateSource(i, e.target.value)} placeholder="https://..." />
                  <button onClick={() => removeSource(i)} className="p-1.5 text-gray-300 hover:text-red-500 transition-colors sm:opacity-0 group-hover:opacity-100 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              {localSources.length === 0 && (
                <div className="py-12 text-center opacity-20 italic text-xs border-2 border-dashed border-black/5 rounded-2xl">暂无订阅，点击右上角添加</div>
              )}
            </div>
          </section>

          {/* 快捷按钮 */}
          <section className="lg:col-span-5 bg-day-card dark:bg-night-card p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] border border-black/5 dark:border-white/5 shadow-sm space-y-4 overflow-hidden">
             <div className="flex justify-between items-center">
                <h3 className="font-black text-sm sm:text-base flex items-center gap-2 uppercase tracking-tight"><LinkIcon className="w-4 h-4 text-gray-400" /> 快捷按钮</h3>
                <button onClick={handleAddLink} className="p-1.5 bg-day-text dark:bg-night-text text-day-bg dark:text-night-bg rounded-lg hover:opacity-90"><Plus className="w-4 h-4" /></button>
             </div>
             
             <div className="grid gap-2">
               {localLinks.map((link) => (
                 <div key={link.id} className="p-2 sm:p-2.5 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5 flex items-center gap-2 sm:gap-3 group transition-all hover:border-day-text/20 overflow-hidden">
                    <div className="w-9 h-9 sm:w-10 sm:h-10 p-1.5 rounded-lg flex items-center justify-center shrink-0 border border-white/10 shadow-sm" style={{ backgroundColor: link.color }}>
                      {link.icon && isUrl(link.icon) ? (
                        <img src={link.icon} alt={link.name} className="w-full h-full object-contain" />
                      ) : (
                        <span className="text-white drop-shadow-sm text-sm sm:text-base">{link.icon || '🔗'}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] sm:text-[11px] font-black truncate">{link.name}</p>
                      <p className="text-[8px] sm:text-[9px] text-gray-400 truncate opacity-60 leading-tight">{link.url}</p>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setEditingLink({...link})} className="p-1.5 text-gray-400 hover:text-day-text"><Edit3 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => removeLink(link.id)} className="p-1.5 text-gray-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                 </div>
               ))}
               {localLinks.length === 0 && (
                 <div className="py-8 text-center opacity-20 italic text-[11px] border-2 border-dashed border-black/5 rounded-2xl">暂无按钮</div>
               )}
             </div>
          </section>
        </div>
      </div>

      {/* 按钮编辑模态框 */}
      {editingLink && (
        <div className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
          <div className="w-full max-w-[340px] my-auto bg-day-bg dark:bg-night-card rounded-[2rem] shadow-2xl p-6 space-y-5 border border-white/10 overflow-hidden">
            <div className="flex justify-between items-center">
              <h4 className="text-base font-black">配置快捷按钮</h4>
              <button onClick={() => setEditingLink(null)} className="p-1.5 text-gray-400 hover:bg-black/5 rounded-full"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-3.5">
              <div className="flex items-center gap-4 bg-black/5 dark:bg-white/5 p-3 rounded-xl border border-black/5">
                <div className="w-12 h-12 p-2 rounded-lg flex items-center justify-center shrink-0 shadow-lg border border-white/10" style={{ backgroundColor: editingLink.color }}>
                  {editingLink.icon && isUrl(editingLink.icon) ? (
                    <img src={editingLink.icon} alt="preview" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-white drop-shadow-sm text-xl">{editingLink.icon || '🔗'}</span>
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">配色方案</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="color" 
                      className="w-8 h-8 rounded cursor-pointer border-none bg-transparent p-0" 
                      value={editingLink.color} 
                      onChange={e => setEditingLink({...editingLink, color: e.target.value})} 
                    />
                    <input 
                      type="text"
                      className="flex-1 min-w-0 px-2.5 py-1.5 text-[11px] font-mono bg-white dark:bg-black/30 border border-black/10 rounded-lg outline-none focus:ring-1 focus:ring-day-text/30 uppercase"
                      value={editingLink.color}
                      onChange={e => setEditingLink({...editingLink, color: e.target.value})}
                      placeholder="#FFFFFF"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-zinc-400 uppercase pl-1">显示名称</label>
                <input className="w-full px-3 py-2.5 rounded-lg bg-black/5 dark:bg-white/5 border border-black/5 outline-none text-xs focus:ring-1 focus:ring-day-text/20" value={editingLink.name} onChange={e => setEditingLink({...editingLink, name: e.target.value})} placeholder="例如: 机场官网" />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-zinc-400 uppercase pl-1">图标 (Emoji / URL)</label>
                <input className="w-full px-3 py-2.5 rounded-lg bg-black/5 dark:bg-white/5 border border-black/5 outline-none font-mono text-xs focus:ring-1 focus:ring-day-text/20" value={editingLink.icon} onChange={e => setEditingLink({...editingLink, icon: e.target.value})} placeholder="输入 emoji 或图标链接" />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-zinc-400 uppercase pl-1">跳转链接</label>
                <input className="w-full px-3 py-2.5 rounded-lg bg-black/5 dark:bg-white/5 border border-black/5 outline-none font-mono text-xs focus:ring-1 focus:ring-day-text/20" value={editingLink.url} onChange={e => setEditingLink({...editingLink, url: e.target.value})} placeholder="https://..." />
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button onClick={saveEditingLink} className="flex-1 py-3 bg-day-text dark:bg-night-text text-day-bg dark:text-night-bg rounded-xl font-black flex items-center justify-center gap-1.5 hover:opacity-90 active:scale-95 transition-all text-xs"><Save className="w-3.5 h-3.5" /> 保存配置</button>
              <button onClick={() => setEditingLink(null)} className="px-4 py-3 bg-black/5 dark:bg-white/5 rounded-xl font-bold text-xs">取消</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
