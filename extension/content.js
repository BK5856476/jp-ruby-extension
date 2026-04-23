// content.js - Day 4: DOM Replacement Implementation

let isEnabled = true;

// 初始化时获取状态
chrome.storage.sync.get(['enabled'], (result) => {
    isEnabled = result.enabled !== false;
});

// 监听状态变化
chrome.storage.onChanged.addListener((changes) => {
    if (changes.enabled) {
        isEnabled = changes.enabled.newValue !== false;
    }
});

// 监听来自 popup 的指令
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'startGlobalAnnotation') {
        annotateAllKanji();
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
                const tokens = await response.json();

                // 构建 Ruby 片段
                const fragment = document.createDocumentFragment();
                tokens.forEach(token => {
                    if (token.ruby) {
                        const rubyEl = document.createElement('ruby');
                        rubyEl.appendChild(document.createTextNode(token.surface));
                        const rtEl = document.createElement('rt');
                        rtEl.textContent = token.reading;
                        rubyEl.appendChild(rtEl);
                        fragment.appendChild(rubyEl);
                    } else {
                        fragment.appendChild(document.createTextNode(token.surface));
                    }
                });

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

document.addEventListener('mouseup', async () => {
    // 如果插件被禁用，则不执行逻辑
    if (!isEnabled) return;

    // 1. 获取选区对象
    const selection = window.getSelection();
    const text = selection.toString().trim();

    // 如果没选中东西，直接返回
    if (!text) return;

    // 2. 关键：立即捕获当前选区的 Range 对象
    // 如果我们在 await 之后再获取，用户可能已经点击了别处，导致位置丢失
    if (selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);

    console.log("👉 正在请求分析:", text);

    try {
        // 3. 调用后端 API
        const response = await fetch('http://127.0.0.1:8000/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text })
        });

        const tokens = await response.json();
        console.log("✅收到数据:", tokens);

        // 4. 构建新的 HTML 片段 (DocumentFragment)
        // 使用 Fragment 可以减少页面重绘次数，性能更好
        const fragment = document.createDocumentFragment();

        tokens.forEach(token => {
            if (token.ruby) { // 后端返回 ruby=true 说明需要注音
                // 创建 <ruby> 元素
                // 结构: <ruby>汉字<rt>假名</rt></ruby>
                const rubyEl = document.createElement('ruby');

                const originalText = document.createTextNode(token.surface);
                const rtEl = document.createElement('rt');
                rtEl.textContent = token.reading;

                rubyEl.appendChild(originalText);
                rubyEl.appendChild(rtEl);

                // 添加样式优化 (可选，防止注音影响行高)
                // rubyEl.style.margin = "0 2px"; 

                fragment.appendChild(rubyEl);
            } else {
                // 不需要注音的词 (如平假名、标点)，直接原样显示
                const textNode = document.createTextNode(token.surface);
                fragment.appendChild(textNode);
            }
        });

        // 5. DOM 替换操作
        // 先删除选区内的原有文本
        range.deleteContents();
        // 再插入我们要的 Ruby 片段
        range.insertNode(fragment);

        // 6. 清除选区 (避免文字仍处于选中状态，视觉上更整洁)
        selection.removeAllRanges();

    } catch (error) {
        console.error("❌ 处理失败:", error);
    }
});