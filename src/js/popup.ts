import { GroupStore } from './group-store';

// 常量定义
const NoGroup = chrome.tabGroups.TAB_GROUP_ID_NONE;
const QueryInWindow = { windowId: chrome.windows.WINDOW_ID_CURRENT };
const NoName = chrome.i18n.getMessage('NoName') || 'Untitled';

// 颜色映射
const ColorMap: Record<chrome.tabGroups.ColorEnum, string> = {
  blue: '#5E81AC',
  red: '#BF616A',
  yellow: '#EBCB8B',
  green: '#A3BE8C',
  purple: '#B48EAD',
  cyan: '#88C0D0',
  pink: '#FF79C6',
  orange: '#FFB86C',
  grey: '#4C566A'
};

// 默认颜色
const DEFAULT_COLOR = '#888888';

// 创建颜色标识
function createColorSpan(color?: chrome.tabGroups.ColorEnum): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = 'd-inline-block rounded-circle size-18 align-text-bottom me-2';
  if (color && ColorMap[color]) {
    span.style.backgroundColor = ColorMap[color];
  } else {
    span.classList.add('border');
  }
  return span;
}

// 创建图标
function createFavicon(url?: string): HTMLImageElement {
  const img = document.createElement('img');
  img.className = 'size-18 align-text-bottom mr-10';
  
  if (url) {
    requestIdleCallback(() => {
      img.src = `/_favicon/?pageUrl=${encodeURIComponent(url)}&size=36`;
    }, { timeout: 10000 });
  } else {
    img.src = 'img/tab-24px.svg';
  }
  
  return img;
}

// 延迟执行函数
function delay<T extends (...args: any[]) => void>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout = 0;
  return function(this: any, ...args: Parameters<T>) {
    clearTimeout(timeout);
    timeout = window.setTimeout(() => func.apply(this, args), wait);
  };
}

// 显示成功提示
function showSuccessTip(message?: string): void {
  const tipElement = document.getElementById('successTip');
  if (!tipElement) return;
  
  message = message || chrome.i18n.getMessage('Saved') || 'Saved';
  const tipContent = tipElement.firstElementChild;
  if (tipContent) {
    tipContent.textContent = message;
  }
  
  // 简单的提示实现
  tipElement.style.display = 'block';
  setTimeout(() => {
    tipElement.style.display = 'none';
  }, 1000);
}

// 标签组管理类
class Group {
  private static container: HTMLElement | null = null;
  private static collapseAll: HTMLElement | null = null;
  private static dropdownMoveMenu: HTMLElement | null = null;
  private static currentWindowId: number | null = null;
  private static delayRefresh: ((...args: any[]) => void) | null = null;
  
  // 初始化
  static init(): void {
    Group.container = document.getElementById('current-tab-list');
    Group.collapseAll = document.getElementById('current-collapse-all');
    
    if (Group.collapseAll) {
      Group.collapseAll.addEventListener('click', Group.toggleCollpaseAll);
    }
    
    Group.setupCurrentTabs();
    Group.initEventListeners();
    Group.initMoveMenu();
    
    // 设置延迟刷新
    Group.delayRefresh = delay(Group.setupCurrentTabs, 500);
  }
  
  // 初始化事件监听
  private static initEventListeners(): void {
    chrome.tabGroups.onRemoved.addListener(Group.onGroupRemoved);
    chrome.tabs.onUpdated.addListener(Group.onTabUpdated);
    chrome.tabs.onCreated.addListener(Group.onTabCreated);
    chrome.tabs.onRemoved.addListener(Group.onTabRemoved);
  }
  
  // 初始化移动菜单
  private static initMoveMenu(): void {
    Group.dropdownMoveMenu = document.getElementById('dropdown-move-to');
    
    if (Group.dropdownMoveMenu && Group.dropdownMoveMenu.children.length >= 3) {
      const firstItem = Group.dropdownMoveMenu.children[1].firstElementChild;
      if (firstItem) {
        firstItem.addEventListener('click', Group.onMoveMenuItemClick);
      }
    }
    
    chrome.windows.getCurrent({ windowTypes: ['normal'] }, (window) => {
      if (window) {
        Group.currentWindowId = window.id || null;
      }
    });
  }
  
  // 刷新移动菜单
  static refreshMoveMenu(): void {
    chrome.windows.getAll({ windowTypes: ['normal'], populate: true }, (windows) => {
      if (!Group.dropdownMoveMenu) return;
      
      const targetWindows = windows.filter(win => win.id !== Group.currentWindowId);
      
      // 确保至少有3个子元素
      if (Group.dropdownMoveMenu.children.length < 4) return;
      
      // 使用Array.from将HTMLCollection转换为数组，使其可迭代
      const allChildren = Array.from(Group.dropdownMoveMenu.children);
      const divider = allChildren[2];
      const noWindowItem = allChildren[3];
      
      // 移除现有菜单项
      const startIndex = allChildren.indexOf(noWindowItem) + 1;
      for (let i = startIndex; i < allChildren.length; i++) {
        allChildren[i].remove();
      }
      
      // 根据是否有目标窗口显示或隐藏相关元素
      if (targetWindows.length > 0) {
        if (divider instanceof HTMLElement) divider.classList.remove('d-none');
        if (noWindowItem instanceof HTMLElement) noWindowItem.classList.remove('d-none');
        
        // 添加新的菜单项
        targetWindows.forEach(Group.createMoveMenuItem);
      } else {
        if (divider instanceof HTMLElement) divider.classList.add('d-none');
        if (noWindowItem instanceof HTMLElement) noWindowItem.classList.add('d-none');
      }
    });
  }
  
  // 创建移动菜单项
  private static createMoveMenuItem(window: chrome.windows.Window): void {
    if (!Group.dropdownMoveMenu) return;
    
    const li = document.createElement('li');
    const button = document.createElement('button');
    
    button.type = 'button';
    button.className = 'dropdown-item text-truncate';
    if (window.id !== undefined) {
      button.dataset.target = window.id.toString();
      button.addEventListener('click', Group.onMoveMenuItemClick);
    }
    
    // 添加图标
    if (window.tabs && window.tabs.length > 0) {
      for (const tab of window.tabs) {
        if (tab.url) {
          const favicon = createFavicon(tab.url);
          favicon.title = tab.title || '';
          button.appendChild(favicon);
          break;
        }
      }
    }
    
    li.appendChild(button);
    Group.dropdownMoveMenu.appendChild(li);
  }
  
  // 设置当前标签页显示
  static setupCurrentTabs(): void {
    chrome.tabGroups.query(QueryInWindow, (groups) => {
      const groupMap = new Map<number, chrome.tabGroups.TabGroup>(
        groups.map(group => [group.id, group])
      );
      
      chrome.tabs.query(QueryInWindow, (tabs) => {
        const elements: HTMLElement[] = [];
        let lastGroupId = -1;
        
        for (const tab of tabs) {
          const groupId = tab.groupId;
          
          if (groupId === NoGroup) {
            elements.push(Group.createTab(tab, false));
          } else {
            if (groupId !== lastGroupId) {
              lastGroupId = groupId;
              const group = groupMap.get(groupId);
              if (group) {
                elements.push(Group.createGroup(group));
              }
            }
            elements.push(Group.createTab(tab, true));
          }
        }
        
        // 添加到容器
        if (Group.container) {
          Group.container.replaceChildren(...elements);
        }
      });
    });
  }
  
  // 创建标签组元素
  private static createGroup(group: chrome.tabGroups.TabGroup): HTMLElement {
    const groupElement = document.createElement('div');
    groupElement.className = 'group-item p-2 border-bottom';
    
    const groupHeader = document.createElement('div');
    groupHeader.className = 'group-header d-flex align-items-center';
    
    // 颜色标识
    groupHeader.appendChild(createColorSpan(group.color));
    
    // 组标题
    const titleElement = document.createElement('span');
    titleElement.className = 'group-title flex-grow-1';
    titleElement.textContent = group.title || NoName;
    groupHeader.appendChild(titleElement);
    
    // 折叠按钮
    const collapseButton = document.createElement('button');
    collapseButton.className = 'btn btn-sm';
    collapseButton.innerHTML = group.collapsed ? '展开' : '折叠';
    collapseButton.addEventListener('click', () => {
      chrome.tabGroups.update(group.id, { collapsed: !group.collapsed });
    });
    groupHeader.appendChild(collapseButton);
    
    // 保存按钮
    const saveButton = document.createElement('button');
    saveButton.className = 'btn btn-sm ms-2';
    saveButton.innerHTML = '保存';
    saveButton.addEventListener('click', async () => {
      const success = await GroupStore.snapshotGroup(group.id);
      if (success) {
        showSuccessTip();
      }
    });
    groupHeader.appendChild(saveButton);
    
    groupElement.appendChild(groupHeader);
    
    return groupElement;
  }
  
  // 创建标签页元素
  private static createTab(tab: chrome.tabs.Tab, inGroup: boolean): HTMLElement {
    const tabElement = document.createElement('div');
    tabElement.className = `tab-item p-2 border-bottom ${inGroup ? 'ms-4' : ''}`;
    
    const tabContent = document.createElement('div');
    tabContent.className = 'd-flex align-items-center';
    
    // 图标
    tabContent.appendChild(createFavicon(tab.url));
    
    // 标题
    const titleElement = document.createElement('span');
    titleElement.className = 'tab-title flex-grow-1';
    titleElement.textContent = tab.title || 'Untitled';
    tabContent.appendChild(titleElement);
    
    // 保存按钮
    const saveButton = document.createElement('button');
    saveButton.className = 'btn btn-sm';
    saveButton.innerHTML = '保存';
    saveButton.addEventListener('click', async () => {
      if (tab.id !== undefined) {
        const success = await GroupStore.snapshotTab(tab.id);
        if (success) {
          showSuccessTip();
        }
      }
    });
    tabContent.appendChild(saveButton);
    
    tabElement.appendChild(tabContent);
    
    return tabElement;
  }
  
  // 切换所有组的折叠状态
  private static toggleCollpaseAll(): void {
    chrome.tabGroups.query(QueryInWindow, (groups) => {
      const hasCollapsed = groups.some(group => group.collapsed);
      
      groups.forEach(group => {
        chrome.tabGroups.update(group.id, { collapsed: !hasCollapsed });
      });
    });
  }
  
  // 移动菜单项点击事件
  private static onMoveMenuItemClick(event: Event): void {
    const target = event.target as HTMLElement;
    const windowIdStr = target.dataset.target || target.parentElement?.dataset.target;
    
    if (windowIdStr) {
      const windowId = parseInt(windowIdStr, 10);
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length > 0 && tabs[0].id !== undefined) {
          chrome.tabs.move(tabs[0].id, { windowId, index: -1 });
        }
      });
    }
  }
  
  // 组移除事件
  private static onGroupRemoved(group: chrome.tabGroups.TabGroup): void {
    if (Group.delayRefresh) {
      Group.delayRefresh();
    }
  }
  
  // 标签页更新事件
  private static onTabUpdated(tabId: number, changeInfo: chrome.tabs.TabChangeInfo): void {
    if (changeInfo.title || changeInfo.url || changeInfo.groupId !== undefined) {
      if (Group.delayRefresh) {
        Group.delayRefresh();
      }
    }
  }
  
  // 标签页创建事件
  private static onTabCreated(tab: chrome.tabs.Tab): void {
    if (Group.delayRefresh) {
      Group.delayRefresh();
    }
  }
  
  // 标签页移除事件
  private static onTabRemoved(tabId: number): void {
    if (Group.delayRefresh) {
      Group.delayRefresh();
    }
  }
}

// 初始化插件
function initPopup(): void {
  // 等待DOM加载完成
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      Group.init();
    });
  } else {
    Group.init();
  }
}

// 启动插件
initPopup();