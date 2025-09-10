// 导入功能实现
import { GroupStore } from './group-store';
import { RuleStore } from './rule-store';
import type { TabGroup } from './types';
import type { Rule } from './types';

document.addEventListener('DOMContentLoaded', () => {
    // 初始化存储实例
    const groupStore = new GroupStore();
    const ruleStore = new RuleStore();

    // 导入按钮点击事件
    const importBtn = document.getElementById('import-btn');
    const fileInput = document.getElementById('file-input');
    const statusMessage = document.getElementById('status-message');

    if (importBtn && fileInput) {
        importBtn.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', (event: Event) => {
            const target = event.target as HTMLInputElement;
            if (target.files && target.files.length > 0) {
                const file = target.files[0];
                importData(file);
            }
        });
    }

    // 返回按钮点击事件
    const backButton = document.getElementById('btn-back');
    if (backButton) {
        backButton.addEventListener('click', () => {
            if (window.opener) {
                window.opener.focus();
                window.close();
            } else {
                window.history.back();
            }
        });
    }

    // 导入数据
    async function importData(file: File) {
        try {
            showStatus('正在导入数据...', 'info');
            
            const content = await readFileContent(file);
            const data = JSON.parse(content);
            
            // 验证数据格式
            if (!validateImportData(data)) {
                showStatus('导入失败：无效的数据格式', 'error');
                return;
            }

            // 导入标签组
            if (data.groups && Array.isArray(data.groups)) {
                await importGroups(data.groups as TabGroup[]);
            }

            // 导入规则
            if (data.rules && Array.isArray(data.rules)) {
                await importRules(data.rules as Rule[]);
            }

            showStatus('数据导入成功！', 'success');
            
            // 3秒后关闭窗口
            setTimeout(() => {
                if (window.opener) {
                    window.opener.postMessage({ type: 'importComplete' }, '*');
                    window.close();
                }
            }, 2000);
        } catch (error) {
            console.error('导入失败:', error);
            showStatus(`导入失败：${error instanceof Error ? error.message : '未知错误'}`, 'error');
        }
    }

    // 读取文件内容
    function readFileContent(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                if (e.target?.result) {
                    resolve(e.target.result.toString());
                } else {
                    reject(new Error('无法读取文件内容'));
                }
            };
            reader.onerror = () => reject(new Error('文件读取错误'));
            reader.readAsText(file);
        });
    }

    // 验证导入数据格式
    function validateImportData(data: any): boolean {
        if (!data || typeof data !== 'object') {
            return false;
        }
        // 检查是否至少包含groups或rules
        return data.groups || data.rules;
    }

    // 导入标签组
    async function importGroups(groups: TabGroup[]): Promise<void> {
        try {
            // 先获取现有的标签组，避免覆盖
            const existingGroups = await groupStore.getAllGroups();
            const existingGroupIds = new Set(existingGroups.map(g => g.id));
            
            // 只导入新的标签组
            const groupsToImport = groups.filter(g => !existingGroupIds.has(g.id));
            
            for (const group of groupsToImport) {
                await groupStore.saveGroup(group);
            }
            
            console.log(`成功导入 ${groupsToImport.length} 个标签组`);
        } catch (error) {
            console.error('批量导入标签组失败:', error);
            throw error;
        }
    }

    // 导入规则
    async function importRules(rules: Rule[]): Promise<void> {
        try {
            // 先获取现有的规则，避免覆盖
            const existingRules = await ruleStore.getAllRules();
            const existingRuleIds = new Set(existingRules.map(r => r.id));
            
            // 只导入新的规则
            const rulesToImport = rules.filter(r => !existingRuleIds.has(r.id));
            
            for (const rule of rulesToImport) {
                await ruleStore.saveRule(rule);
            }
            
            console.log(`成功导入 ${rulesToImport.length} 条规则`);
        } catch (error) {
            console.error('批量导入规则失败:', error);
            throw error;
        }
    }

    // 显示状态消息
    function showStatus(message: string, type: 'info' | 'success' | 'error') {
        if (statusMessage) {
            statusMessage.textContent = message;
            statusMessage.className = `status-message ${type}`;
            statusMessage.style.display = 'block';
        }
    }
});