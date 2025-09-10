import { Rule, RuleOptions } from './types';

export class RuleStore {
  // 创建新规则
  static async createRule(name: string, pattern: string, color: chrome.tabGroups.ColorEnum): Promise<Rule> {
    return new Promise((resolve) => {
      const now = Date.now();
      const ruleId = `rule-${now.toString(36)}`;
      
      const rule: Rule = {
        id: ruleId,
        groupName: name,
        pattern,
        groupColor: color,
        enabled: true,
        createTime: now,
        updateTime: now
      };
      
      const ruleData: Record<string, Rule> = {};
      ruleData[ruleId] = rule;
      
      chrome.storage.local.set(ruleData, () => {
        resolve(rule);
      });
    });
  }
  
  // 更新规则
  static async updateRule(ruleId: string, updates: Partial<Rule>): Promise<Rule | null> {
    return new Promise((resolve) => {
      chrome.storage.local.get(ruleId, (result) => {
        const rule = result[ruleId] as Rule;
        if (rule) {
          const updatedRule: Rule = {
            ...rule,
            ...updates,
            updateTime: Date.now()
          };
          
          const ruleData: Record<string, Rule> = {};
          ruleData[ruleId] = updatedRule;
          
          chrome.storage.local.set(ruleData, () => {
            resolve(updatedRule);
          });
        } else {
          resolve(null);
        }
      });
    });
  }
  
  // 删除规则
  static async deleteRule(ruleId: string): Promise<boolean> {
    return new Promise((resolve) => {
      chrome.storage.local.get(ruleId, (result) => {
        if (result[ruleId]) {
          chrome.storage.local.remove(ruleId, () => {
            resolve(true);
          });
        } else {
          resolve(false);
        }
      });
    });
  }
  
  // 获取所有规则
  static async getRules(sortBy?: string): Promise<Rule[]> {
    return new Promise((resolve) => {
      chrome.storage.local.get(null, (items) => {
        const rules: Rule[] = [];
        for (const item of Object.values(items)) {
          // 检查对象是否包含Rule接口的关键属性
          if (item && typeof item === 'object' && 'id' in item && 'pattern' in item && 'color' in item) {
            rules.push(item as Rule);
          }
        }
        
        // 根据排序方式排序
        if (sortBy === 'nameAsc') {
          const collator = new Intl.Collator();
          rules.sort((a, b) => collator.compare(a.groupName || '', b.groupName || ''));
        } else if (sortBy === 'nameDesc') {
          const collator = new Intl.Collator();
          rules.sort((a, b) => collator.compare(b.groupName || '', a.groupName || ''));
        } else if (sortBy === 'timeAsc') {
          rules.sort((a, b) => (a.createTime || 0) - (b.createTime || 0));
        } else if (sortBy === 'enabled') {
          // 先按激活状态排序，再按名称排序
          rules.sort((a, b) => {
            if (a.enabled && !b.enabled) return -1;
            if (!a.enabled && b.enabled) return 1;
            return (a.groupName || '').localeCompare(b.groupName || '');
          });
        } else {
          // 默认按时间降序排序
          rules.sort((a, b) => (b.updateTime || 0) - (a.updateTime || 0));
        }
        
        resolve(rules);
      });
    });
  }
  
  // 获取激活的规则
  static async getActiveRules(): Promise<Rule[]> {
    const allRules = await RuleStore.getRules();
    return allRules.filter(rule => rule.enabled !== false);
  }
  
  // 切换规则激活状态
  static async toggleRuleStatus(ruleId: string): Promise<boolean> {
    return new Promise((resolve) => {
      chrome.storage.local.get(ruleId, (result) => {
        const rule = result[ruleId] as Rule;
        if (rule) {
          const updatedRule = {
            ...rule,
            enabled: !rule.enabled,
            updateTime: Date.now()
          };
          
          const ruleData: Record<string, Rule> = {};
          ruleData[ruleId] = updatedRule;
          
          chrome.storage.local.set(ruleData, () => {
            resolve(updatedRule.enabled);
          });
        } else {
          resolve(false);
        }
      });
    });
  }
  
  // 根据URL匹配规则
  static async matchRule(url: string): Promise<Rule | null> {
    const rules = await RuleStore.getActiveRules();
    
    for (const rule of rules) {
      // 安全检查：确保pattern不是undefined
      if (!rule.pattern) continue;
      
      try {
        const pattern = new RegExp(rule.pattern);
        if (pattern.test(url)) {
          return rule;
        } else if (url.includes(rule.pattern)) {
          // 如果正则匹配失败，尝试简单匹配
          return rule;
        }
      } catch (e) {
        // 正则表达式解析失败，尝试简单匹配
        if (url.includes(rule.pattern)) {
          return rule;
        }
        console.error('Invalid rule pattern:', rule.pattern, e);
      }
    }
    
    return null;
  }
  
  // 批量激活/禁用规则
  static async setRulesStatus(ids: string[], enabled: boolean): Promise<boolean> {
    const rules = await RuleStore.getRules();
    let changed = false;
    const promises: Promise<void>[] = [];
    
    // 更新规则状态
    for (const ruleId of ids) {
      const rule = rules.find(r => r.id === ruleId);
      if (rule && rule.enabled !== enabled) {
        rule.enabled = enabled;
        rule.updateTime = Date.now();
        
        const ruleData: Record<string, Rule> = {};
        ruleData[ruleId] = rule;
        
        promises.push(new Promise<void>((resolve) => {
          chrome.storage.local.set(ruleData, resolve);
        }));
        changed = true;
      }
    }
    
    if (!changed) {
      return false;
    }
    
    await Promise.all(promises);
    return true;
  }
  
  // 激活所有规则
  static async activateAllRules(): Promise<void> {
    const rules = await RuleStore.getRules();
    const promises: Promise<void>[] = [];
    
    rules.forEach(rule => {
      if (!rule.enabled) {
        rule.enabled = true;
        rule.updateTime = Date.now();
        
        const ruleData: Record<string, Rule> = {};
        ruleData[rule.id] = rule;
        
        promises.push(new Promise<void>((resolve) => {
          chrome.storage.local.set(ruleData, resolve);
        }));
      }
    });
    
    await Promise.all(promises);
  }
  
  // 禁用所有规则
  static async deactivateAllRules(): Promise<void> {
    const rules = await RuleStore.getRules();
    const promises: Promise<void>[] = [];
    
    rules.forEach(rule => {
      if (rule.enabled) {
        rule.enabled = false;
        rule.updateTime = Date.now();
        
        const ruleData: Record<string, Rule> = {};
        ruleData[rule.id] = rule;
        
        promises.push(new Promise<void>((resolve) => {
          chrome.storage.local.set(ruleData, resolve);
        }));
      }
    });
    
    await Promise.all(promises);
  }
  
  // 导入规则
  static async importRules(file: File): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const content = await file.text();
        const data = JSON.parse(content);
        
        // 验证数据格式
        if (!Array.isArray(data)) {
          throw new Error('Invalid rule data format');
        }
        
        // 获取现有规则
        const existingRules = await RuleStore.getRules();
        const ruleIds = new Set(existingRules.map(r => r.id));
        const promises: Promise<void>[] = [];
        
        // 处理导入的规则
        for (const importedRule of data) {
          if (importedRule.id && ruleIds.has(importedRule.id)) {
            // 更新现有规则
            const ruleData: Record<string, Rule> = {};
            ruleData[importedRule.id] = {
              ...importedRule,
              updateTime: Date.now()
            };
            
            promises.push(new Promise<void>((resolve) => {
              chrome.storage.local.set(ruleData, resolve);
            }));
          } else {
            // 添加新规则
            const now = Date.now();
            const ruleId = `rule-${now.toString(36)}`;
            const rule: Rule = {
              ...importedRule,
              id: ruleId,
              createTime: now,
              updateTime: now,
              active: importedRule.active !== false
            };
            
            const ruleData: Record<string, Rule> = {};
            ruleData[ruleId] = rule;
            
            promises.push(new Promise<void>((resolve) => {
              chrome.storage.local.set(ruleData, resolve);
            }));
          }
        }
        
        await Promise.all(promises);
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  }
  
  // 导出规则
  static async exportRules(): Promise<void> {
    try {
      const rules = await RuleStore.getRules();
      const ruleData = JSON.stringify(rules, null, 2);
      const blob = new Blob([ruleData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // 创建下载链接
      const a = document.createElement('a');
      a.href = url;
      a.download = `tab-group-rules-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      
      // 清理URL对象
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to export rules:', e);
    }
  }
  
  // 批量删除规则
  static async deleteRules(ids: string[]): Promise<boolean> {
    const rules = await RuleStore.getRules();
    const existingIds = new Set(rules.map(r => r.id));
    const validIds = ids.filter(id => existingIds.has(id));
    
    if (validIds.length === 0) {
      return false;
    }
    
    await new Promise<void>((resolve) => {
      chrome.storage.local.remove(validIds, resolve);
    });
    
    return true;
  }
  
  // 清空所有规则
  static async clearAllRules(): Promise<void> {
    const rules = await RuleStore.getRules();
    const ruleIds = rules.map(r => r.id);
    
    await new Promise<void>((resolve) => {
      chrome.storage.local.remove(ruleIds, resolve);
    });
  }
  
  // 复制规则
  static async duplicateRule(ruleId: string): Promise<Rule | null> {
    const rule = await new Promise<Rule | null>((resolve) => {
      chrome.storage.local.get(ruleId, (result) => {
        resolve(result[ruleId] as Rule || null);
      });
    });
    
    if (!rule) {
      return null;
    }
    
    // 创建规则副本
    const now = Date.now();
    const newRuleId = `rule-${now.toString(36)}`;
    const newRule: Rule = {
      ...rule,
      id: newRuleId,
      name: `${rule.name} (副本)`,
      createTime: now,
      updateTime: now
    };
    
    await new Promise<void>((resolve) => {
      const ruleData: Record<string, Rule> = {};
      ruleData[newRuleId] = newRule;
      chrome.storage.local.set(ruleData, resolve);
    });
    
    return newRule;
  }
  
  // 获取规则选项（注意：返回的不是完整的RuleOptions类型）
  static async getRuleOptions(): Promise<any> {
    return new Promise((resolve) => {
      chrome.storage.local.get('ruleOptions', (result) => {
        const defaultOptions = {
          enableAutoGrouping: true,
          autoGroupDelay: 1000,
          enableRuleNotifications: true,
          maxAutoGroups: 10
        };
        
        resolve({ ...defaultOptions, ...result.ruleOptions });
      });
    });
  }
  
  // 更新规则选项
  static async updateRuleOptions(options: Partial<RuleOptions>): Promise<void> {
    const currentOptions = await RuleStore.getRuleOptions();
    const updatedOptions = { ...currentOptions, ...options };
    
    await new Promise<void>((resolve) => {
      chrome.storage.local.set({ ruleOptions: updatedOptions }, resolve);
    });
  }
}