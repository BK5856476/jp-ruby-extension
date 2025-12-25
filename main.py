from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import uvicorn
# 导入后端核心分析逻辑
from backend.analyze import analyze_text

# 初始化 FastAPI 应用
app = FastAPI()

# 配置 CORS (跨域资源共享)
# 允许所有来源 ("*") 访问，这对于允许浏览器扩展调用此 API 是必须的
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 允许所有源
    allow_credentials=True,
    allow_methods=["*"],  # 允许所有 HTTP 方法 (GET, POST, OPTIONS 等)
    allow_headers=["*"],  # 允许所有请求头
)

# ------------------------------
# 数据模型定义 (Pydantic Models)
# ------------------------------

class AnalyzeRequest(BaseModel):
    """
    请求模型：客户端发送的待分析文本
    """
    text: str  # 需要分析的日语文本

class TokenResponse(BaseModel):
    """
    响应模型：返回给客户端的单词分析结果
    需要与 analyze.py 的输出完全一致
    """
    surface: str             # 原文
    reading: str             # 读音
    pos: Optional[str]       # 词性
    has_kanji: bool          # 是否含汉字
    ruby: bool               # 是否显示注音
    selected: bool           # 是否选中
    translation: Optional[str] # 翻译

# ------------------------------
# 接口逻辑
# ------------------------------

@app.post("/analyze", response_model=List[TokenResponse])
def analyze_endpoint(request: AnalyzeRequest):
    """
    接收日语文本，调用后端分析逻辑，返回完整结果。
    """
    # 1. 调用核心逻辑获取原始分析结果
    # analyze_text 返回包含 'surface', 'reading', 'ruby' 等字段的字典列表
    raw_result = analyze_text(request.text)
    
    # 2. 转换数据格式
    # 直接映射字段，不再重命名 ruby -> needs_ruby
    response = []
    for item in raw_result:
        response.append(TokenResponse(
            surface=item["surface"],
            reading=item["reading"],
            pos=item["pos"],
            has_kanji=item["has_kanji"],
            ruby=item["ruby"],
            selected=item["selected"],
            translation=item["translation"]
        ))
    
    return response

# 启动入口 (仅在直接运行此文件时执行)
if __name__ == "__main__":
    # 使用 uvicorn 启动服务，监听 8000 端口
    uvicorn.run(app, host="127.0.0.1", port=8000)
