
export interface AppConfig {
  githubToken: string;
  repoOwner: string;
  repoName: string;
  customDomain: string; 
  autoPushEnabled?: boolean;
  lastPushTime?: number;
}

export interface CustomLink {
  id: string;
  name: string;
  url: string;
  icon?: string; // 图标 URL 或表情符号
  color: string;
}

export interface RepoFile {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string;
  type: 'file' | 'dir';
}

export interface RemoteBulletin {
  id: string;
  title: string;
  content: string;
  show: boolean;
}

export interface RemoteAd {
  clashads: {
    image: string;
    link: string;
    show: boolean;
  }
}

export interface RemoteUpdate {
  versionCode: number;
  versionName: string;
  content: string;
  url: string;
  force: boolean;
  show: boolean;
}

// 默认的公开读取权限仓库
export const DEFAULT_OWNER = "fastkj";
export const DEFAULT_REPO = "neatfreeoo";

// 用户要求的默认显示域名
export const DEFAULT_DOMAIN = "https://clash1.fastkj.eu.org";

export const DEFAULT_SOURCES: string[] = [];
