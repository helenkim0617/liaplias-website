const fs = require('fs');
const path = require('path');

// ===== 配置 =====
const CONFIG_PATH = path.join(__dirname, 'assets', 'data', 'family-config_v2.json');

const LANGUAGES = ['en', 'de', 'fr', 'zh'];

const HTML_FILES = {
  en: path.join(__dirname, 'en', 'code-search.html'),
  de: path.join(__dirname, 'de', 'code-search.html'),
  fr: path.join(__dirname, 'fr', 'code-search.html'),
  zh: path.join(__dirname, 'zh', 'code-search.html'),
};

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

  // 2. 提取 category_code 列表（用于 FAMILY_GROUPED_CATEGORIES）
  const groupedCategories = Object.keys(families);

  // 3. 为每种语言生成路径映射
  const pathMap = {};
  LANGUAGES.forEach(lang => {
    pathMap[lang] = {};
    groupedCategories.forEach(code => {
      const family = families[code];
      // 选择对应语言的 slug，缺失则用英文兜底
      let slug = family[`slug_${lang}`];
      if (!slug) {
        slug = family.slug_en;
        if (lang !== 'en') {
          console.warn(`⚠️  ${lang}: ${code} 缺少 slug_${lang}，使用 slug_en 兜底`);
        }
      }
      // 生成路径
      pathMap[lang][code] = `/en/products/${slug}.html`;
      // 生成 LIA-XXX 格式（兼容旧映射）
      const liaPrefix = `LIA-${code}`;
      pathMap[lang][liaPrefix] = `/en/products/${slug}.html`;
    });
  });

  // 4. 生成 JS 代码块
  const groupedCode = generateGroupedCode(groupedCategories);
  const pathCode = {};

  LANGUAGES.forEach(lang => {
    pathCode[lang] = generatePathCode(pathMap[lang]);
  });

  // 5. 写入4个文件
  LANGUAGES.forEach(lang => {
    const filePath = HTML_FILES[lang];
    if (!fs.existsSync(filePath)) {
      console.error(`❌ 文件不存在: ${filePath}`);
      return;
    }
    updateFile(filePath, groupedCode, pathCode[lang]);
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