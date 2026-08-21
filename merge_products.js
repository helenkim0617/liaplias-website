// merge_products.js
// 合并 products.json 和 products_v2.json 为 products_merged.json
// 统一字段映射，消除 schema 差异
// 运行：node merge_products.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== 配置 =====
const PRODUCTS_V1 = './assets/data/products.json';
const PRODUCTS_V2 = './assets/data/products_v2.json';
const OUTPUT_FILE = './assets/data/products_merged.json';

// ===== 读取 JSON =====
function readJSON(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.warn(`⚠️ 读取失败: ${filePath}`, error.message);
    return null;
  }
}

// ===== 统一字段映射 =====
function normalizeProduct(product, source) {
  // 从 V1（旧 schema）或 V2（新 schema）提取统一字段
  const normalized = {
    lia_code: product.lia_code || '',
    category_code: product.category_code || '',
    category_name_en: product.category_name_en || '',
    category_name_zh: product.category_name_zh || '',
    hasco_code: product.hasco_code || null,
    meusburger_code: product.meusburger_code || null,
    status: product.status || 'active',
    verification_status: product.verification_status || 'PENDING',
    notes_en: product.notes_en || '',
    notes_zh: product.notes_zh || '',
    suffix1: product.suffix1 || '',
    suffix2: product.suffix2 || '',
    suffix3: product.suffix3 || '',
    unit_price_eur_ref: product.unit_price_eur_ref || null,
    material: product.material || null,
    surface: product.surface || null,
    tolerance: product.tolerance || null,
    hardness: product.hardness || null,
    heat_treatment: product.heat_treatment || null,
    // 统一规格显示字段
    spec_display: product.spec_display || '',
    // 保留原始来源标识
    _source: source,
  };

  return normalized;
}

// ===== 主函数 =====
function main() {
  console.log('🔄 开始合并产品数据...');

  const v1Data = readJSON(PRODUCTS_V1);
  const v2Data = readJSON(PRODUCTS_V2);

  const products = [];

  // 处理 V1 数据
  if (v1Data) {
    const list = v1Data.products || [];
    list.forEach(p => {
      products.push(normalizeProduct(p, 'v1'));
    });
    console.log(`✅ 从 products.json 读取 ${list.length} 个 SKU`);
  }

  // 处理 V2 数据
  if (v2Data) {
    const list = v2Data.products || [];
    list.forEach(p => {
      products.push(normalizeProduct(p, 'v2'));
    });
    console.log(`✅ 从 products_v2.json 读取 ${list.length} 个 SKU`);
  }

  // 去重（按 lia_code）
  const uniqueMap = new Map();
  products.forEach(p => {
    if (!uniqueMap.has(p.lia_code)) {
      uniqueMap.set(p.lia_code, p);
    } else {
      console.log(`⚠️ 重复 SKU: ${p.lia_code}，保留第一个`);
    }
  });

  const uniqueProducts = Array.from(uniqueMap.values());

  // 写入合并文件
  const output = {
    version: 'merged',
    generated: new Date().toISOString(),
    total: uniqueProducts.length,
    products: uniqueProducts,
    _meta: {
      sources: ['products.json', 'products_v2.json'],
      fields: Object.keys(uniqueProducts[0] || {}),
    },
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`✅ 合并完成！共 ${uniqueProducts.length} 个 SKU`);
  console.log(`💾 已写入: ${OUTPUT_FILE}`);
}

main();