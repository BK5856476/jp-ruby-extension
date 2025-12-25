import json
from analyze import analyze_text   # 导入核心解析函数

def pretty(result):
    """
    以格式化的 JSON 形式打印结果，方便阅读。
    ensure_ascii=False 保证日语/中文能正常显示，而不是转义符。
    """
    print(json.dumps(result, ensure_ascii=False, indent=2))


def run_test(title, text):
    """
    运行单个测试用例。
    
    Args:
        title: 测试用例的标题/说明
        text: 要测试的输入文本
    """
    print("=" * 40)
    print(f"[TEST] {title}")
    print("Input:", text)
    
    # 调用解析函数
    result = analyze_text(text)
    
    # 打印结果
    pretty(result)


if __name__ == "__main__":
    # --- 测试用例集合 ---

    # 1. 含汉字的句子
    # 预期："日本語" -> has_kanji: True, reading: ニッポン
    #      "勉強"   -> has_kanji: True, reading: ベンキョウ
    run_test(
        "汉字句 (标准测试)",
        "日本語を勉強する"
    )

    # 2. 纯平假名句子
    # 预期：所有词 has_kanji 应为 False
    # 这种情况下通常不需要显示注音 (ruby: False)
    run_test(
        "纯平假名 (无汉字)",
        "これはてすとです"
    )

    # 3. 片假名词汇
    # 预期：MeCab 能正确切分片假名单词
    run_test(
        "片假名 (外来语)",
        "テストを開始する"
    )

    # 4. 混合语言 (日语 + 英语)
    # 预期：英文单词也能被切分，reading 通常也是原文或片假名化结果
    run_test(
        "混合语言 (Python + 日语)",
        "Pythonで解析する"
    )

    # 5. 符号与标点
    # 预期：程序不应报错，标点符号应被识别为单独的 token
    run_test(
        "符号与标点",
        "解析、成功！"
    )
