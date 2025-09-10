// 标签组数据类型
export interface TabGroup {
  id: string;
  type: 'group';
  createTime: number;
  title: string;
  color: chrome.tabGroups.ColorEnum;
  tabs: TabData[];
}

// 标签页数据类型
export interface TabData {
  title: string;
  url: string;
  favIconUrl?: string;
}

// 规则数据类型
export interface Rule {
  id: string;
  name: string;
  pattern: string;
  color: chrome.tabGroups.ColorEnum;
  active?: boolean;
  createTime: number;
  updateTime: number;
}