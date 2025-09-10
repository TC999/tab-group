import { RuleStore } from './rule-store';
import type { Rule } from './types';
import { ColorMap } from './types';

// 默认颜色
const DEFAULT_COLOR = '#888888';

// 显示成功提示
function showSuccessTip(message: string, isSuccess: boolean = true): void {
  const tipElement = document.getElementById('successTip');
  if (!tipElement) return;
  
  const tipContent = tipElement.querySelector('span');
  if (tipContent) {
    tipContent.textContent = message;
  }
  
  tipElement.style.display = 'block';
  
  if (isSuccess) {
    tipElement.classList.remove('bg-danger');
    tipElement.classList.add('bg-success');
  } else {
    tipElement.classList.remove('bg-success');
    tipElement.classList.add('bg-danger');
  }
  
  setTimeout(() => {
    tipElement.style.display = 'none';
  }, 3000);
}

// 创建规则项元素
function createRuleItem(rule: Rule): HTMLElement {
  const ruleItem = document.createElement('div');
  ruleItem.className = 'rule-item card p-3 mb-2';
  ruleItem.dataset.id = rule.id;
  
  const ruleHeader = document.createElement('div');
  ruleHeader.className = 'rule-header d-flex justify-content-between align-items-center';
  
  // 左侧内容
  const leftContent = document.createElement('div');
  leftContent.className = 'd-flex align-items-center';
  
  // 颜色标识
  const colorSpan = document.createElement('span');
  colorSpan.className = 'd-inline-block rounded-circle size-18 mr-2';
  colorSpan.style.backgroundColor = rule.groupColor && ColorMap[rule.groupColor as chrome.tabGroups.ColorEnum] ? ColorMap[rule.groupColor as chrome.tabGroups.ColorEnum] : DEFAULT_COLOR;
  leftContent.appendChild(colorSpan);
  
  // 规则信息
  const ruleInfo = document.createElement('div');
  
  const ruleName = document.createElement('div');
  ruleName.className = 'font-weight-bold';
  ruleName.textContent = rule.groupName;
  ruleInfo.appendChild(ruleName);
  
  const rulePattern = document.createElement('div');
  rulePattern.className = 'text-sm text-gray-600';
  rulePattern.textContent = rule.pattern || '';
  ruleInfo.appendChild(rulePattern);
  
  leftContent.appendChild(ruleInfo);
  ruleHeader.appendChild(leftContent);
  
  // 右侧操作
  const rightActions = document.createElement('div');
  rightActions.className = 'd-flex align-items-center';
  
  // 激活开关
  const toggleSwitch = document.createElement('label');
  toggleSwitch.className = 'switch mr-3';
  toggleSwitch.innerHTML = `
    <input type="checkbox" class="rule-toggle" ${rule.enabled ? 'checked' : ''}>
    <span class="slider round"></span>
  `;
  
  const toggleInput = toggleSwitch.querySelector('input') as HTMLInputElement;
  toggleInput.addEventListener('change', async (event) => {
    const isEnabled = (event.target as HTMLInputElement).checked;
    try {
        // 注意：toggleRuleStatus 方法可能不存在于静态方法中，直接使用 updateRule
        await RuleStore.updateRule(rule.id, {
          enabled: isEnabled
        });
      showSuccessTip('规则已更新');
    } catch (error) {
      console.error('Failed to update rule status:', error);
      showSuccessTip('更新规则状态失败', false);
      // 恢复原始状态
      (event.target as HTMLInputElement).checked = !isEnabled;
    }
  });
  
  rightActions.appendChild(toggleSwitch);
  
  // 编辑按钮
  const editButton = document.createElement('button');
  editButton.className = 'btn btn-sm btn-info mr-2';
  editButton.innerHTML = '编辑';
  editButton.addEventListener('click', () => {
    editRule(rule);
  });
  rightActions.appendChild(editButton);
  
  // 删除按钮
  const deleteButton = document.createElement('button');
  deleteButton.className = 'btn btn-sm btn-danger';
  deleteButton.innerHTML = '删除';
  deleteButton.addEventListener('click', async () => {
    if (confirm(`确定要删除规则 "${rule.groupName}" 吗？`)) {
      try {
        await RuleStore.deleteRule(rule.id);
        ruleItem.remove();
        showSuccessTip('规则已删除');
      } catch (error) {
        console.error('Failed to delete rule:', error);
        showSuccessTip('删除规则失败', false);
      }
    }
  });
  rightActions.appendChild(deleteButton);
  
  ruleHeader.appendChild(rightActions);
  ruleItem.appendChild(ruleHeader);
  
  return ruleItem;
}

// 加载所有规则
async function loadRules(): Promise<void> {
  const rulesContainer = document.getElementById('rules-container');
  if (!rulesContainer) return;
  
  try {
    const rules = await RuleStore.getRules();
  
  // 清空容器
  rulesContainer.innerHTML = '';
  
  // 添加规则项
  if (rules.length === 0) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'text-center text-gray-500 p-4';
    emptyMessage.textContent = '暂无规则，请添加新规则';
    rulesContainer.appendChild(emptyMessage);
      // 按创建时间排序
    rules.sort((a, b) => {
      const timeA = a.createTime || 0;
      const timeB = b.createTime || 0;
      return timeB - timeA;
    });
    
    } else {
      for (const rule of rules) {
        const ruleItem = createRuleItem(rule);
        rulesContainer.appendChild(ruleItem);
      }
    }
  } catch (error) {
    console.error('Failed to load rules:', error);
    const errorMessage = document.createElement('div');
    errorMessage.className = 'text-center text-danger p-4';
    errorMessage.textContent = '加载规则失败';
    rulesContainer.appendChild(errorMessage);
  }
}

// 添加新规则
async function addNewRule(): Promise<void> {
  const nameInput = document.getElementById('rule-name') as HTMLInputElement;
  const patternInput = document.getElementById('rule-pattern') as HTMLInputElement;
  const colorSelect = document.getElementById('rule-color') as HTMLSelectElement;
  
  if (!nameInput || !patternInput || !colorSelect) return;
  
  const name = nameInput.value.trim();
  const pattern = patternInput.value.trim();
  const color = colorSelect.value as chrome.tabGroups.ColorEnum;
  
  if (!name || !pattern) {
    alert('请输入规则名称和URL模式');
    return;
  }
  
  // 验证正则表达式
  try {
    new RegExp(pattern);
  } catch (e) {
    alert('无效的正则表达式');
    return;
  }
  
  // 创建规则
  try {
    await RuleStore.createRule(name, pattern, color);
  
  // 清空输入
  nameInput.value = '';
  patternInput.value = '';
  
    
    // 重新加载规则
    await loadRules();
    showSuccessTip('规则已添加');
  } catch (error) {
    console.error('Failed to create rule:', error);
    showSuccessTip('添加规则失败', false);
  }
}

// 编辑规则
function editRule(rule: Rule): void {
  const nameInput = document.getElementById('rule-name') as HTMLInputElement;
  const patternInput = document.getElementById('rule-pattern') as HTMLInputElement;
  const colorSelect = document.getElementById('rule-color') as HTMLSelectElement;
  const addButton = document.getElementById('btn-add-rule') as HTMLButtonElement;
  
  if (!nameInput || !patternInput || !colorSelect || !addButton) return;
  
  // 填充表单
  nameInput.value = rule.groupName;
  patternInput.value = rule.pattern || '';
  colorSelect.value = rule.groupColor;
  
  // 临时修改按钮文本和功能
  const originalText = addButton.innerHTML;
  const originalOnClick = addButton.onclick;
  
  addButton.innerHTML = '更新规则';
  addButton.onclick = async () => {
    const name = nameInput.value.trim();
    const pattern = patternInput.value.trim();
    const color = colorSelect.value as chrome.tabGroups.ColorEnum;
    
    if (!name || !pattern) {
      alert('请输入规则名称和URL模式');
      return;
    }
    
    // 验证正则表达式
    try {
      new RegExp(pattern);
    } catch (e) {
      alert('无效的正则表达式');
      return;
    }
    
    // 更新规则
      try {
        await RuleStore.updateRule(rule.id, {
          groupName: name,
          pattern,
          groupColor: color
        });
      
      // 恢复表单
      nameInput.value = '';
      patternInput.value = '';
      addButton.innerHTML = originalText;
      addButton.onclick = originalOnClick;
      
      // 重新加载规则
      await loadRules();
      showSuccessTip('规则已更新');
    } catch (error) {
      console.error('更新规则失败:', error);
      showSuccessTip(`更新规则失败: ${error instanceof Error ? error.message : '未知错误'}`, false);
    }
  };
  
  // 滚动到表单顶部
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 返回按钮事件
function setupBackButton(): void {
  const backButton = document.getElementById('btn-back');
  if (backButton) {
    backButton.addEventListener('click', () => {
      window.close();
    });
  }
}

// 初始化规则页面
async function initRulesPage(): Promise<void> {
  // 等待DOM加载完成
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
      await loadRules();
      setupEventListeners();
      setupBackButton();
    });
  } else {
    await loadRules();
    setupEventListeners();
    setupBackButton();
  }
}

// 设置事件监听
function setupEventListeners(): void {
  const addRuleButton = document.getElementById('btn-add-rule');
  if (addRuleButton) {
    addRuleButton.addEventListener('click', addNewRule);
  }
}

// 启动规则页面
initRulesPage();