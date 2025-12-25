// content.js - Day 4: DOM Replacement Implementation

document.addEventListener('mouseup', async () => {
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