const fs = require('fs');
const path = require('path');

// ===== 配置 =====
const CONFIG_PATH = path.join(__dirname, 'assets', 'data', 'family-config_v2.json');
const CATEGORY_MAP_PATH = path.join(__dirname, 'assets', 'data', 'category-mapping.json');

const LANGUAGES = ['en', 'de', 'fr', 'zh'];

const HTML_FILES = {
  en: path.join(__dirname, 'en', 'code-search.html'),
  de: path.join(__dirname, 'de', 'code-search.html'),
  fr: path.join(__dirname, 'fr', 'code-search.html'),
  zh: path.join(__dirname, 'zh', 'code-search.html'),
};

// 界面文案字典（不属于分类数据，独立维护，仿 build-families_v2.js 的 UI_STRINGS 模式）
// 用户确认稿（2026-08-16）
const FILTER_UI_STRINGS = {
  en: { filterLabel: 'Filter:', allCategories: 'All Categories' },
  de: { filterLabel: 'Filter:', allCategories: 'Alle Kategorien' },
  fr: { filterLabel: 'Filtre', allCategories: 'Toutes les catégories' },  // 注：EN/DE 用了冒号"Filter:"，你给的是"Filtre"不带冒号，先按你原话保留，要统一加冒号告诉我
  zh: { filterLabel: '筛选', allCategories: '全部类别' },                    // 同上，"筛选"不带冒号，先按你原话保留
};

const DRY_RUN = process.argv.includes('--dry-run');

// ===== 主逻辑 =====
function main() {
  console.log('🚀 开始生成 code-search.html 映射数据...\n');

  // 1. 读取配置
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error(`❌ 配置文件不存在: ${CONFIG_PATH}`);
    process.exit(1);
  }
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  const families = config.families || {};

  // 1b. 读取 SEO 分类映射（category-mapping.json，根节点是数组，6个分类）
  if (!fs.existsSync(CATEGORY_MAP_PATH)) {
    console.error(`❌ 配置文件不存在: ${CATEGORY_MAP_PATH}`);
    process.exit(1);
  }
  const categories = JSON.parse(fs.readFileSync(CATEGORY_MAP_PATH, 'utf-8'));
  if (!Array.isArray(categories)) {
    console.error(`❌ ${CATEGORY_MAP_PATH} 根节点应为数组，实际不是，请检查文件结构`);
    process.exit(1);
  }

  // 2. 提取 category_code 列表（用于 FAMILY_GROUPED_CATEGORIES）
  const groupedCategories = Object.keys(families);

  // 3. 为每种语言生成路径映射
  const pathMap = {};
  LANGUAGES.forEach(lang => {
    pathMap[lang] = {};
    groupedCategories.forEach(code => {
      const family = families[code];
      // 选择对应语言的 slug；没有专属详情页时退回英文 slug，
      // 同时 URL 前缀也要一并退回 /en/ —— 因为没有专属 slug 就意味着
      // 该语言从未单独建过详情页，/{lang}/products/ 目录根本不存在，
      // 只有 /en/products/ 是真实页面，前缀跟 slug 必须成对退回，不能只退 slug
      let slug = family[`slug_${lang}`];
      let pathLang = lang;
      if (!slug) {
        slug = family.slug_en;
        pathLang = 'en';
        if (lang !== 'en') {
          console.warn(`⚠️  ${lang}: ${code} 缺少 slug_${lang}，无专属详情页，链接对接英文详情页 /en/products/${slug}.html`);
        }
      }
      // 生成路径
      pathMap[lang][code] = `/${pathLang}/products/${slug}.html`;
      // 生成 LIA-XXX 格式（兼容旧映射）
      const liaPrefix = `LIA-${code}`;
      pathMap[lang][liaPrefix] = `/${pathLang}/products/${slug}.html`;
    });
  });

  // 4. 生成 JS 代码块
  const groupedCode = generateGroupedCode(groupedCategories);
  const pathCode = {};

  LANGUAGES.forEach(lang => {
    pathCode[lang] = generatePathCode(pathMap[lang]);
  });

  const filterRowCode = {};
  LANGUAGES.forEach(lang => {
    filterRowCode[lang] = generateFilterRowCode(lang, categories);
  });

  // 5b. 孤儿 code 校验（构建期）：family-config_v2.json 里的每个 category_code
  //     是否都能在 category-mapping.json 的六个分类 codes 里找到归属
  const mappedCodes = new Set(categories.flatMap(c => c.codes || []));
  const orphans = groupedCategories.filter(code => !mappedCodes.has(code));
  if (orphans.length) {
    console.warn(
      `⚠️  以下 category_code 在 family-config_v2.json 里存在，但没有被 category-mapping.json 任何一个分类的 codes 认领，` +
      `filter-row 筛选按钮里点不到它们：${orphans.join(', ')}`
    );
  }

  if (DRY_RUN) {
    console.log('\n🔍 --dry-run 模式：以下是将要写入每个语言版本的 filter-row 内容，不会修改任何文件\n');
    LANGUAGES.forEach(lang => {
      console.log(`--- ${lang} ---`);
      console.log(filterRowCode[lang]);
      console.log('');
    });
    return;
  }

  // 6. 写入4个文件
  LANGUAGES.forEach(lang => {
    const filePath = HTML_FILES[lang];
    if (!fs.existsSync(filePath)) {
      console.error(`❌ 文件不存在: ${filePath}`);
      return;
    }
    updateFile(filePath, groupedCode, pathCode[lang]);
    const filterOk = updateFilterRow(filePath, filterRowCode[lang]);
    if (!filterOk) {
      console.warn(`⚠️  ${filePath}: filter-row 未匹配到 <div class="filter-row">...</div>，该文件的分类筛选按钮未更新`);
    }
    console.log(`✅ 已更新: ${filePath}`);
  });

  console.log('\n✨ 全部完成！');
}

// ===== 生成 FAMILY_GROUPED_CATEGORIES 代码 =====
function generateGroupedCode(categories) {
  const arrStr = JSON.stringify(categories, null, 2);
  return `// AUTO-GENERATED:FAMILY_GROUPED_CATEGORIES:START
const FAMILY_GROUPED_CATEGORIES = ${arrStr};
// AUTO-GENERATED:FAMILY_GROUPED_CATEGORIES:END`;
}

// ===== 生成 FAMILY_PATH_MAP 代码 =====
function generatePathCode(map) {
  const lines = Object.entries(map).map(([key, value]) => {
    return `  '${key}': '${value}'`;
  });
  const body = lines.join(',\n');
  return `// AUTO-GENERATED:FAMILY_PATH_MAP:START
const FAMILY_PATH_MAP = {
${body}
};
// AUTO-GENERATED:FAMILY_PATH_MAP:END`;
}

// ===== 生成 FILTER_ROW 代码（HTML按钮，非JS对象）=====
function generateFilterRowCode(lang, categories) {
  const ui = FILTER_UI_STRINGS[lang];
  const allBtn = `            <button class="fchip on" data-cat="all" onclick="toggleCat(this)">${ui.allCategories}</button>`;
  const catBtns = categories.map(cat => {
    const label = cat[`name_${lang}`] || cat.name_en;
    const dataCat = (cat.codes || []).join(',');
    return `            <button class="fchip" data-cat="${dataCat}" onclick="toggleCat(this)">${label}</button>`;
  }).join('\n');

  return `          <div class="filter-row">
            <span class="filter-label">${ui.filterLabel}</span>
            <!-- AUTO-GENERATED:FILTER_ROW:START (source: category-mapping.json) -->
${allBtn}
${catBtns}
            <!-- AUTO-GENERATED:FILTER_ROW:END -->
          </div>`;
}

// ===== 替换文件中 filter-row 整个区块 =====
// 注：filter-row 在 HTML 正文里，不是 <script> 内的 JS 常量，用整块 div 匹配，
// 不依赖标记注释是否已存在于文件里（首次运行时文件里可能还没有 AUTO-GENERATED 注释）
function updateFilterRow(filePath, filterRowCode) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const filterRegex = /[ \t]*<div class="filter-row">[\s\S]*?<\/div>/;
  if (!filterRegex.test(content)) {
    return false;
  }
  content = content.replace(filterRegex, filterRowCode);
  fs.writeFileSync(filePath, content, 'utf-8');
  return true;
}

// ===== 替换文件中的标记区域 =====
function updateFile(filePath, groupedCode, pathCode) {
  let content = fs.readFileSync(filePath, 'utf-8');

  // 替换 FAMILY_GROUPED_CATEGORIES
  const groupedRegex = /\/\/ AUTO-GENERATED:FAMILY_GROUPED_CATEGORIES:START[\s\S]*?\/\/ AUTO-GENERATED:FAMILY_GROUPED_CATEGORIES:END/;
  if (groupedRegex.test(content)) {
    content = content.replace(groupedRegex, groupedCode);
  } else {
    console.warn(`⚠️  ${filePath}: 未找到 FAMILY_GROUPED_CATEGORIES 标记，跳过`);
  }

  // 替换 FAMILY_PATH_MAP
  const pathRegex = /\/\/ AUTO-GENERATED:FAMILY_PATH_MAP:START[\s\S]*?\/\/ AUTO-GENERATED:FAMILY_PATH_MAP:END/;
  if (pathRegex.test(content)) {
    content = content.replace(pathRegex, pathCode);
  } else {
    console.warn(`⚠️  ${filePath}: 未找到 FAMILY_PATH_MAP 标记，跳过`);
  }

  fs.writeFileSync(filePath, content, 'utf-8');
}

// ===== 执行 =====
main();