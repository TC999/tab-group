import { TabGroup, TabData } from './types';

export class GroupStore {
  // 保存标签组
  static async saveGroup(group: chrome.tabGroups.TabGroup, tabs: chrome.tabs.Tab[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const tabData = tabs.map(tab => ({
        title: tab.title || '',
        url: tab.url || '',
        favIconUrl: tab.favIconUrl
      }));
      
      const createTime = Date.now();
      const groupId = `group-${createTime.toString(36)}`;
      const groupTitle = group.title || '';
      
      const groupData: Record<string, TabGroup> = {};
      groupData[groupId] = {
        id: groupId,
        type: 'group',
        createTime,
        title: groupTitle,
        color: group.color,
        tabs: tabData
      };
      
      chrome.storage.local.set(groupData, () => {
        if (groupTitle) {
          chrome.storage.local.get(null, async (items) => {
            const groupsWithSameTitle: TabGroup[] = [];
            for (const item of Object.values(items)) {
              if (item && (item as TabGroup).type === 'group' && (item as TabGroup).title === groupTitle) {
                groupsWithSameTitle.push(item as TabGroup);
              }
            }
            
            groupsWithSameTitle.sort((a, b) => b.createTime - a.createTime);
            
            // 保留最新的几个快照
            const maxSnapshots = 5; // 默认保留5个快照
            for (let i = maxSnapshots; i < groupsWithSameTitle.length; i++) {
              await GroupStore.delete(groupsWithSameTitle[i].id);
            }
            
            resolve();
          });
        } else {
          resolve();
        }
      });
    });
  }
  
  // 保存单个标签页
  static async saveTab(tab: chrome.tabs.Tab): Promise<void> {
    return new Promise((resolve) => {
      const createTime = Date.now();
      const tabId = `tab-${createTime.toString(36)}`;
      const url = tab.url || '';
      
      // 使用更简单的类型定义
      const tabData: Record<string, any> = {};
      tabData[tabId] = {
        id: tabId,
        type: 'tab',
        createTime,
        title: tab.title || '',
        url: url,
        favIconUrl: tab.favIconUrl
      };
      
      chrome.storage.local.set(tabData, () => {
        chrome.storage.local.get(null, async (items) => {
          const tabsWithSameUrl: any[] = [];
          for (const item of Object.values(items)) {
            if (item && item.type === 'tab' && item.url === url) {
              tabsWithSameUrl.push(item);
            }
          }
          
          tabsWithSameUrl.sort((a, b) => b.createTime - a.createTime);
          
          // 只保留最新的一个
          for (let i = 1; i < tabsWithSameUrl.length; i++) {
            await GroupStore.delete(tabsWithSameUrl[i].id);
          }
          
          resolve();
        });
      });
    });
  }
  
  // 从保存的标签组中删除标签页
  static async deleteTabInGroup(groupId: string, tabIndex: number, tabUrl: string): Promise<boolean> {
    return new Promise((resolve) => {
      chrome.storage.local.get(groupId, (result) => {
        const group = result[groupId] as TabGroup;
        if (group && group.tabs[tabIndex] && group.tabs[tabIndex].url === tabUrl) {
          group.tabs.splice(tabIndex, 1);
          const updatedData: Record<string, TabGroup> = {};
          updatedData[groupId] = group;
          
          chrome.storage.local.set(updatedData, () => {
            resolve(true);
          });
        } else {
          resolve(false);
        }
      });
    });
  }
  
  // 向保存的标签组添加标签页
  static async addTabsInGroup(groupId: string, tabs: TabData[]): Promise<boolean> {
    return new Promise((resolve) => {
      chrome.storage.local.get(groupId, (result) => {
        const group = result[groupId] as TabGroup;
        if (group && group.tabs) {
          group.tabs = group.tabs.concat(tabs);
          chrome.storage.local.set(result, () => {
            resolve(true);
          });
        } else {
          resolve(false);
        }
      });
    });
  }
  
  // 删除保存的标签组或标签页
  static async delete(id: string): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.remove(id, resolve);
    });
  }
  
  // 获取所有保存的标签组和标签页
  static async getAll(): Promise<(TabGroup | any)[]> {
    return new Promise((resolve) => {
      chrome.storage.local.get(null, (items) => {
        const result: (TabGroup | any)[] = [];
        for (const item of Object.values(items)) {
          if (item && (item.type === 'group' || item.type === 'tab')) {
            result.push(item);
          }
        }
        
        // 按创建时间排序，最新的在前
        result.sort((a, b) => b.createTime - a.createTime);
        resolve(result);
      });
    });
  }
  
  // 快照当前标签组
  static async snapshotGroup(groupId: number): Promise<boolean> {
    return new Promise((resolve) => {
      chrome.tabGroups.get(groupId, async (group) => {
        if (group) {
          const tabs = await GroupStore.getTabsInGroup(groupId);
          if (tabs.length > 0) {
            await GroupStore.saveGroup(group, tabs);
            resolve(true);
          } else {
            resolve(false);
          }
        } else {
          resolve(false);
        }
      });
    });
  }
  
  // 快照当前标签页
  static async snapshotTab(tabId: number): Promise<boolean> {
    return new Promise((resolve) => {
      chrome.tabs.get(tabId, async (tab) => {
        if (tab && tab.url) {
          await GroupStore.saveTab(tab);
          resolve(true);
        } else {
          resolve(false);
        }
      });
    });
  }
  
  // 获取组内的所有标签页
  static async getTabsInGroup(groupId: number): Promise<chrome.tabs.Tab[]> {
    return new Promise((resolve) => {
      chrome.tabs.query({ windowId: chrome.windows.WINDOW_ID_CURRENT }, (tabs) => {
        const groupTabs = tabs.filter(tab => tab.groupId === groupId && tab.url);
        resolve(groupTabs);
      });
    });
  }
}