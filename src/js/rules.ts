import { RuleStore } from './rule-store';
import type { Rule } from './types';

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

// 显示成功提示
function showSuccessTip(message?: string): void {
  const tipElement = document.getElementById('successTip');
  if (!tipElement) return;
  
  message = message || '操作成功';
  const tipContent = tipElement.firstElementChild;
  if (tipContent) {
    tipContent.textContent = message;
  }
  
  tipElement.style.display = 'block';
  setTimeout(() => {
    tipElement.style.display = 'none';
  }, 1000);
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
  colorSpan.style.backgroundColor = rule.color && ColorMap[rule.color] ? ColorMap[rule.color] : DEFAULT_COLOR;
  leftContent.appendChild(colorSpan);
  
  // 规则信息
  const ruleInfo = document.createElement('div');
  
  const ruleName = document.createElement('div');
  ruleName.className = 'font-weight-bold';
  ruleName.textContent = rule.name;
  ruleInfo.appendChild(ruleName);
  
  const rulePattern = document.createElement('div');
  rulePattern.className = 'text-sm text-gray-600';
  rulePattern.textContent = rule.pattern;
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
    <input type="checkbox" class="rule-toggle" ${rule.active ? 'checked' : ''}>
    <span class="slider round"></span>
  `;
  
  const toggleInput = toggleSwitch.querySelector('input') as HTMLInputElement;
  toggleInput.addEventListener('change', async (event) => {
    const isActive = (event.target as HTMLInputElement).checked;
    await RuleStore.updateRule(rule.id, { active: isActive });
    showSuccessTip('规则已更新');
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
    if (confirm(`确定要删除规则 "${rule.name}" 吗？`)) {
      await RuleStore.deleteRule(rule.id);
      ruleItem.remove();
      showSuccessTip('规则已删除');
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
  
  const rules = await RuleStore.getRules();
  
  // 清空容器
  rulesContainer.innerHTML = '';
  
  // 添加规则项
  if (rules.length === 0) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'text-center text-gray-500 p-4';
    emptyMessage.textContent = '暂无规则，请添加新规则';
    rulesContainer.appendChild(emptyMessage);
  } else {
    for (const rule of rules) {
      const ruleItem = createRuleItem(rule);
      rulesContainer.appendChild(ruleItem);
    }
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
  await RuleStore.createRule(name, pattern, color);
  
  // 清空输入
  nameInput.value = '';
  patternInput.value = '';
  
  // 重新加载规则
  await loadRules();
  showSuccessTip('规则已添加');
}

// 编辑规则
function editRule(rule: Rule): void {
  const nameInput = document.getElementById('rule-name') as HTMLInputElement;
  const patternInput = document.getElementById('rule-pattern') as HTMLInputElement;
  const colorSelect = document.getElementById('rule-color') as HTMLSelectElement;
  const addButton = document.getElementById('btn-add-rule') as HTMLButtonElement;
  
  if (!nameInput || !patternInput || !colorSelect || !addButton) return;
  
  // 填充表单
  nameInput.value = rule.name;
  patternInput.value = rule.pattern;
  colorSelect.value = rule.color;
  
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
    await RuleStore.updateRule(rule.id, { name, pattern, color });
    
    // 恢复表单
    nameInput.value = '';
    patternInput.value = '';
    addButton.innerHTML = originalText;
    addButton.onclick = originalOnClick;
    
    // 重新加载规则
    await loadRules();
    showSuccessTip('规则已更新');
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