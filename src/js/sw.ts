// 浏览器扩展后台服务

// 常量定义
const MaxSnapshots = 5; // 每组最大保存快照数

// 初始化Promise
const InitPromise = new Promise<void>((resolve) => {
  chrome.runtime.onInstalled.addListener(() => {
    // 初始化存储
    chrome.storage.local.get(['maxSnapshots'], (result) => {
      if (result.maxSnapshots === undefined) {
        chrome.storage.local.set({ maxSnapshots: MaxSnapshots });
      }
      resolve();
    });
  });
  
  // 如果已经安装，直接解析
  if (chrome.runtime.lastError === undefined) {
    resolve();
  }
});

// 标签分组管理类
class TabGroupManager {
  // 创建新标签组
  static async createGroup(tabs: number[], title?: string, color?: chrome.tabGroups.ColorEnum): Promise<chrome.tabGroups.TabGroup | null> {
    return new Promise((resolve) => {
      if (tabs.length === 0) {
        resolve(null);
        return;
      }
      
      chrome.tabs.group({ tabIds: tabs }, (groupId) => {
        if (chrome.runtime.lastError) {
          console.error('Failed to create group:', chrome.runtime.lastError);
          resolve(null);
          return;
        }
        
        const updateProperties: chrome.tabGroups.UpdateProperties = {};
        if (title) updateProperties.title = title;
        if (color) updateProperties.color = color;
        
        chrome.tabGroups.update(groupId, updateProperties, (group) => {
          resolve(group || null);
        });
      });
    });
  }
  
  // 解散标签组
  static async ungroupTabs(tabIds: number[]): Promise<boolean> {
    return new Promise((resolve) => {
      chrome.tabs.ungroup(tabIds, () => {
        if (chrome.runtime.lastError) {
          console.error('Failed to ungroup tabs:', chrome.runtime.lastError);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }
  
  // 按域名分组标签
  static async groupTabsByDomain(withName: boolean = true): Promise<void> {
    const tabs = await TabGroupManager.getAllTabs();
    const domainGroups = new Map<string, number[]>();
    
    // 按域名分组
    for (const tab of tabs) {
      if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('about:')) {
        continue;
      }
      
      const domain = TabGroupManager.getDomain(tab.url);
      if (!domainGroups.has(domain)) {
        domainGroups.set(domain, []);
      }
      const tabId = tab.id;
      if (tabId !== undefined) {
        domainGroups.get(domain)?.push(tabId);
      }
    }
    
    // 创建分组
    for (const [domain, tabIds] of domainGroups.entries()) {
      if (tabIds.length >= 2) { // 至少需要2个标签才分组
        const validTabIds = tabIds.filter(id => id !== undefined);
        if (validTabIds.length >= 2) {
          await TabGroupManager.createGroup(
            validTabIds,
            withName ? domain : undefined,
            TabGroupManager.getRandomColor()
          );
        }
      }
    }
  }
  
  // 获取所有标签
  static getAllTabs(): Promise<chrome.tabs.Tab[]> {
    return new Promise((resolve) => {
      chrome.tabs.query({ currentWindow: true }, resolve);
    });
  }
  
  // 从URL提取域名
  static getDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      let domain = urlObj.hostname;
      
      // 移除www前缀
      if (domain.startsWith('www.')) {
        domain = domain.slice(4);
      }
      
      return domain;
    } catch (e) {
      console.error('Failed to parse URL:', url, e);
      return 'unknown';
    }
  }
  
  // 获取随机颜色
  static getRandomColor(): chrome.tabGroups.ColorEnum {
    const colors: chrome.tabGroups.ColorEnum[] = ['blue', 'red', 'yellow', 'green', 'purple', 'cyan', 'pink', 'orange', 'grey'];
    return colors[Math.floor(Math.random() * colors.length)];
  }
  
  // 切换标签分组
  static async toggleTabGroup(): Promise<void> {
    const activeTab = await TabGroupManager.getActiveTab();
    if (!activeTab) return;
    
    if (activeTab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE) {
      // 未分组，创建新组
      if (activeTab.id !== undefined) {
        await TabGroupManager.createGroup([activeTab.id], 'New Group', TabGroupManager.getRandomColor());
      }
    } else {
      // 已分组，移除分组
      if (activeTab.id !== undefined) {
        await TabGroupManager.ungroupTabs([activeTab.id]);
      }
    }
  }
  
  // 获取活动标签
  static getActiveTab(): Promise<chrome.tabs.Tab | null> {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        resolve(tabs.length > 0 ? tabs[0] : null);
      });
    });
  }
}

// 命令处理器
class CommandHandler {
  // 初始化命令监听
  static init(): void {
    chrome.commands.onCommand.addListener((command) => {
      console.log('Command received:', command);
      
      switch (command) {
        case 'toggle-tab-group':
          TabGroupManager.toggleTabGroup();
          break;
        case 'group-by-domain-with-name':
          TabGroupManager.groupTabsByDomain(true);
          break;
        case 'group-by-domain-without-name':
          TabGroupManager.groupTabsByDomain(false);
          break;
        case 'remove-group':
          CommandHandler.handleRemoveGroup();
          break;
        case 'toggle-group-collapse':
          CommandHandler.handleToggleGroupCollapse();
          break;
        default:
          console.log('Unhandled command:', command);
          break;
      }
    });
  }
  
  // 处理移除组命令
  private static async handleRemoveGroup(): Promise<void> {
    const activeTab = await TabGroupManager.getActiveTab();
    if (!activeTab || activeTab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE) {
      return;
    }
    
    // 获取组内所有标签
    const tabs = await TabGroupManager.getAllTabs();
    const groupTabs = tabs.filter(tab => tab.groupId === activeTab.groupId);
    const groupTabIds = groupTabs.map(tab => tab.id).filter(id => id !== undefined) as number[];
    
    // 解散组
    await TabGroupManager.ungroupTabs(groupTabIds);
  }
  
  // 处理切换组折叠状态命令
  private static async handleToggleGroupCollapse(): Promise<void> {
    const activeTab = await TabGroupManager.getActiveTab();
    if (!activeTab || activeTab.groupId === chrome.tabGroups.TAB_GROUP_ID_NONE) {
      return;
    }
    
    // 获取组信息
    chrome.tabGroups.get(activeTab.groupId, (group) => {
      if (group) {
        chrome.tabGroups.update(activeTab.groupId, { collapsed: !group.collapsed });
      }
    });
  }
}

// 上下文菜单管理器
class ContextMenuManager {
  // 初始化上下文菜单
  static init(): void {
    // 创建主菜单项
    chrome.contextMenus.create({
      id: 'tab-group-menu',
      title: 'Tab Group',
      contexts: ['page', 'browser_action']
    });
    
    // 创建子菜单项
    chrome.contextMenus.create({
      id: 'save-current-tab',
      parentId: 'tab-group-menu',
      title: 'Save Current Tab',
      contexts: ['page', 'browser_action']
    });
    
    chrome.contextMenus.create({
      id: 'save-current-group',
      parentId: 'tab-group-menu',
      title: 'Save Current Group',
      contexts: ['page', 'browser_action']
    });
    
    // 添加事件监听
    chrome.contextMenus.onClicked.addListener((info, tab) => {
      ContextMenuManager.handleContextMenuClick(info, tab);
    });
  }
  
  // 处理上下文菜单点击
  private static handleContextMenuClick(info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab): void {
    if (!tab) return;
    
    switch (info.menuItemId) {
      case 'save-current-tab':
        // 保存当前标签的逻辑
        console.log('Saving current tab:', tab.title);
        break;
      case 'save-current-group':
        // 保存当前组的逻辑
        if (tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
          console.log('Saving current group:', tab.groupId);
        }
        break;
    }
  }
}

// 初始化插件
function initExtension(): void {
  // 初始化命令处理
  CommandHandler.init();
  
  // 初始化上下文菜单
  ContextMenuManager.init();
  
  // 监听标签创建事件
  chrome.tabs.onCreated.addListener((tab) => {
    console.log('Tab created:', tab.id, tab.title);
  });
  
  // 监听标签关闭事件
  chrome.tabs.onRemoved.addListener((tabId) => {
    console.log('Tab removed:', tabId);
  });
  
  // 监听标签组创建事件
  chrome.tabGroups.onCreated.addListener((group) => {
    console.log('Group created:', group.id, group.title);
  });
  
  // 监听标签组移除事件
  chrome.tabGroups.onRemoved.addListener((groupId) => {
    console.log('Group removed:', groupId);
  });
  
  console.log('Tab Group extension initialized');
}

// 启动插件
initExtension();