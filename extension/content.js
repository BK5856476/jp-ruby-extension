// content.js - Day 4: DOM Replacement Implementation

let isEnabled = true;
let translateEnabled = false;
let globalEnabled = false; // 新增：追踪全局模式状态

// 初始化时获取状态
chrome.storage.sync.get(['enabled', 'translateEnabled', 'globalEnabled'], (result) => {
    isEnabled = result.enabled !== false;
    // 默认开启翻译，方便用户直接体验
    translateEnabled = result.translateEnabled !== false; 
    globalEnabled = result.globalEnabled === true;
});

// 监听状态变化
chrome.storage.onChanged.addListener((changes) => {
    if (changes.enabled) {
        isEnabled = changes.enabled.newValue !== false;
    }
    if (changes.translateEnabled) {
        translateEnabled = changes.translateEnabled.newValue === true;
    }
    if (changes.globalEnabled) {
        globalEnabled = changes.globalEnabled.newValue === true;
    }
});

// 监听来自 popup 的指令
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'startGlobalAnnotation') {
        annotateAllKanji();
    } else if (request.action === 'clearAllAnnotations') {
        clearAllAnnotations();
    }
});

/**
 * 全网页注音逻辑
 */
async function annotateAllKanji() {
    console.log("🚀 开始全网页分析...");
    
    // 1. 查找所有包含汉字的文本节点
    const textNodes = [];
    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: (node) => {
                // 排除已处理过的、不可见的或特定标签内的文本
                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;
                
                const tagName = parent.tagName.toLowerCase();
                const ignoredTags = ['script', 'style', 'textarea', 'ruby', 'rt', 'rp', 'input', 'code', 'pre'];
                
                if (ignoredTags.includes(tagName)) return NodeFilter.FILTER_REJECT;
                if (parent.closest('ruby')) return NodeFilter.FILTER_REJECT;
                
                // 检查是否包含汉字
                if (/[\u4e00-\u9fa5]/.test(node.textContent)) {
                    return NodeFilter.FILTER_ACCEPT;
                }
                return NodeFilter.FILTER_SKIP;
            }
        }
    );

    let node;
    while (node = walker.nextNode()) {
        textNodes.push(node);
    }

    console.log(`[Global] 找到 ${textNodes.length} 个待处理文本节点`);

    // 2. 分批处理 (每批 10 个节点，避免请求过大或频率过高)
    const BATCH_SIZE = 10;
    for (let i = 0; i < textNodes.length; i += BATCH_SIZE) {
        const batch = textNodes.slice(i, i + BATCH_SIZE);
        
        // 并发处理这一批次
        await Promise.all(batch.map(async (textNode) => {
            const originalText = textNode.textContent.trim();
            if (!originalText) return;

            try {
                const response = await fetch('http://127.0.0.1:8000/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: originalText })
                });

                if (!response.ok) return;
                const data = await response.json();
                let tokens = data;
                if (data.tokens) {
                    tokens = data.tokens;
                }
                if (!Array.isArray(tokens)) return;

                // 构建 Ruby 片段
                const fragment = document.createDocumentFragment();
                tokens.forEach(token => {
                    if (token.ruby) {
                        const rubyEl = document.createElement('ruby');
                        rubyEl.appendChild(document.createTextNode(token.surface));
                        const rtEl = document.createElement('rt');
                        rtEl.style.userSelect = 'none';
                        rtEl.style.webkitUserSelect = 'none';
                        rtEl.style.pointerEvents = 'none';
                        rtEl.textContent = token.reading;
                        rubyEl.appendChild(rtEl);
                        fragment.appendChild(rubyEl);
                    } else {
                        fragment.appendChild(document.createTextNode(token.surface));
                    }
                });

                // 如果开启了翻译模式且在全局模式下（可选：全局模式下显示翻译可能会让页面很乱）
                // 这里暂时不在全局模式下显示翻译，除非用户强烈要求
                
                // 替换节点
                if (textNode.parentNode) {
                    textNode.parentNode.replaceChild(fragment, textNode);
                }
            } catch (err) {
                console.error("[Global] 分析节点失败:", err);
            }
        }));
        
        // 稍微停顿一下，给浏览器喘息机会
        await new Promise(r => setTimeout(r, 50));
    }

    console.log("✅ 全网页分析完成");
}

/**
 * 清除页面上所有的注音和翻译，恢复原样
 */
function clearAllAnnotations() {
    // 1. 移除所有翻译容器 (包括我们新版的 span 和旧版的 div)
    document.querySelectorAll('.jp-ruby-translation').forEach(el => {
        // 如果翻译是作为 ruby 的 rt 存在的，它会在下一步被 ruby 的还原逻辑处理
        // 如果它是独立的 div/span，这里直接删除
        el.remove();
    });

    // 2. 还原所有 ruby 标签
    // 我们从 DOM 中找到所有 ruby，将其替换为不含 rt 的纯文本
    const rubies = Array.from(document.querySelectorAll('ruby'));
    rubies.forEach(ruby => {
        // 创建一个临时容器来提取纯文本（避开 rt 里的假名）
        const clone = ruby.cloneNode(true);
        const rts = clone.querySelectorAll('rt');
        rts.forEach(rt => rt.remove());
        
        const originalText = clone.textContent;
        ruby.replaceWith(document.createTextNode(originalText));
    });

    console.log("🧹 已清除所有注音和翻译");
}

/**
 * 辅助函数：从 Range 中提取纯文本，忽略 <rt> 标签（避开假名干扰）
 */
function getCleanTextFromRange(range) {
    // 克隆选区内容
    const clone = range.cloneContents();
    // 找到克隆内容中所有的 rt 标签并移除
    const rts = clone.querySelectorAll('rt');
    rts.forEach(rt => rt.remove());
    // 返回清洗后的纯文本
    return clone.textContent.trim();
}

document.addEventListener('mouseup', async () => {
    // 如果两个功能都禁用了，则不执行逻辑
    if (!isEnabled && !translateEnabled) return;

    // 1. 获取选区对象
    const selection = window.getSelection();
    if (selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);

    // 2. 提取并清洗文本（如果选中了已注音的文字，去掉假名）
    const text = getCleanTextFromRange(range);

    // 如果没选中东西，直接返回
    if (!text) return;

    // --- 修复叠加 Bug：对齐选区边界 ---
    // 如果选区的起点或终点在 ruby 内部，我们要把边界向外扩展到 ruby 的边缘
    // 这样 deleteContents() 就能干净地移除旧的注音结构
    
    // 辅助函数：找到最外层的 ruby 容器
    const getTopRuby = (node) => {
        let el = node.nodeType === 3 ? node.parentElement : node;
        let ruby = el.closest('ruby');
        if (ruby) {
            while (ruby.parentElement && ruby.parentElement.closest('ruby')) {
                ruby = ruby.parentElement.closest('ruby');
            }
        }
        return ruby;
    };

    let startRuby = getTopRuby(range.startContainer);
    if (startRuby) range.setStartBefore(startRuby);

    let endRuby = getTopRuby(range.endContainer);
    if (endRuby) range.setEndAfter(endRuby);
    // -----------------------------------

    // 防重复处理：
    // 如果“注音”和“翻译”都关了，或者选区为空，则退出

    console.log("👉 正在请求分析:", text);

    try {
        // 3. 调用后端 API
        const response = await fetch('http://127.0.0.1:8000/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                text: text,
                need_translation: translateEnabled // 只有开启时才请求翻译，节省性能
            })
        });

        const data = await response.json();
        let tokens = data;
        let translation = "";
        if (data.tokens) {
            tokens = data.tokens;
            translation = data.full_translation;
        }
        
        if (!Array.isArray(tokens)) {
            console.error("❌ 数据格式错误", data);
            return;
        }
        console.log("✅收到数据:", data);

        // 4. 构建新的 HTML 片段 (DocumentFragment)
        const fragment = document.createDocumentFragment();

        // 创建一个包装容器，用于承载所有选中的词
        const wrapper = document.createElement('span');
        wrapper.style.display = 'inline';

        tokens.forEach(token => {
            // 只要开启了注音功能，或者当前正处于全局注音模式，我们就保留注音
            if ((isEnabled || globalEnabled) && token.ruby) {
                const rubyEl = document.createElement('ruby');
                rubyEl.style.rubyPosition = 'over'; // 强制假名在上方
                rubyEl.style.webkitRubyPosition = 'over';
                rubyEl.innerHTML = `${token.surface}<rt style="user-select:none; -webkit-user-select:none; pointer-events:none;">${token.reading}</rt>`;
                wrapper.appendChild(rubyEl);
            } else {
                wrapper.appendChild(document.createTextNode(token.surface));
            }
        });

        // 如果开启了翻译模式，将整个 wrapper 再次包装进一个 ruby 中，实现“下方注音”
        if (translateEnabled && translation) {
            const outerRuby = document.createElement('ruby');
            outerRuby.style.rubyPosition = 'under'; // 关键：注音显示在下方
            // 某些浏览器需要这个前缀或特定写法
            outerRuby.style.webkitRubyPosition = 'under'; 
            
            // 把刚才构建好的原文/假名放进去
            outerRuby.appendChild(wrapper);
            
            // 创建翻译用的 rt
            const rtTrans = document.createElement('rt');
            rtTrans.style.userSelect = 'none';
            rtTrans.style.webkitUserSelect = 'none';
            rtTrans.style.pointerEvents = 'none';
            rtTrans.style.fontSize = '0.75em';
            rtTrans.style.fontStyle = 'normal';
            rtTrans.style.display = 'ruby-text';
            // 不设置特定颜色，使其跟随文本颜色
            rtTrans.textContent = translation;
            
            outerRuby.appendChild(rtTrans);
            fragment.appendChild(outerRuby);
        } else {
            // 如果没开翻译，直接把 wrapper 放进 fragment
            fragment.appendChild(wrapper);
        }

        // 5. DOM 替换操作
        range.deleteContents();
        range.insertNode(fragment);

        // 6. 清除选区
        selection.removeAllRanges();

    } catch (error) {
        console.error("❌ 处理失败:", error);
    }
});