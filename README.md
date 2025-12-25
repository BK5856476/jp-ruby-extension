# Japanese Ruby Extension (日语注音插件) - MVP

这是一个能够自动为网页上的日语汉字添加平假名注音的浏览器开发工具。它由 Python 后端（提供分词分析）和 Chrome 插件（负责前端显示）组成。

## ✨ 功能特性 (Features)

*   **自动注音**: 选中网页上的日语文本，自动识别汉字并标注假名。
*   **精准分析**: 后端使用 `fugashi` (MeCab) 进行工业级日语分词，准确度高。
*   **无缝体验**: 基于 DOM 替换技术，选中即变，不破坏网页原有排版（大部分情况下）。
*   **CORS 支持**: 允许任意网页调用本地 API。

## 🛠️ 安装与运行 (Setup)

本项目包含两部分，都需要运行才能正常工作。

### 1. 启动后端服务 (Backend)

确保您的环境已安装 Python 3.8+。

**安装依赖:**
```bash
pip install fastapi uvicorn fugashi unidic-lite
```

**启动服务:**
在项目根目录下运行：
```bash
python main.py
```
*成功启动后，您会看到 `Uvicorn running on http://127.0.0.1:8000`。请保持此窗口开启。*

### 2. 加载浏览器插件 (Extension)

1.  打开 Chrome 浏览器，在地址栏输入 `chrome://extensions/`。
2.  开启右上角的 **"开发者模式" (Developer mode)** 开关。
3.  点击左上角的 **"加载已解压的扩展程序" (Load unpacked)**。
4.  选择本项目文件夹下的 **`extension`** 目录。

## 🚀 使用方法 (Usage)

1.  确保后端 `main.py` 正在运行。
2.  确保插件已加载。
3.  打开任意日语网页（如 Yahoo! Japan 或 NHK News）。
    *   *注意：如果是刚加载插件前已经打开的网页，请先 **F5 刷新** 一次。*
4.  **用鼠标选中一段包含汉字的文本**，然后松开鼠标。
5.  文字瞬间变为 `<ruby>` 注音格式！

## 📂 项目结构

```
.
├── backend/            # Python 后端核心逻辑
│   ├── analyze.py      # 分词与注音核心代码
│   └── __init__.py
├── extension/          # Chrome 插件源码
│   ├── manifest.json   # 插件配置 (V3)
│   └── content.js      # 前端逻辑 (监听选区 & DOM 替换)
├── main.py             # FastAPI 服务入口
└── README.md           # 说明文档
```

## 📝 开发计划 (To-Do)

*   [ ] **翻译功能**: 集成 Google/DeepL 翻译，显示选中词汇的中文释义。
*   [ ] **UI 优化**: 为翻译结果添加悬浮窗 (Tooltip)。
*   [ ] **性能优化**: 减少重复请求，增加缓存。
