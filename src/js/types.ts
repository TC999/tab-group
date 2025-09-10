// 颜色映射类型
export const ColorMap: Record<chrome.tabGroups.ColorEnum, string> = {
  grey: '#54585D',
  blue: '#1B68DE',
  red: '#D22C28',
  yellow: '#FCD065',
  green: '#21823D',
  pink: '#FD80C2',
  purple: '#872FDB',
  cyan: '#6FD3E7',
  orange: '#F88542'
};

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
  ruleName?: string;
  name?: string;
  pattern?: string;
  urlMatches?: string;
  titleMatches?: string;
  groupName: string;
  groupColor: chrome.tabGroups.ColorEnum;
  enabled?: boolean;
  createTime?: number;
  updateTime?: number;
}

// 规则选项类型
export interface RuleOptions {
  'r-scope': string;
  'r-oneGroupInAll': boolean;
  'r-groupByDomain': boolean;
  'r-groupByDomainWithSubdomain': boolean;
}

// 规则前缀
export const RulePrefix = 'rule-';