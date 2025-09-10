import { TabGroup, TabData } from './types';

export class GroupStore {
  // 快照当前标签组
  static async snapshotGroup(groupId: number): Promise<boolean> {
    return new Promise((resolve) => {
      chrome.tabGroups.get(groupId, async (group) => {
        if (group) {
          chrome.tabs.query({ windowId: chrome.windows.WINDOW_ID_CURRENT }, async (tabs) => {
            const groupTabs = tabs.filter(tab => tab.groupId === groupId && tab.url);
            await GroupStore.saveGroup(group, groupTabs);
            resolve(true);
          });
        } else {
          resolve(false);
        }
      });
    });
  }

  // 保存标签组
  static async saveGroup(group: chrome.tabGroups.TabGroup, tabs: chrome.tabs.Tab[]): Promise<void> {
    return new Promise((resolve) => {
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

      chrome.storage.local.set(groupData, async () => {
        if (groupTitle) {
          chrome.storage.local.get(null, async (items) => {
            const groupsWithSameTitle: TabGroup[] = [];
            for (const item of Object.values(items)) {
              if (item && (item as TabGroup).type === 'group' && (item as TabGroup).title === groupTitle) {
                groupsWithSameTitle.push(item as TabGroup);
              }
            }

            groupsWithSameTitle.sort((a, b) => b.createTime - a.createTime);

            // 获取最大快照数量设置
            let maxSnapshots = 5; // 默认值
            try {
              const settings = await chrome.storage.sync.get('max-snapshots');
              if (settings['max-snapshots']) {
                maxSnapshots = settings['max-snapshots'];
              }
            } catch (e) {
              console.error('Failed to get max-snapshots setting:', e);
            }

            // 保留最新的几个快照
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

  // 保存单个标签页
  static async saveTab(tab: chrome.tabs.Tab): Promise<void> {
    return new Promise((resolve) => {
      const createTime = Date.now();
      const tabId = `tab-${createTime.toString(36)}`;
      const url = tab.url || '';

      const tabData: Record<string, any> = {};
      tabData[tabId] = {
        id: tabId,
        type: 'tab',
        createTime,
        title: tab.title || '',
        url: url,
        favIconUrl: tab.favIconUrl
      };

      chrome.storage.local.set(tabData, async () => {
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

  // 更新标签组的属性
  static async updateGroup(groupId: string, property: string, value: any): Promise<boolean> {
    return new Promise((resolve) => {
      if (groupId.startsWith('group-')) {
        chrome.storage.local.get(groupId, (result) => {
          const group = result[groupId] as TabGroup;
          if (group) {
            (group as any)[property] = value;
            chrome.storage.local.set(result, () => {
              resolve(true);
            });
          } else {
            resolve(false);
          }
        });
      } else {
        resolve(false);
      }
    });
  }

  // 更新标签组名称
  static async updateGroupName(groupId: string, name: string): Promise<boolean> {
    return GroupStore.updateGroup(groupId, 'title', name);
  }

  // 更新标签组颜色
  static async updateGroupColor(groupId: string, color: chrome.tabGroups.ColorEnum): Promise<boolean> {
    return GroupStore.updateGroup(groupId, 'color', color);
  }

  // 获取所有保存的标签组和标签页
  static async getAll(sortBy?: string): Promise<(TabGroup | any)[]> {
    return new Promise((resolve) => {
      chrome.storage.local.get(null, (items) => {
        const result: (TabGroup | any)[] = [];
        for (const item of Object.values(items)) {
          if (item && (item.type === 'group' || item.type === 'tab')) {
            result.push(item);
          }
        }

        // 根据排序方式排序
        if (sortBy === 'nameAsc') {
          const collator = new Intl.Collator();
          result.sort((a, b) => collator.compare(a.title, b.title));
        } else if (sortBy === 'nameDesc') {
          const collator = new Intl.Collator();
          result.sort((a, b) => collator.compare(b.title, a.title));
        } else if (sortBy === 'timeAsc') {
          result.sort((a, b) => a.createTime - b.createTime);
        } else {
          // 默认按时间降序排序
          result.sort((a, b) => b.createTime - a.createTime);
        }

        resolve(result);
      });
    });
  }

  // 删除所有保存的标签组和标签页
  static async deleteAll(): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.local.clear(resolve);
    });
  }

  // 合并同名的标签组
  static async mergeGroup(groupName: string): Promise<boolean> {
    if (!groupName) return false;

    try {
      const allGroups = await GroupStore.getAll();
      const urlSet = new Set<string>();
      const tabs: TabData[] = [];
      const groupsWithSameName: (TabGroup | any)[] = [];

      // 收集所有同名标签组的标签
      for (const item of allGroups) {
        if (item.type === 'group' && item.title === groupName) {
          groupsWithSameName.push(item);
          for (const tab of item.tabs) {
            if (!urlSet.has(tab.url)) {
              urlSet.add(tab.url);
              tabs.push(tab);
            }
          }
        }
      }

      // 如果有多个同名组并且有标签，则合并
      if (groupsWithSameName.length > 1 && tabs.length > 0) {
        const createTime = Date.now();
        const newGroupId = `group-${createTime.toString(36)}`;
        const newGroup: TabGroup = {
          id: newGroupId,
          type: 'group',
          createTime,
          title: groupName,
          color: groupsWithSameName[0].color, // 使用第一个组的颜色
          tabs: tabs
        };

        // 删除所有同名组
        for (const group of groupsWithSameName) {
          await GroupStore.delete(group.id);
        }

        // 保存新的合并后的组
        const newGroupData: Record<string, TabGroup> = {};
        newGroupData[newGroupId] = newGroup;
        await new Promise<void>((resolve) => {
          chrome.storage.local.set(newGroupData, resolve);
        });

        return true;
      }

      return false;
    } catch (e) {
      console.error('Failed to merge groups:', e);
      return false;
    }
  }

  // 合并所有同名的标签组
  static async mergeAllGroups(): Promise<boolean> {
    try {
      const allGroups = await GroupStore.getAll();
      const groupNameMap = new Map<string, number>();

      // 统计每个组名出现的次数
      for (const item of allGroups) {
        if (item.type === 'group' && item.title) {
          const count = groupNameMap.get(item.title) || 0;
          groupNameMap.set(item.title, count + 1);
        }
      }

      let merged = false;
      // 合并所有出现次数大于1的组名
      for (const [name, count] of groupNameMap) {
        if (count > 1) {
          const result = await GroupStore.mergeGroup(name);
          merged = merged || result;
        }
      }

      return merged;
    } catch (e) {
      console.error('Failed to merge all groups:', e);
      return false;
    }
  }

  // 更新单个标签
  static async updateTab(tabId: string, title: string, url: string): Promise<any> {
    return new Promise((resolve) => {
      chrome.storage.local.get(tabId, (result) => {
        const tab = result[tabId];
        if (tab && tab.type === 'tab') {
          tab.title = title;
          tab.url = url;
          chrome.storage.local.set(result, () => {
            resolve(tab);
          });
        } else {
          resolve(false);
        }
      });
    });
  }

  // 更新标签组中的标签
  static async updateTabInGroup(groupId: string, tabIndex: number, title: string, url: string): Promise<any> {
    return new Promise((resolve) => {
      chrome.storage.local.get(groupId, (result) => {
        const group = result[groupId] as TabGroup;
        if (!group || !group.tabs || tabIndex >= group.tabs.length) {
          resolve(false);
        } else {
          const tab = group.tabs[tabIndex];
          tab.title = title;
          tab.url = url;
          chrome.storage.local.set(result, () => {
            resolve(group);
          });
        }
      });
    });
  }

  // 导入JSON数据
  static async importJson(file: File): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const content = await file.text();
        const data = JSON.parse(content);

        if (data.meta?.name === 'tab-groups' && data.meta?.version >= 1) {
          delete data.meta;
          const validData: Record<string, any> = {};

          // 验证数据
          for (const [key, value] of Object.entries(data)) {
            if (value.type === 'group') {
              if (value.tabs && value.color) {
                validData[key] = value;
              }
            } else if (value.type === 'tab') {
              if (value.url) {
                validData[key] = value;
              }
            }
          }

          // 保存数据
          await new Promise<void>((resolve) => {
            chrome.storage.local.set(validData, resolve);
          });

          resolve();
        } else {
          reject(new Error('metadata validation failed'));
        }
      } catch (e) {
        reject(e);
      }
    });
  }

  // 导出文件辅助函数
  private static downloadFile(url: string, extension: string): void {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const filename = `tabgroups_data_${year}${month}${day}.${extension}`;

    // 创建或重用a标签
    if (!GroupStore.exportFile) {
      GroupStore.exportFile = document.createElement('a');
    }

    GroupStore.exportFile.download = filename;
    GroupStore.exportFile.href = url;
    GroupStore.exportFile.click();
  }

  private static exportFile: HTMLAnchorElement | null = null;

  // 导出JSON数据
  static exportJson(): void {
    chrome.storage.local.get(null, (data) => {
      data.meta = {
        name: 'tab-groups',
        version: 1
      };

      const jsonData = JSON.stringify(data);
      const blobUrl = `data:application/json;charset=utf-8,${encodeURIComponent(jsonData)}`;
      GroupStore.downloadFile(blobUrl, 'json');
    });
  }

  // 生成HTML列表项
  private static generateLi(url: string, title: string): string {
    // 转义HTML特殊字符
    const escapedTitle = title
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    return `<li><a href="${url}">${escapedTitle}</a></li>`;
  }

  // 导出HTML数据
  static async exportHtml(): Promise<void> {
    try {
      const allGroups = await GroupStore.getAll();
      const htmlLines: string[] = ['<ul>'];

      // 生成HTML内容
      for (const item of allGroups) {
        if (item.type === 'group') {
          const groupName = item.title ? item.title : 'No Name Group';
          htmlLines.push(`<li>▼ ${groupName}<ul>`);
          for (const tab of item.tabs) {
            htmlLines.push(GroupStore.generateLi(tab.url, tab.title));
          }
          htmlLines.push('</ul></li>');
        } else if (item.type === 'tab') {
          htmlLines.push(GroupStore.generateLi(item.url, item.title));
        }
      }

      htmlLines.push('</ul>');

      // 构建完整的HTML文档
      const htmlContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><title></title><style>li{line-height:1.5;font-family:system-ui;} body>ul{list-style: none;}</style></head><body>${htmlLines.join('')}</body></html>`;
      const blobUrl = `data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`;

      GroupStore.downloadFile(blobUrl, 'html');
    } catch (e) {
      console.error('Failed to export HTML:', e);
    }
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