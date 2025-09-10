// 帮助页面的交互逻辑

document.addEventListener('DOMContentLoaded', () => {
    // 返回按钮点击事件
    const backButton = document.getElementById('btn-back');
    if (backButton) {
        backButton.addEventListener('click', () => {
            // 如果是从popup打开的，则返回到popup
            // 否则关闭当前标签页
            if (window.opener) {
                window.opener.focus();
                window.close();
            } else {
                window.history.back();
            }
        });
    }

    // 语言切换功能
    function setupLanguageSwitch() {
        // 检查浏览器语言设置
        const browserLang = navigator.language;
        let defaultLang = 'en';
        
        // 如果是中文环境，设置默认语言为中文
        if (browserLang.includes('zh')) {
            defaultLang = 'zh_CN';
        }

        // 尝试从localStorage中获取用户上次选择的语言
        const savedLang = localStorage.getItem('tabGroupLanguage') || defaultLang;
        loadLanguage(savedLang);
    }

    // 加载指定语言的帮助内容
    async function loadLanguage(lang: string) {
        try {
            const response = await fetch(`help/${lang}/help.json`);
            if (!response.ok) {
                throw new Error(`Failed to load language file for ${lang}`);
            }
            
            const translations = await response.json();
            applyTranslations(translations);
            localStorage.setItem('tabGroupLanguage', lang);
        } catch (error) {
            console.error('Error loading language:', error);
            // 如果加载失败，尝试加载英文作为备选
            if (lang !== 'en') {
                loadLanguage('en');
            }
        }
    }

    // 应用翻译到页面元素
    function applyTranslations(translations: Record<string, string>) {
        // 遍历所有有data-i18n属性的元素
        document.querySelectorAll('[data-i18n]').forEach((element) => {
            const key = element.getAttribute('data-i18n');
            if (key && translations[key]) {
                element.textContent = translations[key];
            }
        });

        // 更新页面标题
        if (translations['pageTitle']) {
            document.title = translations['pageTitle'];
        }

        // 更新按钮文本
        if (translations['btnBack'] && backButton) {
            backButton.textContent = translations['btnBack'];
        }
    }

    // 初始化语言设置
    setupLanguageSwitch();

    // 自动打开第一个折叠面板
    const firstAccordionButton = document.querySelector('.accordion button') as HTMLElement;
    if (firstAccordionButton) {
        firstAccordionButton.click();
    }

    // 添加动画效果
    const accordionItems = document.querySelectorAll('.accordion-item');
    accordionItems.forEach((item, index) => {
        setTimeout(() => {
            const htmlItem = item as HTMLElement;
            htmlItem.style.opacity = '1';
            htmlItem.style.transform = 'translateY(0)';
        }, 100 * index);
    });
});