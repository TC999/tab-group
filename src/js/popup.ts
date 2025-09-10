import { GroupStore } from './group-store';
import { RuleStore } from './rule-store';

// 常量定义
const NoGroup = chrome.tabGroups.TAB_GROUP_ID_NONE;
const QueryInWindow = { windowId: chrome.windows.WINDOW_ID_CURRENT };
const NoName = chrome.i18n.getMessage('NoName') || 'Untitled';
const Saved = chrome.i18n.getMessage('Saved') || 'Saved';
const SavedTab = chrome.i18n.getMessage('SavedTab') || 'Saved';
const SavedGroupText = chrome.i18n.getMessage('SavedGroup') || 'Saved';
const Updated = chrome.i18n.getMessage('Updated') || 'Updated';
const Deleted = chrome.i18n.getMessage('Deleted') || 'Deleted';
const Expanded = chrome.i18n.getMessage('Expanded') || 'Expand';
const Collapsed = chrome.i18n.getMessage('Collapsed') || 'Collapse';
const CollapseAll = chrome.i18n.getMessage('CollapseAll') || 'Collapse All';
const ExpandAll = chrome.i18n.getMessage('ExpandAll') || 'Expand All';
const MergeAllGroup = chrome.i18n.getMessage('MergeAllGroup') || 'Merge All Same Name Groups';
const MergeGroup = chrome.i18n.getMessage('MergeGroup') || 'Merge';
const Search = chrome.i18n.getMessage('Search') || 'Search';
const SearchPlaceholder = chrome.i18n.getMessage('SearchPlaceholder') || 'Search tabs and groups...';
const Sort = chrome.i18n.getMessage('Sort') || 'Sort';
const SortByNameAsc = chrome.i18n.getMessage('SortByNameAsc') || 'Sort by name (A-Z)';
const SortByNameDesc = chrome.i18n.getMessage('SortByNameDesc') || 'Sort by name (Z-A)';
const SortByTimeAsc = chrome.i18n.getMessage('SortByTimeAsc') || 'Sort by time (Oldest)';
const SortByTimeDesc = chrome.i18n.getMessage('SortByTimeDesc') || 'Sort by time (Newest)';
const DeleteAll = chrome.i18n.getMessage('DeleteAll') || 'Delete All';
const Import = chrome.i18n.getMessage('Import') || 'Import';
const Export = chrome.i18n.getMessage('Export') || 'Export';
const ExportHtml = chrome.i18n.getMessage('ExportHtml') || 'Export as HTML';
const ExportJson = chrome.i18n.getMessage('ExportJson') || 'Export as JSON';
const MoveTo = chrome.i18n.getMessage('MoveTo') || 'Move to';
const NoWindow = chrome.i18n.getMessage('NoWindow') || 'No other window';
const Edit = chrome.i18n.getMessage('Edit') || 'Edit';
const Save = chrome.i18n.getMessage('Save') || 'Save';
const Rename = chrome.i18n.getMessage('Rename') || 'Rename';
const CreateSnapshot = chrome.i18n.getMessage('CreateSnapshot') || 'Create Snapshot';
const OpenAll = chrome.i18n.getMessage('OpenAll') || 'Open All';
const Delete = chrome.i18n.getMessage('Delete') || 'Delete';
const SelectAll = chrome.i18n.getMessage('SelectAll') || 'Select All';
const DeselectAll = chrome.i18n.getMessage('DeselectAll') || 'Deselect All';
const RemoveSelected = chrome.i18n.getMessage('RemoveSelected') || 'Remove Selected';

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
  
  message = message || Saved;
  const tipContent = tipElement.firstElementChild;
  if (tipContent) {
    tipContent.textContent = message;
  }
  
  // 使用Bootstrap的Toast组件
  if (window['bootstrap'] && window['bootstrap'].Toast) {
    const toast = new window['bootstrap'].Toast(tipElement);
    toast.show();
  } else {
    // 简单的提示实现作为备选
    tipElement.style.display = 'block';
    setTimeout(() => {
      tipElement.style.display = 'none';
    }, 1000);
  }
}

// 防抖函数
function debounce<T extends (...args: any[]) => void>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: number | null = null;
  return function(this: any, ...args: Parameters<T>) {
    const context = this;
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = window.setTimeout(() => {
      func.apply(context, args);
      timeout = null;
    }, wait);
  };
}

// 标签组管理类
class Group {
  private static container: HTMLElement | null = null;
  private static collapseAll: HTMLElement | null = null;
  private static dropdownMoveMenu: HTMLElement | null = null;
  private static currentWindowId: number | null = null;
  private static delayRefresh: ((...args: any[]) => void) | null = null;
  private static lastGroupId: number = -1;
  private static isCollapsedAll: boolean = false;
  
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
    chrome.tabGroups.onUpdated.addListener(Group.onGroupUpdated);
    chrome.tabs.onUpdated.addListener(Group.onTabUpdated);
    chrome.tabs.onCreated.addListener(Group.onTabCreated);
    chrome.tabs.onRemoved.addListener(Group.onTabRemoved);
    chrome.tabs.onMoved.addListener(Group.onTabMoved);
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
    if (!Group.container) return;
    
    chrome.tabGroups.query(QueryInWindow, (groups) => {
      const groupMap = new Map<number, chrome.tabGroups.TabGroup>(
        groups.map(group => [group.id, group])
      );
      
      chrome.tabs.query(QueryInWindow, (tabs) => {
        const elements: HTMLElement[] = [];
        Group.lastGroupId = -1;
        
        // 按位置对标签进行排序
        tabs.sort((a, b) => (a.index || 0) - (b.index || 0));
        
        for (const tab of tabs) {
          const groupId = tab.groupId;
          
          if (groupId === NoGroup) {
            elements.push(Group.createTab(tab, false));
          } else {
            if (groupId !== Group.lastGroupId) {
              Group.lastGroupId = groupId;
              const group = groupMap.get(groupId);
              if (group) {
                elements.push(Group.createGroup(group));
              }
            }
            elements.push(Group.createTab(tab, true));
          }
        }
        
        // 添加到容器
        Group.container!.replaceChildren(...elements);
        
        // 更新折叠按钮状态
        if (Group.collapseAll) {
          const allCollapsed = groups.every(group => group.collapsed);
          Group.isCollapsedAll = allCollapsed;
          Group.collapseAll.textContent = allCollapsed ? ExpandAll : CollapseAll;
        }
      });
    });
  }
  
  // 创建标签组元素
  private static createGroup(group: chrome.tabGroups.TabGroup): HTMLElement {
    const groupElement = document.createElement('div');
    groupElement.className = 'group-item p-2 border-bottom';
    groupElement.dataset.groupId = group.id.toString();
    
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
    collapseButton.innerHTML = group.collapsed ? Expanded : Collapsed;
    collapseButton.addEventListener('click', () => {
      chrome.tabGroups.update(group.id, { collapsed: !group.collapsed });
    });
    groupHeader.appendChild(collapseButton);
    
    // 保存按钮
    const saveButton = document.createElement('button');
    saveButton.className = 'btn btn-sm ms-2';
    saveButton.innerHTML = Save;
    saveButton.addEventListener('click', async () => {
      const success = await GroupStore.snapshotGroup(group.id);
      if (success) {
        showSuccessTip(SavedGroupText);
        // 刷新已保存标签组列表
        if (window['SavedGroup']) {
          window['SavedGroup'].setupSavedGroups();
        }
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
    const favicon = createFavicon(tab.url);
    favicon.title = tab.title || '';
    tabContent.appendChild(favicon);
    
    // 标题
    const titleElement = document.createElement('span');
    titleElement.className = 'tab-title flex-grow-1';
    titleElement.textContent = tab.title || 'Untitled';
    tabContent.appendChild(titleElement);
    
    // 保存按钮
    const saveButton = document.createElement('button');
    saveButton.className = 'btn btn-sm';
    saveButton.innerHTML = Save;
    saveButton.addEventListener('click', async () => {
      if (tab.id !== undefined) {
        const success = await GroupStore.snapshotTab(tab.id);
        if (success) {
          showSuccessTip(SavedTab);
          // 刷新已保存标签组列表
          if (window['SavedGroup']) {
            window['SavedGroup'].setupSavedGroups();
          }
        }
      }
    });
    tabContent.appendChild(saveButton);
    
    // 如果标签页是活动的，添加高亮样式
    if (tab.active) {
      tabElement.classList.add('active');
    }
    
    // 点击标签页打开它
    tabElement.addEventListener('click', (e) => {
      // 如果点击的是按钮，不触发标签页切换
      if ((e.target as HTMLElement).tagName.toLowerCase() === 'button') {
        return;
      }
      
      if (tab.id !== undefined) {
        chrome.tabs.update(tab.id, { active: true });
      }
    });
    
    tabElement.appendChild(tabContent);
    
    return tabElement;
  }
  
  // 切换所有组的折叠状态
  private static toggleCollpaseAll(): void {
    chrome.tabGroups.query(QueryInWindow, (groups) => {
      const newCollapsedState = !Group.isCollapsedAll;
      
      groups.forEach(group => {
        chrome.tabGroups.update(group.id, { collapsed: newCollapsedState });
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
          // 关闭弹出窗口
          window.close();
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
  
  // 组更新事件
  private static onGroupUpdated(groupId: number, changeInfo: any): void {
    if (Group.delayRefresh) {
      Group.delayRefresh();
    }
  }
  
  // 标签页更新事件
  private static onTabUpdated(tabId: number, changeInfo: chrome.tabs.TabChangeInfo): void {
    if (changeInfo.title || changeInfo.url || changeInfo.groupId !== undefined || changeInfo.active) {
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
  
  // 标签页移动事件
  private static onTabMoved(tabId: number): void {
    if (Group.delayRefresh) {
      Group.delayRefresh();
    }
  }
}

// 已保存标签组管理类
class SavedGroup {
  private static container: HTMLElement | null = null;
  private static searchInput: HTMLInputElement | null = null;
  private static searchButton: HTMLElement | null = null;
  private static deleteAllButton: HTMLElement | null = null;
  private static importButton: HTMLElement | null = null;
  private static importInput: HTMLInputElement | null = null;
  private static exportButton: HTMLElement | null = null;
  private static exportHtmlButton: HTMLElement | null = null;
  private static exportJsonButton: HTMLElement | null = null;
  private static sortButton: HTMLElement | null = null;
  private static mergeAllButton: HTMLElement | null = null;
  private static currentSort: string = 'timeDesc';
  private static selectedItems: Set<string> = new Set();
  
  // 初始化
  static init(): void {
    SavedGroup.container = document.getElementById('saved-tab-list');
    SavedGroup.searchInput = document.getElementById('search-input') as HTMLInputElement;
    SavedGroup.searchButton = document.getElementById('search-button');
    SavedGroup.deleteAllButton = document.getElementById('delete-all-button');
    SavedGroup.importButton = document.getElementById('import-button');
    SavedGroup.importInput = document.getElementById('import-input') as HTMLInputElement;
    SavedGroup.exportButton = document.getElementById('export-button');
    SavedGroup.exportHtmlButton = document.getElementById('export-html-button');
    SavedGroup.exportJsonButton = document.getElementById('export-json-button');
    SavedGroup.sortButton = document.getElementById('sort-button');
    SavedGroup.mergeAllButton = document.getElementById('merge-all-button');
    
    // 添加事件监听
    if (SavedGroup.searchButton) {
      SavedGroup.searchButton.addEventListener('click', SavedGroup.onSearch);
    }
    
    if (SavedGroup.searchInput) {
      SavedGroup.searchInput.addEventListener('input', debounce(SavedGroup.onSearch, 500));
      SavedGroup.searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          SavedGroup.onSearch();
        }
      });
    }
    
    if (SavedGroup.deleteAllButton) {
      SavedGroup.deleteAllButton.addEventListener('click', SavedGroup.onDeleteAll);
    }
    
    if (SavedGroup.importButton) {
      SavedGroup.importButton.addEventListener('click', () => {
        SavedGroup.importInput?.click();
      });
    }
    
    if (SavedGroup.importInput) {
      SavedGroup.importInput.addEventListener('change', SavedGroup.onImport);
    }
    
    if (SavedGroup.exportButton) {
      SavedGroup.exportButton.addEventListener('click', () => {
        SavedGroup.exportJson();
      });
    }
    
    if (SavedGroup.exportHtmlButton) {
      SavedGroup.exportHtmlButton.addEventListener('click', () => {
        SavedGroup.exportHtml();
      });
    }
    
    if (SavedGroup.exportJsonButton) {
      SavedGroup.exportJsonButton.addEventListener('click', () => {
        SavedGroup.exportJson();
      });
    }
    
    if (SavedGroup.sortButton) {
      SavedGroup.sortButton.addEventListener('click', SavedGroup.toggleSort);
    }
    
    if (SavedGroup.mergeAllButton) {
      SavedGroup.mergeAllButton.addEventListener('click', SavedGroup.onMergeAll);
    }
    
    // 设置已保存标签组
    SavedGroup.setupSavedGroups();
  }
  
  // 设置已保存标签组
  static async setupSavedGroups(): Promise<void> {
    if (!SavedGroup.container) return;
    
    try {
      const items = await GroupStore.getAll(SavedGroup.currentSort);
      const elements: HTMLElement[] = [];
      
      for (const item of items) {
        if (item.type === 'group') {
          elements.push(SavedGroup.createSavedGroup(item));
        } else if (item.type === 'tab') {
          elements.push(SavedGroup.createSavedTab(item));
        }
      }
      
      // 添加到容器
      SavedGroup.container.replaceChildren(...elements);
      
      // 更新排序按钮文本
      if (SavedGroup.sortButton) {
        switch (SavedGroup.currentSort) {
          case 'nameAsc':
            SavedGroup.sortButton.textContent = SortByNameAsc;
            break;
          case 'nameDesc':
            SavedGroup.sortButton.textContent = SortByNameDesc;
            break;
          case 'timeAsc':
            SavedGroup.sortButton.textContent = SortByTimeAsc;
            break;
          case 'timeDesc':
          default:
            SavedGroup.sortButton.textContent = SortByTimeDesc;
            break;
        }
      }
    } catch (error) {
      console.error('Failed to load saved groups:', error);
    }
  }
  
  // 创建已保存标签组元素
  private static createSavedGroup(group: any): HTMLElement {
    const groupElement = document.createElement('div');
    groupElement.className = 'group-item p-2 border-bottom';
    groupElement.dataset.groupId = group.id;
    
    // 复选框
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'group-checkbox me-2';
    checkbox.addEventListener('change', (e) => {
      if (checkbox.checked) {
        SavedGroup.selectedItems.add(group.id);
      } else {
        SavedGroup.selectedItems.delete(group.id);
      }
      SavedGroup.updateActionButtonsVisibility();
    });
    
    const groupHeader = document.createElement('div');
    groupHeader.className = 'group-header d-flex align-items-center';
    groupHeader.appendChild(checkbox);
    
    // 颜色标识
    groupHeader.appendChild(createColorSpan(group.color));
    
    // 组标题
    const titleContainer = document.createElement('div');
    titleContainer.className = 'flex-grow-1';
    
    const titleElement = document.createElement('span');
    titleElement.className = 'group-title';
    titleElement.textContent = group.title || NoName;
    
    const timeElement = document.createElement('span');
    timeElement.className = 'group-time text-xs text-muted';
    timeElement.textContent = new Date(group.createTime).toLocaleString();
    
    titleContainer.appendChild(titleElement);
    titleContainer.appendChild(document.createElement('br'));
    titleContainer.appendChild(timeElement);
    
    groupHeader.appendChild(titleContainer);
    
    // 操作按钮容器
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'd-flex';
    
    // 展开/折叠按钮
    const toggleButton = document.createElement('button');
    toggleButton.className = 'btn btn-sm';
    toggleButton.innerHTML = Expanded;
    toggleButton.addEventListener('click', (e) => {
      e.stopPropagation();
      const contentElement = groupElement.querySelector('.group-content') as HTMLElement;
      if (contentElement) {
        const isVisible = contentElement.style.display !== 'none';
        contentElement.style.display = isVisible ? 'none' : 'block';
        toggleButton.innerHTML = isVisible ? Expanded : Collapsed;
      }
    });
    actionsContainer.appendChild(toggleButton);
    
    // 重命名按钮
    const renameButton = document.createElement('button');
    renameButton.className = 'btn btn-sm ms-1';
    renameButton.innerHTML = Rename;
    renameButton.addEventListener('click', async (e) => {
      e.stopPropagation();
      const newName = prompt(Rename, group.title || NoName);
      if (newName !== null && newName !== group.title) {
        const success = await GroupStore.updateGroupName(group.id, newName);
        if (success) {
          showSuccessTip(Updated);
          SavedGroup.setupSavedGroups();
        }
      }
    });
    actionsContainer.appendChild(renameButton);
    
    // 打开所有按钮
    const openAllButton = document.createElement('button');
    openAllButton.className = 'btn btn-sm ms-1';
    openAllButton.innerHTML = OpenAll;
    openAllButton.addEventListener('click', (e) => {
      e.stopPropagation();
      SavedGroup.openGroup(group);
    });
    actionsContainer.appendChild(openAllButton);
    
    // 删除按钮
    const deleteButton = document.createElement('button');
    deleteButton.className = 'btn btn-sm ms-1';
    deleteButton.innerHTML = Delete;
    deleteButton.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm(`Are you sure you want to delete "${group.title || NoName}"?`)) {
        await GroupStore.delete(group.id);
        showSuccessTip(Deleted);
        SavedGroup.setupSavedGroups();
      }
    });
    actionsContainer.appendChild(deleteButton);
    
    groupHeader.appendChild(actionsContainer);
    groupElement.appendChild(groupHeader);
    
    // 标签页内容
    const contentElement = document.createElement('div');
    contentElement.className = 'group-content ms-4';
    contentElement.style.display = 'none';
    
    if (group.tabs && group.tabs.length > 0) {
      for (let i = 0; i < group.tabs.length; i++) {
        const tab = group.tabs[i];
        contentElement.appendChild(SavedGroup.createSavedGroupTab(tab, group.id, i));
      }
    }
    
    groupElement.appendChild(contentElement);
    
    // 点击标签组展开/折叠
    groupElement.addEventListener('click', (e) => {
      // 如果点击的是按钮或复选框，不触发展开/折叠
      if ((e.target as HTMLElement).tagName.toLowerCase() === 'button' ||
          (e.target as HTMLElement).tagName.toLowerCase() === 'input') {
        return;
      }
      
      const contentElement = groupElement.querySelector('.group-content') as HTMLElement;
      if (contentElement) {
        const isVisible = contentElement.style.display !== 'none';
        contentElement.style.display = isVisible ? 'none' : 'block';
        toggleButton.innerHTML = isVisible ? Expanded : Collapsed;
      }
    });
    
    return groupElement;
  }
  
  // 创建已保存标签组中的标签页元素
  private static createSavedGroupTab(tab: any, groupId: string, tabIndex: number): HTMLElement {
    const tabElement = document.createElement('div');
    tabElement.className = 'tab-item p-1 border-bottom';
    
    const tabContent = document.createElement('div');
    tabContent.className = 'd-flex align-items-center';
    
    // 图标
    const favicon = createFavicon(tab.url);
    favicon.title = tab.title || '';
    tabContent.appendChild(favicon);
    
    // 标题
    const titleElement = document.createElement('span');
    titleElement.className = 'tab-title flex-grow-1 text-truncate';
    titleElement.textContent = tab.title || 'Untitled';
    titleElement.title = tab.title || '';
    tabContent.appendChild(titleElement);
    
    // 删除按钮
    const deleteButton = document.createElement('button');
    deleteButton.className = 'btn btn-sm';
    deleteButton.innerHTML = Delete;
    deleteButton.addEventListener('click', async (e) => {
      e.stopPropagation();
      const success = await GroupStore.deleteTabInGroup(groupId, tabIndex, tab.url);
      if (success) {
        showSuccessTip(Deleted);
        SavedGroup.setupSavedGroups();
      }
    });
    tabContent.appendChild(deleteButton);
    
    // 点击标签页打开它
    tabElement.addEventListener('click', (e) => {
      // 如果点击的是按钮，不触发标签页切换
      if ((e.target as HTMLElement).tagName.toLowerCase() === 'button') {
        return;
      }
      
      if (tab.url) {
        chrome.tabs.create({ url: tab.url });
      }
    });
    
    tabElement.appendChild(tabContent);
    
    return tabElement;
  }
  
  // 创建已保存的单个标签页元素
  private static createSavedTab(tab: any): HTMLElement {
    const tabElement = document.createElement('div');
    tabElement.className = 'tab-item p-2 border-bottom';
    tabElement.dataset.tabId = tab.id;
    
    // 复选框
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'tab-checkbox me-2';
    checkbox.addEventListener('change', (e) => {
      if (checkbox.checked) {
        SavedGroup.selectedItems.add(tab.id);
      } else {
        SavedGroup.selectedItems.delete(tab.id);
      }
      SavedGroup.updateActionButtonsVisibility();
    });
    
    const tabContent = document.createElement('div');
    tabContent.className = 'd-flex align-items-center';
    tabContent.appendChild(checkbox);
    
    // 图标
    const favicon = createFavicon(tab.url);
    favicon.title = tab.title || '';
    tabContent.appendChild(favicon);
    
    // 标题和时间
    const titleContainer = document.createElement('div');
    titleContainer.className = 'flex-grow-1';
    
    const titleElement = document.createElement('span');
    titleElement.className = 'tab-title';
    titleElement.textContent = tab.title || 'Untitled';
    
    const timeElement = document.createElement('span');
    timeElement.className = 'tab-time text-xs text-muted';
    timeElement.textContent = new Date(tab.createTime).toLocaleString();
    
    titleContainer.appendChild(titleElement);
    titleContainer.appendChild(document.createElement('br'));
    titleContainer.appendChild(timeElement);
    
    tabContent.appendChild(titleContainer);
    
    // 操作按钮容器
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'd-flex';
    
    // 打开按钮
    const openButton = document.createElement('button');
    openButton.className = 'btn btn-sm';
    openButton.innerHTML = OpenAll;
    openButton.addEventListener('click', (e) => {
      e.stopPropagation();
      if (tab.url) {
        chrome.tabs.create({ url: tab.url });
      }
    });
    actionsContainer.appendChild(openButton);
    
    // 删除按钮
    const deleteButton = document.createElement('button');
    deleteButton.className = 'btn btn-sm ms-1';
    deleteButton.innerHTML = Delete;
    deleteButton.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm(`Are you sure you want to delete "${tab.title || 'Untitled'}"?`)) {
        await GroupStore.delete(tab.id);
        showSuccessTip(Deleted);
        SavedGroup.setupSavedGroups();
      }
    });
    actionsContainer.appendChild(deleteButton);
    
    tabContent.appendChild(actionsContainer);
    tabElement.appendChild(tabContent);
    
    // 点击标签页打开它
    tabElement.addEventListener('click', (e) => {
      // 如果点击的是按钮或复选框，不触发标签页切换
      if ((e.target as HTMLElement).tagName.toLowerCase() === 'button' ||
          (e.target as HTMLElement).tagName.toLowerCase() === 'input') {
        return;
      }
      
      if (tab.url) {
        chrome.tabs.create({ url: tab.url });
      }
    });
    
    return tabElement;
  }
  
  // 打开标签组
  private static openGroup(group: any): void {
    if (group.tabs && group.tabs.length > 0) {
      const urls = group.tabs.map((tab: any) => tab.url).filter((url: string) => url);
      
      // 打开第一个标签页在当前窗口
      if (urls.length > 0) {
        chrome.tabs.create({ url: urls[0] });
        
        // 其余的标签页在新窗口打开
        for (let i = 1; i < urls.length; i++) {
          chrome.tabs.create({ url: urls[i], active: false });
        }
        
        // 关闭弹出窗口
        window.close();
      }
    }
  }
  
  // 搜索功能
  private static onSearch(): void {
    if (!SavedGroup.container || !SavedGroup.searchInput) return;
    
    const searchTerm = SavedGroup.searchInput.value.toLowerCase();
    const items = SavedGroup.container.querySelectorAll('.group-item, .tab-item');
    
    items.forEach(item => {
      const titleElement = item.querySelector('.group-title, .tab-title');
      const title = titleElement ? titleElement.textContent?.toLowerCase() : '';
      
      if (searchTerm === '' || title.includes(searchTerm)) {
        item.style.display = 'block';
      } else {
        item.style.display = 'none';
      }
    });
  }
  
  // 删除所有
  private static async onDeleteAll(): void {
    if (confirm('Are you sure you want to delete all saved tabs and groups?')) {
      await GroupStore.deleteAll();
      showSuccessTip(Deleted);
      SavedGroup.setupSavedGroups();
    }
  }
  
  // 导入功能
  private static async onImport(event: Event): Promise<void> {
    const target = event.target as HTMLInputElement;
    if (!target.files || target.files.length === 0) return;
    
    const file = target.files[0];
    try {
      await GroupStore.importJson(file);
      showSuccessTip('Imported successfully');
      SavedGroup.setupSavedGroups();
      // 清空文件输入
      target.value = '';
    } catch (error) {
      console.error('Import failed:', error);
      alert('Import failed. Please check the file format.');
    }
  }
  
  // 导出为HTML
  private static exportHtml(): void {
    GroupStore.exportHtml();
  }
  
  // 导出为JSON
  private static exportJson(): void {
    GroupStore.exportJson();
  }
  
  // 切换排序方式
  private static toggleSort(): void {
    const sortOptions = ['timeDesc', 'timeAsc', 'nameAsc', 'nameDesc'];
    const currentIndex = sortOptions.indexOf(SavedGroup.currentSort);
    const nextIndex = (currentIndex + 1) % sortOptions.length;
    SavedGroup.currentSort = sortOptions[nextIndex];
    SavedGroup.setupSavedGroups();
  }
  
  // 合并所有同名组
  private static async onMergeAll(): Promise<void> {
    if (confirm('Are you sure you want to merge all groups with the same name?')) {
      const success = await GroupStore.mergeAllGroups();
      if (success) {
        showSuccessTip('Merged successfully');
        SavedGroup.setupSavedGroups();
      } else {
        showSuccessTip('No groups to merge');
      }
    }
  }
  
  // 更新操作按钮可见性
  private static updateActionButtonsVisibility(): void {
    // 这个功能可以在需要时实现
  }
}

// 规则管理类
class RuleList {
  private static container: HTMLElement | null = null;
  private static addButton: HTMLElement | null = null;
  private static importButton: HTMLElement | null = null;
  private static exportButton: HTMLElement | null = null;
  private static importInput: HTMLInputElement | null = null;
  
  // 初始化
  static init(): void {
    RuleList.container = document.getElementById('rules-list');
    RuleList.addButton = document.getElementById('add-rule-button');
    RuleList.importButton = document.getElementById('import-rule-button');
    RuleList.exportButton = document.getElementById('export-rule-button');
    RuleList.importInput = document.getElementById('rule-import-input') as HTMLInputElement;
    
    if (RuleList.addButton) {
      RuleList.addButton.addEventListener('click', RuleList.onAddRule);
    }
    
    if (RuleList.importButton) {
      RuleList.importButton.addEventListener('click', () => {
        RuleList.importInput?.click();
      });
    }
    
    if (RuleList.exportButton) {
      RuleList.exportButton.addEventListener('click', RuleList.onExportRules);
    }
    
    if (RuleList.importInput) {
      RuleList.importInput.addEventListener('change', RuleList.onImportRules);
    }
    
    RuleList.setupRules();
  }
  
  // 设置规则列表
  static async setupRules(): Promise<void> {
    if (!RuleList.container) return;
    
    try {
      const rules = await RuleStore.getAllRules('active');
      const elements: HTMLElement[] = [];
      
      for (const rule of rules) {
        elements.push(RuleList.createRuleElement(rule));
      }
      
      RuleList.container.replaceChildren(...elements);
    } catch (error) {
      console.error('Failed to load rules:', error);
    }
  }
  
  // 创建规则元素
  private static createRuleElement(rule: any): HTMLElement {
    const ruleElement = document.createElement('div');
    ruleElement.className = 'rule-item p-2 border-bottom';
    ruleElement.dataset.ruleId = rule.id;
    
    // 启用/禁用开关
    const toggleSwitch = document.createElement('label');
    toggleSwitch.className = 'switch mr-2';
    const toggleInput = document.createElement('input');
    toggleInput.type = 'checkbox';
    toggleInput.checked = rule.active !== false;
    toggleInput.addEventListener('change', async () => {
      await RuleStore.toggleRuleStatus(rule.id);
      RuleList.setupRules();
    });
    const toggleSpan = document.createElement('span');
    toggleSpan.className = 'slider round';
    toggleSwitch.appendChild(toggleInput);
    toggleSwitch.appendChild(toggleSpan);
    
    const ruleContent = document.createElement('div');
    ruleContent.className = 'd-flex align-items-center';
    ruleContent.appendChild(toggleSwitch);
    
    // 规则信息
    const infoContainer = document.createElement('div');
    infoContainer.className = 'flex-grow-1';
    
    const nameElement = document.createElement('div');
    nameElement.className = 'rule-name font-weight-bold';
    nameElement.textContent = rule.ruleName || 'Unnamed Rule';
    
    const patternElement = document.createElement('div');
    patternElement.className = 'rule-pattern text-sm text-muted';
    patternElement.textContent = `Pattern: ${rule.pattern}`;
    
    const colorElement = document.createElement('div');
    colorElement.className = 'rule-color text-sm text-muted';
    colorElement.textContent = `Color: ${rule.color || 'default'}`;
    
    infoContainer.appendChild(nameElement);
    infoContainer.appendChild(patternElement);
    infoContainer.appendChild(colorElement);
    
    ruleContent.appendChild(infoContainer);
    
    // 操作按钮
    const actionsContainer = document.createElement('div');
    actionsContainer.className = 'd-flex';
    
    // 编辑按钮
    const editButton = document.createElement('button');
    editButton.className = 'btn btn-sm';
    editButton.innerHTML = Edit;
    editButton.addEventListener('click', () => {
      RuleList.editRule(rule);
    });
    actionsContainer.appendChild(editButton);
    
    // 删除按钮
    const deleteButton = document.createElement('button');
    deleteButton.className = 'btn btn-sm ms-1';
    deleteButton.innerHTML = Delete;
    deleteButton.addEventListener('click', async () => {
      if (confirm(`Are you sure you want to delete rule "${rule.ruleName || 'Unnamed Rule'}"?`)) {
        await RuleStore.deleteRule(rule.id);
        showSuccessTip(Deleted);
        RuleList.setupRules();
      }
    });
    actionsContainer.appendChild(deleteButton);
    
    ruleContent.appendChild(actionsContainer);
    ruleElement.appendChild(ruleContent);
    
    return ruleElement;
  }
  
  // 添加规则
  private static async onAddRule(): Promise<void> {
    const ruleName = prompt('Enter rule name:', 'New Rule');
    if (!ruleName) return;
    
    const pattern = prompt('Enter URL pattern (supports regular expressions):', '');
    if (!pattern) return;
    
    const colorOptions = ['blue', 'red', 'yellow', 'green', 'purple', 'cyan', 'pink', 'orange', 'grey'];
    const colorPrompt = `Select color:\n${colorOptions.map((color, index) => `${index + 1}. ${color}`).join('\n')}`;
    const colorIndex = parseInt(prompt(colorPrompt, '1') || '1') - 1;
    const color = colorIndex >= 0 && colorIndex < colorOptions.length ? colorOptions[colorIndex] : colorOptions[0];
    
    try {
      const newRule = {
        ruleName,
        pattern,
        color,
        active: true,
        createTime: Date.now(),
        updateTime: Date.now()
      };
      
      await RuleStore.createRule(newRule);
      showSuccessTip('Rule created');
      RuleList.setupRules();
    } catch (error) {
      console.error('Failed to create rule:', error);
      alert('Failed to create rule. Please check your inputs.');
    }
  }
  
  // 编辑规则
  private static async editRule(rule: any): Promise<void> {
    const ruleName = prompt('Enter rule name:', rule.ruleName || 'Unnamed Rule');
    if (ruleName === null) return; // 用户取消
    
    const pattern = prompt('Enter URL pattern:', rule.pattern);
    if (pattern === null) return; // 用户取消
    
    const colorOptions = ['blue', 'red', 'yellow', 'green', 'purple', 'cyan', 'pink', 'orange', 'grey'];
    const colorPrompt = `Select color:\n${colorOptions.map((color, index) => `${index + 1}. ${color}`).join('\n')}`;
    const currentColorIndex = colorOptions.indexOf(rule.color || colorOptions[0]);
    const colorIndex = parseInt(prompt(colorPrompt, (currentColorIndex + 1).toString()) || '1') - 1;
    const color = colorIndex >= 0 && colorIndex < colorOptions.length ? colorOptions[colorIndex] : colorOptions[0];
    
    try {
      const updates = {
        ruleName,
        pattern,
        color,
        updateTime: Date.now()
      };
      
      await RuleStore.updateRule(rule.id, updates);
      showSuccessTip(Updated);
      RuleList.setupRules();
    } catch (error) {
      console.error('Failed to update rule:', error);
      alert('Failed to update rule. Please check your inputs.');
    }
  }
  
  // 导入规则
  private static async onImportRules(event: Event): Promise<void> {
    const target = event.target as HTMLInputElement;
    if (!target.files || target.files.length === 0) return;
    
    const file = target.files[0];
    try {
      await RuleStore.importRules(file);
      showSuccessTip('Rules imported successfully');
      RuleList.setupRules();
      // 清空文件输入
      target.value = '';
    } catch (error) {
      console.error('Failed to import rules:', error);
      alert('Failed to import rules. Please check the file format.');
    }
  }
  
  // 导出规则
  private static async onExportRules(): Promise<void> {
    await RuleStore.exportRules();
  }
}

// 快捷键管理类
class Shortcut {
  private static container: HTMLElement | null = null;
  
  // 初始化
  static init(): void {
    Shortcut.container = document.getElementById('shortcuts-list');
    
    // 设置快捷键列表
    Shortcut.setupShortcuts();
  }
  
  // 设置快捷键列表
  static setupShortcuts(): void {
    if (!Shortcut.container) return;
    
    // 获取manifest.json中的commands
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '../manifest.json', true);
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4 && xhr.status === 200) {
        try {
          const manifest = JSON.parse(xhr.responseText);
          const commands = manifest.commands || {};
          
          const elements: HTMLElement[] = [];
          
          // 将commands转换为数组并排序
          const commandList = Object.entries(commands)
            .filter(([key]) => !key.startsWith('_')) // 过滤掉Chrome内置命令
            .map(([key, command]: [string, any]) => ({
              name: key,
              description: command.description || key,
              shortcut: command.shortcut || ''
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
          
          for (const command of commandList) {
            elements.push(Shortcut.createShortcutElement(command));
          }
          
          Shortcut.container!.replaceChildren(...elements);
        } catch (error) {
          console.error('Failed to parse manifest.json:', error);
        }
      }
    };
    xhr.send();
  }
  
  // 创建快捷键元素
  private static createShortcutElement(command: { name: string; description: string; shortcut: string }): HTMLElement {
    const shortcutElement = document.createElement('div');
    shortcutElement.className = 'shortcut-item p-2 border-bottom';
    
    const nameElement = document.createElement('div');
    nameElement.className = 'shortcut-name font-weight-bold';
    nameElement.textContent = command.name;
    
    const descriptionElement = document.createElement('div');
    descriptionElement.className = 'shortcut-description text-sm text-muted';
    descriptionElement.textContent = command.description;
    
    const shortcutKeyElement = document.createElement('div');
    shortcutKeyElement.className = 'shortcut-key text-sm';
    shortcutKeyElement.textContent = command.shortcut || 'No shortcut';
    
    shortcutElement.appendChild(nameElement);
    shortcutElement.appendChild(descriptionElement);
    shortcutElement.appendChild(shortcutKeyElement);
    
    return shortcutElement;
  }
}

// 初始化插件
function initPopup(): void {
  // 等待DOM加载完成
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      // 初始化标签页切换
      initTabs();
      
      // 初始化各个功能模块
      Group.init();
      SavedGroup.init();
      
      // 初始化规则和快捷键模块（如果存在）
      if (document.getElementById('rules-tab')) {
        RuleList.init();
      }
      
      if (document.getElementById('shortcuts-tab')) {
        Shortcut.init();
      }
      
      // 导出全局变量，以便在其他地方访问
      (window as any).Group = Group;
      (window as any).SavedGroup = SavedGroup;
      (window as any).RuleList = RuleList;
      (window as any).Shortcut = Shortcut;
    });
  } else {
    // 初始化标签页切换
    initTabs();
    
    // 初始化各个功能模块
    Group.init();
    SavedGroup.init();
    
    // 初始化规则和快捷键模块（如果存在）
    if (document.getElementById('rules-tab')) {
      RuleList.init();
    }
    
    if (document.getElementById('shortcuts-tab')) {
      Shortcut.init();
    }
    
    // 导出全局变量，以便在其他地方访问
    (window as any).Group = Group;
    (window as any).SavedGroup = SavedGroup;
    (window as any).RuleList = RuleList;
    (window as any).Shortcut = Shortcut;
  }
}

// 初始化标签页切换
function initTabs(): void {
  // 获取所有标签页和内容区域
  const tabElements = document.querySelectorAll('.tab-button');
  const contentElements = document.querySelectorAll('.tab-content');
  
  if (tabElements.length === 0 || contentElements.length === 0) {
    return;
  }
  
  // 为每个标签页添加点击事件
  tabElements.forEach((tab, index) => {
    tab.addEventListener('click', () => {
      // 移除所有标签页和内容区域的活动状态
      tabElements.forEach(t => t.classList.remove('active'));
      contentElements.forEach(c => c.classList.remove('active'));
      
      // 添加当前标签页和内容区域的活动状态
      tab.classList.add('active');
      if (contentElements[index]) {
        contentElements[index].classList.add('active');
      }
      
      // 根据标签页ID执行特定操作
      const tabId = tab.id;
      switch (tabId) {
        case 'current-tab':
          if (window['Group']) {
            window['Group'].setupCurrentTabs();
          }
          break;
        case 'saved-tab':
          if (window['SavedGroup']) {
            window['SavedGroup'].setupSavedGroups();
          }
          break;
        case 'rules-tab':
          if (window['RuleList']) {
            window['RuleList'].setupRules();
          }
          break;
        case 'shortcuts-tab':
          if (window['Shortcut']) {
            window['Shortcut'].setupShortcuts();
          }
          break;
      }
    });
  });
  
  // 默认激活第一个标签页
  if (tabElements.length > 0) {
    (tabElements[0] as HTMLElement).click();
  }
}

// 启动插件
initPopup();