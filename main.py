from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import uvicorn
# 导入后端核心分析逻辑
from backend.analyze import analyze_text, translate_text

# 初始化 FastAPI 应用
app = FastAPI()

# 配置 CORS (跨域资源共享)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalyzeRequest(BaseModel):
    text: str
    need_translation: bool = False

class TokenResponse(BaseModel):
    surface: str
    reading: str
    pos: Optional[str]
    has_kanji: bool
    ruby: bool
    selected: bool
    translation: Optional[str]

class FullAnalyzeResponse(BaseModel):
    tokens: List[TokenResponse]
    full_translation: str

@app.post("/analyze", response_model=FullAnalyzeResponse)
def analyze_endpoint(request: AnalyzeRequest):
    # 1. 调用核心逻辑进行分析
    raw_tokens = analyze_text(request.text)
    
    # 2. 如果请求要求翻译，则调用翻译接口
    full_translation = ""
    if request.need_translation:
        full_translation = translate_text(request.text)
    
    # 3. 转换数据格式
    tokens = [TokenResponse(**item) for item in raw_tokens]
    
    return FullAnalyzeResponse(
        tokens=tokens,
        full_translation=full_translation
    )

# 启动入口 (仅在直接运行此文件时执行)
if __name__ == "__main__":
    # 使用 uvicorn 启动服务，监听 8000 端口
    uvicorn.run(app, host="127.0.0.1", port=8000)
