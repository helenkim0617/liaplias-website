// build-sitemap.js
// LIAPLIAS 统一 Sitemap 生成脚本（V2）
// 读取 family-config_v2.json + category-mapping.json，生成 sitemap.xml
// 运行：node build-sitemap.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== 配置 =====
const FAMILY_CONFIG_FILE = './assets/data/family-config_v2.json';
const CATEGORY_MAPPING_FILE = './assets/data/category-mapping.json';
const SITEMAP_OUTPUT = './sitemap.xml';
const BASE_URL = 'https://www.liaplias.com';

// ========================================
// V1 遗留 Product Family 页面列表（不受 family-config_v2.json 管理）
// CS-03 / CS-04 等，保留不迁移
// ========================================
const FAMILY_PAGES = [
  {
    url: '/en/products/countersunk-socket-screw-m4-lia-cs-04.html',
    priority: 0.8,
    changefreq: 'monthly',
  },
  // 后续 V1 遗留 Family 在此添加
];
// ========================================

// ===== 读取数据 =====
function readJSON(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`❌ 读取失败: ${filePath}`, error.message);
    process.exit(1);
  }
}

// ===== 生成日期 =====
function getLastMod() {
  return new Date().toISOString().split('T')[0];
}

// ===== 生成单个 URL 节点 =====
function generateUrlNode(loc, priority = 0.8, changefreq = 'monthly') {
  const lastmod = getLastMod();
  return `
  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

// ===== 生成 Sitemap =====
function generateSitemap(families, categories) {
  const urls = [];

  // 1. V2 Family 详情页（优先级 0.8）— 来自 family-config_v2.json
  const familyUrls = families.map(f => {
    const url = `${BASE_URL}/en/products/${f.slug_en}.html`;
    return generateUrlNode(url, 0.8, 'monthly');
  });
  urls.push(...familyUrls);

  // 2. V1 遗留 Family 页面（优先级 0.8）— 硬编码列表，如 CS-04
  const legacyFamilyUrls = FAMILY_PAGES.map(page => {
    const url = `${BASE_URL}${page.url}`;
    return generateUrlNode(url, page.priority, page.changefreq);
  });
  urls.push(...legacyFamilyUrls);

// 3. 分类页（优先级 0.9）— 英文版 + 德语版
  const categoryUrls = categories.flatMap(cat => {
    const nodes = [generateUrlNode(`${BASE_URL}/en/categories/${cat.seo_slug}.html`, 0.9, 'weekly')];
    if (cat.slug_de) {
      nodes.push(generateUrlNode(`${BASE_URL}/de/categories/${cat.slug_de}.html`, 0.9, 'weekly'));
    }
    return nodes;
  });
  urls.push(...categoryUrls);

  // 4. 主要页面（优先级 1.0）
  const mainPages = [
    { url: `${BASE_URL}/en/index.html`, priority: 1.0, changefreq: 'weekly' },
    { url: `${BASE_URL}/en/code-search.html`, priority: 0.9, changefreq: 'weekly' },
    { url: `${BASE_URL}/en/cooperation.html`, priority: 0.8, changefreq: 'monthly' },
    { url: `${BASE_URL}/en/industries.html`, priority: 0.8, changefreq: 'monthly' },
    { url: `${BASE_URL}/en/solutions.html`, priority: 0.8, changefreq: 'monthly' },
    { url: `${BASE_URL}/en/partners.html`, priority: 0.8, changefreq: 'monthly' },
    { url: `${BASE_URL}/en/contact.html`, priority: 0.9, changefreq: 'monthly' },
  ];
  mainPages.forEach(page => {
    urls.push(generateUrlNode(page.url, page.priority, page.changefreq));
  });

  // 5. 多语言版本（zh/de/fr）
  const langs = ['zh', 'de', 'fr'];
  const langPages = ['index.html', 'code-search.html', 'cooperation.html', 'industries.html', 'solutions.html', 'partners.html', 'contact.html'];
  langs.forEach(lang => {
    langPages.forEach(page => {
      const url = `${BASE_URL}/${lang}/${page}`;
      const priority = page === 'index.html' ? 0.9 : (page === 'code-search.html' ? 0.8 : 0.7);
      urls.push(generateUrlNode(url, priority, 'weekly'));
    });
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('')}
</urlset>`;
}

// ===== 主函数 =====
function build() {
  console.log('🚀 LIAPLIAS Sitemap 生成开始 (V2)...');

  // 1. 读取数据
  console.log('📂 读取 Family 配置:', FAMILY_CONFIG_FILE);
  const familyConfig = readJSON(FAMILY_CONFIG_FILE);
  const families = Object.values(familyConfig.families || {});

  console.log('📂 读取分类映射:', CATEGORY_MAPPING_FILE);
  const categories = readJSON(CATEGORY_MAPPING_FILE);

  console.log(`✅ 加载了 ${families.length} 个 V2 Family，${categories.length} 个分类`);
  console.log(`📋 包含 ${FAMILY_PAGES.length} 个 V1 遗留 Family 页面`);

  // 2. 生成 Sitemap
  const sitemap = generateSitemap(families, categories);

  // 3. 写入文件
  fs.writeFileSync(SITEMAP_OUTPUT, sitemap, 'utf-8');
  console.log(`✅ 已生成: ${SITEMAP_OUTPUT}`);

  // 4. 统计信息
  const totalUrls = families.length + FAMILY_PAGES.length + categories.length * 2 + 7 + 21;
  console.log(`📊 Sitemap 包含 ${totalUrls} 个 URL`);
  console.log(`   - V2 Family 详情页: ${families.length} 个`);
  console.log(`   - V1 遗留 Family 页: ${FAMILY_PAGES.length} 个`);
  console.log(`   - 分类页: ${categories.length * 2} 个 (${categories.length} 英文 + ${categories.length} 德语)`);
  console.log(`   - 其他页面: ${totalUrls - families.length - FAMILY_PAGES.length - categories.length} 个`);
  console.log('🎉 构建完成!');
}

// ===== 执行 =====
build();