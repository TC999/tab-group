import { Rule } from './types';

export class RuleStore {
  // 创建新规则
  static async createRule(name: string, pattern: string, color: chrome.tabGroups.ColorEnum): Promise<Rule> {
    return new Promise((resolve) => {
      const now = Date.now();
      const ruleId = `rule-${now.toString(36)}`;
      
      const rule: Rule = {
        id: ruleId,
        name,
        pattern,
        color,
        active: true,
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
  static async getRules(): Promise<Rule[]> {
    return new Promise((resolve) => {
      chrome.storage.local.get(null, (items) => {
        const rules: Rule[] = [];
        for (const item of Object.values(items)) {
          // 检查对象是否包含Rule接口的关键属性，而不是检查type
          if (item && typeof item === 'object' && 'id' in item && 'pattern' in item && 'color' in item) {
            rules.push(item as Rule);
          }
        }
        
        // 按更新时间排序
        rules.sort((a, b) => b.updateTime - a.updateTime);
        resolve(rules);
      });
    });
  }
  
  // 获取激活的规则
  static async getActiveRules(): Promise<Rule[]> {
    const allRules = await RuleStore.getRules();
    return allRules.filter(rule => rule.active !== false);
  }
  
  // 切换规则激活状态
  static async toggleRuleStatus(ruleId: string): Promise<boolean> {
    return new Promise((resolve) => {
      chrome.storage.local.get(ruleId, (result) => {
        const rule = result[ruleId] as Rule;
        if (rule) {
          const updatedRule = {
            ...rule,
            active: !rule.active,
            updateTime: Date.now()
          };
          
          const ruleData: Record<string, Rule> = {};
          ruleData[ruleId] = updatedRule;
          
          chrome.storage.local.set(ruleData, () => {
            resolve(updatedRule.active);
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
      try {
        const pattern = new RegExp(rule.pattern);
        if (pattern.test(url)) {
          return rule;
        }
      } catch (e) {
        console.error('Invalid rule pattern:', rule.pattern, e);
      }
    }
    
    return null;
  }
}