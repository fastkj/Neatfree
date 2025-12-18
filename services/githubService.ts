
import { AppConfig, CustomLink, RepoFile } from '../types';

const GITHUB_API_BASE = 'https://api.github.com';

/**
 * 字符转换工具
 */
function toBase64(str: string): string {
  return window.btoa(unescape(encodeURIComponent(str)));
}

function fromBase64(str: string): string {
  return decodeURIComponent(escape(window.atob(str)));
}

/**
 * 通用内容获取（带代理重试）
 */
export const fetchRawContent = async (url: string): Promise<string> => {
  let targetUrl = url;
  if (url.includes('github.com') && url.includes('/blob/')) {
    targetUrl = url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
  }

  // 1. 直接尝试 (增加时间戳防止缓存)
  try {
    const response = await fetch(`${targetUrl}${targetUrl.includes('?') ? '&' : '?'}t=${Date.now()}`);
    if (response.ok) return await response.text();
  } catch (e) {}

  // 2. 代理尝试
  const proxies = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
    `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`
  ];

  for (const proxy of proxies) {
    try {
      const response = await fetch(proxy);
      if (response.ok) return await response.text();
    } catch (e) {}
  }

  throw new Error(`无法从以下源获取内容: ${url}`);
};

/**
 * 获取公共 Header
 */
const getHeaders = (token?: string): HeadersInit => {
  const headers: HeadersInit = { 
    'Accept': 'application/vnd.github.v3+json'
  };
  // 使用 Bearer 格式，兼容性更好且符合现代标准
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
};

/**
 * 获取目录列表
 */
export const fetchRepoDir = async (config: AppConfig, path: string): Promise<RepoFile[] | null> => {
  if (!config.repoOwner || !config.repoName) return [];
  
  const apiUrl = `${GITHUB_API_BASE}/repos/${config.repoOwner}/${config.repoName}/contents/${path}`;
  try {
    const response = await fetch(`${apiUrl}?t=${Date.now()}`, { 
      headers: getHeaders(config.githubToken)
    });
    if (response.ok) {
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    }
    if (response.status === 404) return [];
  } catch (e) {
    console.error("fetchRepoDir Error:", e);
  }
  return null;
};

/**
 * 获取单个文件及其最新 SHA
 */
export const getRepoFile = async (config: AppConfig, path: string) => {
  if (!config.repoOwner || !config.repoName) return null;
  const url = `${GITHUB_API_BASE}/repos/${config.repoOwner}/${config.repoName}/contents/${path}`;
  
  try {
    const response = await fetch(`${url}?t=${Date.now()}`, { 
      headers: getHeaders(config.githubToken)
    });
    
    if (response.ok) {
      const data = await response.json();
      return { sha: data.sha, content: fromBase64(data.content) };
    }
    
    if (response.status === 404) {
      return { sha: undefined, content: null, isNew: true };
    }

    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.message || `HTTP ${response.status}`);
  } catch (e: any) {
    console.error(`getRepoFile Error (${path}):`, e);
    // 如果是网络层错误 (Failed to fetch)，抛出详细说明
    if (e.message === 'Failed to fetch') {
      throw new Error(`网络请求被拦截 (Failed to fetch)。请检查 GitHub Token 是否正确，或尝试开启/关闭 VPN。`);
    }
    throw e;
  }
};

/**
 * 上传/同步文件
 */
export const uploadToRepo = async (config: AppConfig, path: string, content: string, message: string, sha?: string) => {
  const url = `${GITHUB_API_BASE}/repos/${config.repoOwner}/${config.repoName}/contents/${path}`;
  const body: any = { message, content: toBase64(content) };
  if (sha) body.sha = sha;

  try {
    const response = await fetch(url, {
      method: 'PUT',
      headers: getHeaders(config.githubToken),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      if (response.status === 409) {
        throw new Error(`版本冲突 (SHA 失效)，请刷新页面后重试。详情: ${errData.message}`);
      }
      throw new Error(errData.message || `上传失败 (HTTP ${response.status})`);
    }
    return await response.json();
  } catch (e: any) {
    if (e.message === 'Failed to fetch') {
      throw new Error(`提交失败 (Failed to fetch)。这通常是 CORS 预检失败或网络被拦截，请确认 Token 权限及网络环境。`);
    }
    throw e;
  }
};

/**
 * 删除文件 (物理删除)
 */
export const deleteRepoFile = async (config: AppConfig, path: string, sha: string) => {
  const url = `${GITHUB_API_BASE}/repos/${config.repoOwner}/${config.repoName}/contents/${path}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: getHeaders(config.githubToken),
    body: JSON.stringify({
      message: `Delete redundant file: ${path}`,
      sha: sha
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.message || "删除失败");
  }
  return await response.json();
};

export const saveCustomLinks = async (config: AppConfig, links: CustomLink[]) => {
  const path = 'clash/link.json';
  const fileData = await getRepoFile(config, path);
  await uploadToRepo(config, path, JSON.stringify(links, null, 2), `Update links ${Date.now()}`, fileData?.sha);
};

export const fetchCustomLinks = async (config: AppConfig): Promise<CustomLink[]> => {
  if (!config.repoOwner || !config.repoName) return [];
  const path = 'clash/link.json';
  const publicUrl = `https://raw.githubusercontent.com/${config.repoOwner}/${config.repoName}/main/${path}?t=${Date.now()}`;
  
  try {
    const res = await fetch(publicUrl);
    if (res.ok) return await res.json();
  } catch (e) {}
  
  const fileData = await getRepoFile(config, path);
  return (fileData && fileData.content) ? JSON.parse(fileData.content) : [];
};

export const saveSources = async (config: AppConfig, sources: string[]) => {
  const path = 'clash/sources.json';
  const fileData = await getRepoFile(config, path);
  await uploadToRepo(config, path, JSON.stringify(sources, null, 2), `Update sources.json ${Date.now()}`, fileData?.sha);
};

export const fetchSources = async (config: AppConfig): Promise<string[]> => {
  if (!config.repoOwner || !config.repoName) return [];
  const path = 'clash/sources.json';
  const publicUrl = `https://raw.githubusercontent.com/${config.repoOwner}/${config.repoName}/main/${path}?t=${Date.now()}`;
  
  try {
    const res = await fetch(publicUrl);
    if (res.ok) return await res.json();
  } catch (e) {}
  
  const fileData = await getRepoFile(config, path);
  return (fileData && fileData.content) ? JSON.parse(fileData.content) : [];
};
