// build-categories.js
// LIAPLIAS 分类SEO页面生成脚本 (V2)
// 读取 category-mapping.json + products_v2.json + family-config_v2.json，生成 6 个分类聚合页
// 运行：node scripts/build-categories.js
//
// 2026-08-08 修复说明（相对旧版本）：
// 1. 数据源从 products.json（V1）切换到 products_v2.json（V2）——原脚本一直在用V1数据
// 2. 卡片单位从"每个SKU一张卡"改为"每个category_code(Product Family)一张卡"：
//    旧逻辑会把EP这类900+ SKU的分类，在一个分类页里铺出900多张卡片，不现实也不是V2的设计
//    （V2标准：category_code=一个详情页，分类页只应该链接到各个Family详情页，不直接列SKU）
//    卡片改为链接到 family-config_v2.json 里定义的 family 详情页（/en/products/{slug}.html）
// 3. 修复 related_category_links 的正则不匹配问题：模板用的占位符是 {{related_category_links_bottom}}
//    （带_bottom后缀），旧正则只匹配不带后缀的版本，导致这个区域一直是空的，现已修正
// 4. 新增 {{meta_description_en}} 和 {{introduction_en}} 的实际替换——这两个字段此前在
//    category-mapping.json里认真写好了，但模板/脚本没有正确的占位符去承接，一直没生效
// 5. 新增 {{category_quicklinks}} 动态生成——原模板顶部"Browse by category"硬编码写死6个分类，
//    现在从 category-mapping.json 动态生成，新增/改名分类不用再手动改模板
//
// 2026-08-09 German rollout：
// 6. 修复一个bug：generateFamilyCard此前读的是familyCfg.slug——这个字段在German rollout那一步
//    已经拆成slug_en/slug_de了，不修的话会一直生成/en/products/undefined.html的坏链接
// 7. 新增 UI_STRINGS（en/de）覆盖模板里全部{{t_*}}占位符 + family卡片里JS拼出来的文案
//    （Standard/Lengths/options/cross-reference verified/Available for Quotation等）
// 8. build()改成对 en/de 两个语言各跑一遍，分别输出到 ./en/categories/ 和 ./de/categories/
//    ——分类名/meta/介绍文案读 category-mapping.json 的 name_de/meta_description_de/introduction_de，
//    缺失时兜底回退英文并打印警告（当前只有 ejector-pins / guide-pillars-guide-bushings 两个分类
//    真正配了德语内容，其余4个分类德语页面暂时是英文内容的占位版本，等翻译到位后再补）
// 9. 站内其余页面（cooperation/industries/code-search/solutions/partners/contact/privacy/terms/首页）
//    还没有德语版，德语分类页里指向这些页面的链接暂时仍指向英文版（文字翻译，链接不翻译）——
//    跟详情页"返回分类"链接是同一个处理原则，等对应页面出了德语版再切换

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== 配置 =====
const MAPPING_FILE = './assets/data/category-mapping.json';
const PRODUCTS_FILE = './assets/data/products_v2.json';       // 已切换为V2
const FAMILY_CONFIG_FILE = './assets/data/family-config_v2.json';  // 新增：拿每个category_code的详情页slug
const TEMPLATE_FILE = './assets/templates/category-template.html';
const OUTPUT_DIR_BY_LANG = {
  en: './en/categories/',
  de: './de/categories/',
};

// ===== UI_STRINGS：模板里的{{t_*}}占位符 + family卡片JS拼出来的文案，按语言分组 =====
const UI_STRINGS = {
  en: {
    ogSuffix: 'HASCO & Meusburger Compatible',
    titleSuffix: 'HASCO Compatible Mold Components',
    home: 'Home',
    categories: 'Categories',
    navCooperation: 'Cooperation',
    navIndustries: 'Industries',
    navCodeSearch: 'Code Search',
    navSolutions: 'Solutions',
    navPartners: 'Partners',
    navContact: 'Contact',
    getQuote: 'Get a Quote',
    codeSearchHint: 'Browse our range below, or search by your existing part number in <a href="/en/code-search.html">Code Search →</a>',
    browseByCategory: 'Browse by category',
    productRange: 'Product Range',
    browsePrefix: 'Browse',
    productCountText: (n) => `${n} product${n === 1 ? '' : 's'} available`,
    relatedCategories: 'Related Categories',
    requestQuote: 'Request Quote',
    contactUs: 'Contact Us',
    footerTagline: 'Precision CNC Parts — China Made, World Ready.',
    operatedBy: 'Operated by NOLVO',
    trademark: 'LIAPLIAS® Trademark registered in EU & US.',
    footerNavHeading: 'Navigation',
    footerLegalHeading: 'Legal',
    privacyPolicy: 'Privacy Policy',
    termsOfUse: 'Terms of Use',
    footerContactHeading: 'Contact',
    copyright: '© 2026 LIAPLIAS. All rights reserved.',
    rfqList: 'RFQ List',
    colSize: 'Size',
    colCode: 'LIA Code',
    colQty: 'Qty',
    rfqEmpty: 'No items added yet.',
    contactRequired: 'Contact Information (Required)',
    fullName: 'Full Name *',
    placeholderName: 'John Doe',
    companyName: 'Company Name *',
    placeholderCompany: 'Your Company',
    emailAddress: 'Email Address *',
    placeholderEmail: 'you@company.com',
    submitRfq: 'Submit RFQ',
    // family卡片专用
    standard: 'Standard',
    lengths: 'Lengths',
    optionsCount: (n) => `${n} options`,
    crossRefVerified: (v, n) => `${v}/${n} lengths cross-reference verified`,
    crossRefPending: 'Cross-references under verification',
    statusLabel: 'Status:',
    availableForQuotation: 'Available for Quotation',
    viewAllLengths: '🔍 View all lengths →',
  },
  de: {
    ogSuffix: 'HASCO- & Meusburger-kompatibel',
    titleSuffix: 'HASCO-kompatible Formenbau-Normalien',
    home: 'Startseite',
    categories: 'Kategorien',
    navCooperation: 'Kooperation',
    navIndustries: 'Branchen',
    navCodeSearch: 'Code-Suche',
    navSolutions: 'Lösungen',
    navPartners: 'Partner',
    navContact: 'Kontakt',
    getQuote: 'Angebot anfordern',
    codeSearchHint: 'Durchsuchen Sie unten unser Sortiment oder suchen Sie mit Ihrer vorhandenen Teilenummer in der <a href="/de/code-search.html">Code-Suche →</a>',
    browseByCategory: 'Nach Kategorie durchsuchen',
    productRange: 'Produktsortiment',
    browsePrefix: 'Durchsuchen:',
    productCountText: (n) => `${n} Produkt${n === 1 ? '' : 'e'} verfügbar`,
    relatedCategories: 'Verwandte Kategorien',
    requestQuote: 'Angebot anfordern',
    contactUs: 'Kontakt aufnehmen',
    footerTagline: 'Präzisions-CNC-Teile — China Made, World Ready.',
    operatedBy: 'Betrieben von NOLVO',
    trademark: 'LIAPLIAS® Warenzeichen eingetragen in EU & USA.',
    footerNavHeading: 'Navigation',
    footerLegalHeading: 'Rechtliches',
    privacyPolicy: 'Datenschutz',
    termsOfUse: 'Nutzungsbedingungen',
    footerContactHeading: 'Kontakt',
    copyright: '© 2026 LIAPLIAS. Alle Rechte vorbehalten.',
    rfqList: 'Anfrageliste',
    colSize: 'Größe',
    colCode: 'LIA-Code',
    colQty: 'Menge',
    rfqEmpty: 'Noch keine Artikel hinzugefügt.',
    contactRequired: 'Kontaktinformationen (Erforderlich)',
    fullName: 'Vollständiger Name *',
    placeholderName: 'Max Mustermann',
    companyName: 'Firmenname *',
    placeholderCompany: 'Ihr Unternehmen',
    emailAddress: 'E-Mail-Adresse *',
    placeholderEmail: 'sie@unternehmen.de',
    submitRfq: 'Anfrage senden',
    standard: 'Norm',
    lengths: 'Längen',
    optionsCount: (n) => `${n} Optionen`,
    crossRefVerified: (v, n) => `${v}/${n} Längen-Querverweise verifiziert`,
    crossRefPending: 'Querverweise werden noch geprüft',
    statusLabel: 'Status:',
    availableForQuotation: 'Verfügbar für Angebot',
    viewAllLengths: '🔍 Alle Längen ansehen →',
  },
};

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

// ===== 安全转义（防XSS，但主要避免模板注入） =====
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ===== 生成 Family 卡片 HTML（分类页展示的是"产品家族"，不是逐个SKU） =====
// 2026-08-08 v3：改用 code search 的 rc-* 卡片结构/样式，实现两处卡片视觉统一
// 去除 diameter_spec（V1遗留字段，V2不再使用）
function generateFamilyCard(categoryCode, variants, familyConfig, lang) {
  const familyCfg = familyConfig.families[categoryCode];
  if (!familyCfg) {
    console.log(`⚠️ ${categoryCode} 未在 family-config_v2.json 中配置，跳过该分类的卡片生成`);
    return '';
  }
  const t = UI_STRINGS[lang];

  const first = variants[0] || {};
  const tr = (familyCfg.translations && familyCfg.translations[lang]) || {};
  const displayName = (lang === 'de' ? tr.name : null) || first.category_name_en || familyCfg.name || categoryCode;
  const count = variants.length;

  const slug = lang === 'de' ? (familyCfg.slug_de || familyCfg.slug_en) : familyCfg.slug_en;
  if (lang === 'de' && !familyCfg.slug_de) {
    console.log(`⚠️ ${categoryCode} 没有配置 slug_de，卡片暂时链接到英文 slug: ${slug}`);
  }

  // DIN / Standard 分两行显示（iso已确认舍弃，改用standard字段，2026-08-11 SH01改造）
  const dinText = first.din || '';
  const standardText = first.standard || '';
  const matSpecText = first.hasco_mat_spec || '';

  const verifiedCount = variants.filter(v => v.verification_status === 'VERIFIED').length;

  return `
    <div class="result-card rv">
      <a href="/${lang}/products/${esc(slug)}.html" class="card-link">
        <div class="rc-head">
          <div>
            <div class="rc-lia">${esc(categoryCode)}</div>
            <div class="rc-name">${esc(displayName)}</div>
          </div>
          <span class="rc-badge">${esc(categoryCode)}</span>
        </div>
        <div class="rc-specs">
          ${dinText ? `<div class="rc-spec"><div class="rc-spec-key">DIN</div><div class="rc-spec-val">${esc(dinText)}</div></div>` : ''}
          ${standardText ? `<div class="rc-spec"><div class="rc-spec-key">${esc(t.standard)}</div><div class="rc-spec-val">${esc(standardText)}</div></div>` : ''}
          ${!dinText && !standardText ? `<div class="rc-spec"><div class="rc-spec-key">${esc(t.standard)}</div><div class="rc-spec-val">—</div></div>` : ''}
          <div class="rc-spec"><div class="rc-spec-key">${esc(t.lengths)}</div><div class="rc-spec-val">${esc(t.optionsCount(count))}</div></div>
          ${matSpecText ? `<div class="rc-spec" style="text-align:right"><div class="rc-spec-key">Mat.</div><div class="rc-spec-val">${esc(matSpecText)}</div></div>` : ''}
        </div>
        <div class="rc-compat">
          ${verifiedCount > 0 ? `<span class="rcc">${esc(t.crossRefVerified(verifiedCount, count))}</span>` : `<span class="rcc">${esc(t.crossRefPending)}</span>`}
        </div>
        <div class="rc-foot">
          <div>
            <div class="rc-avail">${esc(t.statusLabel)} <span>${esc(t.availableForQuotation)}</span></div>
            <div class="view-detail-hint">${esc(t.viewAllLengths)}</div>
          </div>
        </div>
      </a>
    </div>
  `;
}
// ===== 生成相关分类链接（底部，排除当前分类） =====
// 2026-08-09：DE版优先用cat.slug_de/name_de，缺失时兜底回退英文页面并警告
function generateRelatedCategoryLinks(currentSlug, allCategories, lang) {
  return allCategories
    .filter(cat => cat.seo_slug !== currentSlug)
    .map(cat => {
      const slug = lang === 'de' ? (cat.slug_de || cat.seo_slug) : cat.seo_slug;
      const linkLang = (lang === 'de' && !cat.slug_de) ? 'en' : lang;
      const name = lang === 'de' ? (cat.name_de || cat.name_en) : cat.name_en;
      if (lang === 'de' && !cat.slug_de) {
        console.log(`⚠️ ${cat.seo_slug} 没有配置 slug_de，相关分类链接暂时指向英文页面`);
      }
      return `<li><a href="/${linkLang}/categories/${esc(slug)}.html">${esc(name)}</a></li>`;
    })
    .join('');
}

// ===== 生成顶部"Browse by category"快捷入口（全部分类，含当前分类） =====
function generateCategoryQuicklinks(allCategories, lang) {
  return allCategories
    .map(cat => {
      const slug = lang === 'de' ? (cat.slug_de || cat.seo_slug) : cat.seo_slug;
      const linkLang = (lang === 'de' && !cat.slug_de) ? 'en' : lang;
      const name = lang === 'de' ? (cat.name_de || cat.name_en) : cat.name_en;
      return `<a href="/${linkLang}/categories/${esc(slug)}.html" class="hcat">${esc(name)}</a>`;
    })
    .join('\n    ');
}

// ===== 生成分类页 HTML =====
// 2026-08-09 German rollout：加了lang参数。分类专属内容(name/meta/intro)读category-mapping.json的
// _de字段，缺失时兜底回退英文并警告；界面通用文案读UI_STRINGS；站内其余未做德语版的页面链接暂时
// 仍指向英文版（见文件头注释里的处理原则）
function generateCategoryPage(category, allCategories, products, familyConfig, template, lang) {
  const { seo_slug, name_en, codes, meta_description_en, introduction_en } = category;
  const t = UI_STRINGS[lang];

  let name = name_en;
  let metaDescription = meta_description_en;
  let introduction = introduction_en;
  if (lang === 'de') {
    if (category.name_de) {
      name = category.name_de;
    } else {
      console.log(`⚠️ ${seo_slug} 没有配置 name_de，德语页面暂时显示英文分类名`);
    }
    if (category.meta_description_de) {
      metaDescription = category.meta_description_de;
    } else {
      console.log(`⚠️ ${seo_slug} 没有配置 meta_description_de，德语页面暂时用英文meta description`);
    }
    if (category.introduction_de) {
      introduction = category.introduction_de;
    } else {
      console.log(`⚠️ ${seo_slug} 没有配置 introduction_de，德语页面暂时用英文介绍段落`);
    }
  }

  // 该分类下的产品（按category_code分组，不是逐个SKU）
  const categoryProducts = products.filter(p => codes.includes(p.category_code));
  const productCount = categoryProducts.length;

  // 按 category_code 分组，一个 category_code 一张卡
  const byCode = new Map();
  categoryProducts.forEach(p => {
    if (!byCode.has(p.category_code)) byCode.set(p.category_code, []);
    byCode.get(p.category_code).push(p);
  });

  const familyCards = codes
    .filter(code => byCode.has(code))
    .map(code => generateFamilyCard(code, byCode.get(code), familyConfig, lang))
    .join('');

  const relatedLinks = generateRelatedCategoryLinks(seo_slug, allCategories, lang);
  const quicklinks = generateCategoryQuicklinks(allCategories, lang);

  // meta_description / introduction 兜底（分类名用当前语言的name，句式仍是通用英文句式的简单翻译占位）
  const metaFallback = lang === 'de'
    ? `${name} — kompatibel mit HASCO und Meusburger. Jetzt Angebot anfordern.`
    : `Browse LIAPLIAS's ${name.toLowerCase()} range — HASCO & Meusburger compatible mold standard components. Request a quote today.`;
  const introFallback = lang === 'de'
    ? `LIAPLIAS liefert ${name}, kompatibel mit den wichtigsten europäischen Formnormalien-Systemen, darunter HASCO und Meusburger.`
    : `LIAPLIAS supplies ${name.toLowerCase()} compatible with major European mold standard systems, including HASCO and Meusburger.`;
  metaDescription = metaDescription || metaFallback;
  introduction = introduction || introFallback;

  const seoSlugEn = category.seo_slug;
  const seoSlugDe = category.slug_de || category.seo_slug;
  if (lang === 'de' && !category.slug_de) {
    console.log(`⚠️ ${seo_slug} 没有配置 slug_de，德语页面暂时用英文slug生成: ${seoSlugDe}`);
  }
  const currentSlug = lang === 'de' ? seoSlugDe : seoSlugEn;

  let html = template
    .replace(/\{\{lang\}\}/g, lang)
    .replace(/\{\{category_name\}\}/g, esc(name))
    .replace(/\{\{seo_slug_en\}\}/g, esc(seoSlugEn))
    .replace(/\{\{seo_slug_de\}\}/g, esc(seoSlugDe))
    .replace(/\{\{seo_slug\}\}/g, esc(currentSlug))
    .replace(/\{\{lang_en_active\}\}/g, lang === 'en' ? 'act' : '')
    .replace(/\{\{lang_de_active\}\}/g, lang === 'de' ? 'act' : '')
    .replace(/\{\{meta_description\}\}/g, esc(metaDescription))
    .replace(/\{\{introduction\}\}/g, esc(introduction))
    .replace(/\{\{product_count\}\}/g, productCount)
    .replace(/\{\{product_count_text\}\}/g, esc(t.productCountText(productCount)))
    .replace(/\{\{product_cards\}\}/g, familyCards)
    // 2026-08-13：导航栏/CTA按钮/页脚这3处Code Search链接改用占位符，按语言分流
    .replace(/\{\{code_search_path\}\}/g, lang === 'de' ? '/de/code-search.html' : '/en/code-search.html')
    .replace(/\{\{category_quicklinks\}\}/g, quicklinks)
    // 修复：模板里实际是 related_category_links_bottom（带_bottom），此前正则漏了这个后缀
    .replace(/\{\{related_category_links_bottom\}\}/g, relatedLinks)
    // ===== 界面通用文案（UI_STRINGS） =====
    .replace(/\{\{t_og_suffix\}\}/g, esc(t.ogSuffix))
    .replace(/\{\{t_title_suffix\}\}/g, esc(t.titleSuffix))
    .replace(/\{\{t_home\}\}/g, esc(t.home))
    .replace(/\{\{t_categories\}\}/g, esc(t.categories))
    .replace(/\{\{t_nav_cooperation\}\}/g, esc(t.navCooperation))
    .replace(/\{\{t_nav_industries\}\}/g, esc(t.navIndustries))
    .replace(/\{\{t_nav_code_search\}\}/g, esc(t.navCodeSearch))
    .replace(/\{\{t_nav_solutions\}\}/g, esc(t.navSolutions))
    .replace(/\{\{t_nav_partners\}\}/g, esc(t.navPartners))
    .replace(/\{\{t_nav_contact\}\}/g, esc(t.navContact))
    .replace(/\{\{t_get_quote\}\}/g, esc(t.getQuote))
    .replace(/\{\{t_code_search_hint\}\}/g, t.codeSearchHint) // 含<a>标签，不esc
    .replace(/\{\{t_browse_by_category\}\}/g, esc(t.browseByCategory))
    .replace(/\{\{t_product_range\}\}/g, esc(t.productRange))
    .replace(/\{\{t_browse_prefix\}\}/g, esc(t.browsePrefix))
    .replace(/\{\{t_related_categories\}\}/g, esc(t.relatedCategories))
    .replace(/\{\{t_request_quote\}\}/g, esc(t.requestQuote))
    .replace(/\{\{t_contact_us\}\}/g, esc(t.contactUs))
    .replace(/\{\{t_footer_tagline\}\}/g, esc(t.footerTagline))
    .replace(/\{\{t_operated_by\}\}/g, esc(t.operatedBy))
    .replace(/\{\{t_trademark\}\}/g, esc(t.trademark))
    .replace(/\{\{t_footer_nav_heading\}\}/g, esc(t.footerNavHeading))
    .replace(/\{\{t_footer_legal_heading\}\}/g, esc(t.footerLegalHeading))
    .replace(/\{\{t_privacy_policy\}\}/g, esc(t.privacyPolicy))
    .replace(/\{\{t_terms_of_use\}\}/g, esc(t.termsOfUse))
    .replace(/\{\{t_footer_contact_heading\}\}/g, esc(t.footerContactHeading))
    .replace(/\{\{t_copyright\}\}/g, esc(t.copyright))
    .replace(/\{\{t_rfq_list\}\}/g, esc(t.rfqList))
    .replace(/\{\{t_col_size\}\}/g, esc(t.colSize))
    .replace(/\{\{t_col_code\}\}/g, esc(t.colCode))
    .replace(/\{\{t_col_qty\}\}/g, esc(t.colQty))
    .replace(/\{\{t_rfq_empty\}\}/g, esc(t.rfqEmpty))
    .replace(/\{\{t_contact_required\}\}/g, esc(t.contactRequired))
    .replace(/\{\{t_full_name\}\}/g, esc(t.fullName))
    .replace(/\{\{t_placeholder_name\}\}/g, esc(t.placeholderName))
    .replace(/\{\{t_company_name\}\}/g, esc(t.companyName))
    .replace(/\{\{t_placeholder_company\}\}/g, esc(t.placeholderCompany))
    .replace(/\{\{t_email_address\}\}/g, esc(t.emailAddress))
    .replace(/\{\{t_placeholder_email\}\}/g, esc(t.placeholderEmail))
    .replace(/\{\{t_submit_rfq\}\}/g, esc(t.submitRfq));

  // 清理可能残留的占位符
  html = html
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/```html/g, '')
    .replace(/```/g, '');

  return html;
}

// ===== 主函数 =====
function build() {
  console.log('🚀 LIAPLIAS 分类SEO页面构建开始 (V2)...');

  console.log('📂 读取分类映射:', MAPPING_FILE);
  const categories = readJSON(MAPPING_FILE);

  console.log('📂 读取产品数据 (V2):', PRODUCTS_FILE);
  const productsData = readJSON(PRODUCTS_FILE);
  const products = productsData.products || [];

  console.log('📂 读取 Family 配置:', FAMILY_CONFIG_FILE);
  const familyConfig = readJSON(FAMILY_CONFIG_FILE);

  console.log('📂 读取模板:', TEMPLATE_FILE);
  const template = fs.readFileSync(TEMPLATE_FILE, 'utf-8');

  console.log(`✅ 加载了 ${categories.length} 个分类，${products.length} 个产品`);

  // 提醒：哪些 category_code 目前不属于任何SEO分类（孤儿数据，见此前审计）
  const mappedCodes = new Set(categories.flatMap(c => c.codes));
  const allProductCodes = new Set(products.map(p => p.category_code).filter(Boolean));
  const orphanCodes = [...allProductCodes].filter(code => !mappedCodes.has(code));
  if (orphanCodes.length > 0) {
    console.log(`⚠️ 以下 category_code 有产品数据，但未归入任何SEO分类，不会出现在任何分类页中：${orphanCodes.join(', ')}`);
  }

  let totalGenerated = 0;
  const generatedPages = [];

  Object.entries(OUTPUT_DIR_BY_LANG).forEach(([lang, outputDir]) => {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`📁 创建目录: ${outputDir}`);
    }

    categories.forEach(category => {
      const { seo_slug, name_en, codes } = category;
      const count = products.filter(p => codes.includes(p.category_code)).length;
      const outputSlug = lang === 'de' ? (category.slug_de || seo_slug) : seo_slug;

      const html = generateCategoryPage(category, categories, products, familyConfig, template, lang);
      const filePath = path.join(outputDir, `${outputSlug}.html`);
      fs.writeFileSync(filePath, html, 'utf-8');

      generatedPages.push({ lang, seo_slug: outputSlug, name_en, count, filePath });
      console.log(`  ✅ 生成 [${lang}]: ${outputSlug}.html (${count} 个 SKU)`);
      totalGenerated++;
    });
  });

  console.log(`📄 共生成 ${totalGenerated} 个分类页面`);
  console.log('🎉 构建完成 (V2, EN+DE)!');

  console.log('\n📊 分类统计:');
  generatedPages.forEach(p => {
    console.log(`  [${p.lang}] ${p.name_en}: ${p.count} 个 SKU`);
  });
  generateIndexPage(categories, 'en');
  generateIndexPage(categories, 'de');
  generateIndexPage(categories, 'fr');
  generateIndexPage(categories, 'zh');

}


// ===== 生成首页，更新6个分类链接 =====
function generateIndexPage(allCategories, lang) {
  const filePath = lang === 'de' ? './de/index.html' : `./${lang}/index.html`;
  let html = fs.readFileSync(filePath, 'utf-8');

  let linksHtml = '';
  if (lang === 'en' || lang === 'de') {
    // 英文/德文：文字和链接都从 category-mapping.json 读取
    linksHtml = generateCategoryQuicklinks(allCategories, lang);
  } else {
    // 法文/中文：文字从 category-mapping.json 读取，链接固定指向英文版
    linksHtml = allCategories
      .map(cat => {
        const name = lang === 'fr' ? (cat.name_fr || cat.name_en) : (cat.name_zh || cat.name_en);
        return `<a href="/en/categories/${esc(cat.seo_slug)}.html" class="hcat">${esc(name)}</a>`;
      })
      .join('\n    ');
  }

  const label = lang === 'de' ? 'Kategorien durchsuchen' 
    : lang === 'fr' ? 'Parcourir par catégorie'
    : lang === 'zh' ? '按分类浏览'
    : 'Browse by category';

  const regex = /<div class="hcats">[\s\S]*?<\/div>/;
  const newBlock = `<div class="hcats">\n        <span class="hcats-label">${label}</span>\n        ${linksHtml}\n      </div>`;

  html = html.replace(regex, newBlock);
  fs.writeFileSync(filePath, html, 'utf-8');
  console.log(`✅ 已更新首页: ${filePath}`);
}

build();