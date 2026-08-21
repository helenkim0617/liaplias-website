# fetch_from_d1_v2.py
# LIAPLIAS 数据同步脚本 V2（已更新至36字段标准，2026-08-11）
# 从 D1 拉取产品数据，生成 products_v2.json
#本次更新说明（2026-08-13）：
#1.EXCLUDED_FIELDS =更新
#2.FIELDS =新增"Mat","category_name_de", "d1", "diameter_spec", "l1", "length_height",

# 本次更新说明（2026-08-11，SH01批次）：
# - FIELDS 新增5个SH01引入的字段：category_name_fr / hasco_ref / meusburger_ref / standard / hasco_mat_spec
#   （目前只有SH01会实际有值，EP01/SS01尚未回填，这些字段会显示为"部分记录为空"，属正常现象）
# - EXCLUDED_FIELDS 新增 source_step（内部批次序号，与notes_en/notes_zh同一性质，不应进products_v2.json）
#
# 更早更新说明（2026-08-08）：
# 1. FIELDS 清单更新为经过全量核对确认的31个SQL字段（详见 LIAPLIAS_字段字典_EP.xlsx 的 SQL字段清单_EP sheet）
#    - 新增：size_format / din / iso / created_at / updated_at（原FIELDS清单遗漏这5个）
#    - 移除：notes_en / notes_zh（已确认为开发表内部专用字段，不进SQL/D1，不应同步到网站数据）
#    - 改名：unit_price_eur_ref → unit_price_ref
# 2. 新增字段完整性校验：不再只是把 FIELDS 写进输出文件当文档，而是真正逐条产品核对，
#    报告"D1里哪些字段还没有部署/还没有值"，方便按 category_code 检查哪些标准字段尚未补充数据
# 3. 新增排除字段自动清除：如果 D1/API 仍然返回 notes_en/notes_zh 等已确认排除的字段（历史批次可能还有），
#    同步时主动丢弃，不写入 products_v2.json，避免内部专用信息意外流到网站可读的数据文件里
#
# 运行：python fetch_from_d1_v2.py

import requests
import json
import os
from datetime import datetime
from collections import defaultdict

# ===== 配置 =====
API_URL = "https://api.liaplias.com/api/products"
OUTPUT_FILE = "./assets/data/products_v2.json"

# ===== 标准字段清单（31个，与 SQL字段清单_EP 一致，按SQL文件真实顺序） =====
FIELDS = [
    "lia_code",
    "category_code",
    "category_name_en",
    "category_name_zh",
    "category_name_fr",
    "hasco_ref",
    "meusburger_ref",
    "hasco_code",
    "meusburger_code",
    "size_format",
    "din",
    "standard",
    "iso",
    "param1_label",
    "param1_value",
    "param2_label",
    "param2_value",
    "param3_label",
    "param3_value",
    "param4_label",
    "param4_value",
    "spec_display",
    "material",
    "hasco_mat_spec",
    "surface",
    "tolerance",
    "hardness",
    "heat_treatment",
    "suffix1",
    "suffix2",
    "suffix3",
    "unit_price_ref",
    "status",
    "verification_status",
    "created_at",
    "updated_at",
    "Mat",
    "category_name_de",
    "d1",
    "diameter_spec",
    "l1",
    "length_height",
]

# 明确排除：即便 API 返回了这些字段，也不写入 products_v2.json
# （notes_en/notes_zh/source_step 是开发表/批次内部专用字段，历史批次的D1记录可能仍带着它们，同步时主动剔除）
EXCLUDED_FIELDS = {"notes_en", "notes_zh", "source_step", "family_code", "name_en", "name_zh", "unit_price_eur_ref", "weight_g", "hasco_mat_spec"}


def validate_and_clean(products):
    """
    逐条产品核对字段完整性，并清除已排除字段。
    返回：清理后的 products 列表 + 校验报告
    """
    cleaned = []
    missing_count = defaultdict(int)      # 每个标准字段，有多少条记录该字段是 None/缺失
    unexpected_fields = set()             # API返回了、但不在标准31字段里的字段名
    excluded_found = defaultdict(int)     # 实际发现了哪些被排除字段、出现几次

    for p in products:
        row = {}
        for field in FIELDS:
            value = p.get(field, None)
            row[field] = value
            if value is None or value == "":
                missing_count[field] += 1

        for key in p.keys():
            if key in EXCLUDED_FIELDS:
                excluded_found[key] += 1
                continue  # 丢弃，不写入 row
            if key not in FIELDS:
                unexpected_fields.add(key)

        cleaned.append(row)

    return cleaned, {
        "missing_count": dict(missing_count),
        "unexpected_fields": sorted(unexpected_fields),
        "excluded_found": dict(excluded_found),
    }


def print_report(total, report):
    print("\n📋 字段完整性校验报告")
    print("-" * 50)

    # 完全没有任何值的字段 = 该字段在D1里可能还没真正部署/填数据
    never_populated = [f for f, cnt in report["missing_count"].items() if cnt == total]
    if never_populated:
        print(f"⚠️  以下字段在全部 {total} 条记录中都是空值（可能尚未在D1中补充数据）：")
        for f in never_populated:
            print(f"    - {f}")
    else:
        print("✅ 31个标准字段均至少在部分记录中有值")

    # 部分缺失的字段（不是全部为空，但也不是全部有值）——正常情况居多（如未启用的suffix/param3-4）
    partial_missing = {
        f: cnt for f, cnt in report["missing_count"].items()
        if 0 < cnt < total
    }
    if partial_missing:
        print(f"\nℹ️  以下字段部分记录为空（可能是正常的预留占位，也可能需要核实）：")
        for f, cnt in partial_missing.items():
            print(f"    - {f}: {cnt}/{total} 条为空")

    if report["excluded_found"]:
        print(f"\n🗑️  已自动剔除排除字段（不写入 products_v2.json）：")
        for f, cnt in report["excluded_found"].items():
            print(f"    - {f}: 在 {cnt} 条记录中发现，已丢弃")

    if report["unexpected_fields"]:
        print(f"\n❓ API返回了标准清单之外的未知字段（请核实是否需要补充进标准）：")
        for f in report["unexpected_fields"]:
            print(f"    - {f}")

    print("-" * 50)


# ===== 主函数 =====
def main():
    print("📡 从 D1 API 获取产品数据 (V2)...")

    try:
        response = requests.get(API_URL, timeout=30)
        response.raise_for_status()
        data = response.json()
    except requests.exceptions.RequestException as e:
        print(f"❌ API 请求失败: {e}")
        return

    if not data.get("success"):
        print("❌ API 返回失败")
        return

    raw_products = data.get("data", [])
    print(f"✅ 成功获取 {len(raw_products)} 个 SKU")

    if not raw_products:
        print("⚠️  没有任何产品数据，跳过校验和写入")
        return

    products, report = validate_and_clean(raw_products)
    print_report(len(products), report)

    # 确保输出目录存在
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)

    output = {
        "version": "2.1",
        "generated": datetime.now().isoformat(),
        "total": len(products),
        "fields": FIELDS,
        "products": products,
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"\n💾 已写入 {OUTPUT_FILE}，共 {len(products)} 个 SKU")
    print("✅ 同步完成 (V2)")


if __name__ == "__main__":
    main()
