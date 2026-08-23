// build-families_v2.js
// LIAPLIAS Family 页面生成脚本 V2
// 读取 products_v2.json，按 category_code 分组
// 适配新字段：spec_display 作为 Size，param*_label/value 作为 Overview
// 运行：node build-families_v2.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== 配置 =====
const PRODUCTS_FILE = './assets/data/products_v2.json';
const FAMILY_CONFIG_FILE = './assets/data/family-config_v2.json';
// 新增（2026-08-08修复）：读取 category-mapping.json，用于运行时查出每个 category_code
// 所属的SEO分类（seo_slug/name），不再依赖 family-config_v2.json 里手动维护的静态副本
const CATEGORY_MAPPING_FILE = './assets/data/category-mapping.json';
// German rollout（2026-08-09）：单一 OUTPUT_DIR 拆成按语言分目录，build() 会对每个语言各跑一遍
const OUTPUT_DIR_BY_LANG = { en: './en/products/', de: './de/products/' };

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

// ===== slug 自动生成（2026-08-13 并入本脚本，替代人工套公式手填 family-config_v2.json） =====
// 公式：{product_name}-{category_code}，全部小写，非字母数字转连字符，德语umlaut转写（ä→ae/ö→oe/ü→ue/ß→ss）
// 已用 SS01/SH01 两个已知category反向验证，算出结果跟线上实际使用的slug完全一致。
const UMLAUT_MAP = { 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss', 'Ä': 'Ae', 'Ö': 'Oe', 'Ü': 'Ue' };

function transliterate(str) {
  return str.replace(/[äöüßÄÖÜ]/g, ch => UMLAUT_MAP[ch] || ch);
}

function slugifyName(name) {
  return transliterate(name)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function generateSlug(productName, categoryCode) {
  if (!productName || !categoryCode) return null;
  return `${slugifyName(productName)}-${categoryCode.toLowerCase()}`;
}

// 只在 family-config_v2.json 里缺 slug_en/slug_de 时才自动算并回填，不覆盖已经人工写好的值
// （比如EP01当年人工选用了简化产品名"Ejector pin"而不是完整的category_name_en，这类人工决策予以保留）
function autoFillSlugs(groups) {
  groups.forEach(family => {
    const config = family.config;
    const firstVariant = family.variants[0] || {};

    if (!config.slug_en) {
      const nameEn = firstVariant.category_name_en || config.name || '';
      const slug = generateSlug(nameEn, family.category_code);
      if (slug) {
        config.slug_en = slug;
        console.log(`🔧 ${family.category_code} 自动生成 slug_en: ${slug}`);
      }
    }

    if (!config.slug_de) {
      const nameDe = (config.translations && config.translations.de && config.translations.de.name) || config.name || '';
      const slug = generateSlug(nameDe, family.category_code);
      if (slug) {
        config.slug_de = slug;
        console.log(`🔧 ${family.category_code} 自动生成 slug_de: ${slug}`);
      }
    }
  });
}

// ===== 构建分类映射表（从 category-mapping.json） =====
// 2026-08-08修复：此函数此前已经写好但从未被调用，category-mapping.json 也从未被读取——
// 导致 Tier1(SEO分类) 和 Tier2(category_code详情页) 之间没有任何运行时关联，
// family-config_v2.json 只能手动硬编码一份 category_path 字符串代替。现在真正接入。
function buildCategoryMap(mapping) {
  const map = new Map();
  mapping.forEach(cat => {
    cat.codes.forEach(code => {
      map.set(code, {
        seo_slug: cat.seo_slug,
        name_en: cat.name_en,
        name_zh: cat.name_zh,
        // German rollout（2026-08-09）：category-mapping.json 目前还没有对应的 /de/categories/ 页面，
        // 这里先加 name_de 只用于德语详情页面包屑/分类标签文字显示；path 暂时始终指向英文分类页——
        // 等"DE分类页"这一步落地后，再回来给这里加 path_de 并让德语详情页改用它
        name_de: cat.name_de || null,
        slug_de: cat.slug_de || null,
        // 直接算好完整路径，调用方不用再自己拼一次 /en/categories/{slug}.html
        path: `/en/categories/${cat.seo_slug}.html`,
        path_de: cat.slug_de ? `/de/categories/${cat.slug_de}.html` : null, 
      });
    });
  });
  return map;
}

// ===== 安全转义 =====
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// German rollout：用于插入到 <script> 标签内的 JS 字符串字面量场景（alert文案等）——
// 跟esc()不同，不做HTML转义，只转义JS字符串本身需要转义的反斜杠/引号，避免破坏JS语法
function escJs(str) {
  if (!str) return '';
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/'/g, "\\'");
}

// ===== 多语言 UI 文案（German rollout, 2026-08-09）=====
// 服务端生成HTML时用来替换页面上的固定文案（表头/按钮/说明文字/占位符等），
// 同时把其中一部分注入给页面内嵌 <script> 在浏览器运行时使用（见 CLIENT_UI，在 generateFamilyHTML 里构造）。
const UI_STRINGS = {
  en: {
    rfqListLabel: 'RFQ List',
    home: 'Home',
    thSelect: 'Select',
    thNo: 'No.',
    thSize: 'Size',
    thLia: 'LIA Code',
    thHasco: 'HASCO Code',
    thMeus: 'Meusburger Code',
    thQty: 'Qty',
    thNote: 'Note',
    selectAllTitle: 'Select All',
    overview: 'Overview',
    compatRef: 'Compatibility Reference',
    compatRefDesc: 'Available sizes with LIAPLIAS codes, HASCO / Meusburger references, and RFQ selection.',
    compatRefCaption: 'Reference only, matched on primary specifications — not an official manufacturer cross-reference. Please verify all dimensions and requirements before ordering.',
    availableForQuotation: '✅ Available for Quotation',
    productFamilyCode: 'Product Family Code:',
    sizesAvailable: (n) => `${n} sizes available`,
    variantsSelected: (n) => `${n} variant${n === 1 ? '' : 's'} selected for RFQ`,
    applyQtyLabel: 'Apply Qty to Selected:',
    applyBtn: 'Apply',
    addToRfq: 'Add to RFQ List',
    viewRfq: 'View RFQ List →',
    techNoticeTitle: 'Technical Information Notice',
    rfqEmpty: 'No items added yet.',
    contactTitle: 'Contact Information (Required)',
    fullName: 'Full Name *',
    companyName: 'Company Name *',
    emailAddress: 'Email Address *',
    submitRfq: 'Submit RFQ',
    submitting: 'Submitting...',
    specialRequirement: 'Special Requirement',
    noteBtnLabel: '📝 Note',
    backToCategory: '← Back to Category',
    backToSearch: '← Back to Search',
    removeTitle: 'Remove',
    fallbackCategoryName: 'Products',
    placeholderName: 'John Doe',
    placeholderCompany: 'Your Company',
    placeholderEmail: 'you@company.com',
    placeholderNote: 'e.g. specific tolerance, alternative surface treatment...',
    alertSelectVariant: 'Please select at least one variant.',
    alertRfqEmpty: 'Your RFQ list is empty.',
    alertEnterName: 'Please enter your contact name.',
    alertEnterEmail: 'Please enter your email address.',
    alertEnterCompany: 'Please enter your company name.',
    submitSuccess: 'Your RFQ has been submitted successfully. Our team will contact you shortly.',
    submitError: 'Sorry, something went wrong submitting your RFQ. Please try again.',
    variantSingular: 'variant',
    variantPlural: 'variants',
    selectedForRfqTail: 'selected for RFQ',
    metaDesc: (displayName, din) => `${displayName} - ${din}, all standard variants with HASCO/Meusburger cross-references`,
    ogDesc: (displayName, din) => `${displayName} - ${din}, all standard variants`,
  },
  de: {
    rfqListLabel: 'RFQ-Liste',
    home: 'Startseite',
    thSelect: 'Auswahl',
    thNo: 'Nr.',
    thSize: 'Größe',
    thLia: 'LIA-Code',
    thHasco: 'HASCO-Code',
    thMeus: 'Meusburger-Code',
    thQty: 'Menge',
    thNote: 'Notiz',
    selectAllTitle: 'Alle auswählen',
    overview: 'Übersicht',
    compatRef: 'Kompatibilitätsreferenz',
    compatRefDesc: 'Verfügbare Größen mit LIAPLIAS-Codes, HASCO-/Meusburger-Referenzen und RFQ-Auswahl.',
    compatRefCaption: 'Nur zur Referenz, abgeglichen anhand der wichtigsten Spezifikationen — keine offizielle Herstellerquerreferenz. Bitte alle Maße und Anforderungen vor der Bestellung überprüfen.',
    availableForQuotation: '✅ Angebot verfügbar',
    productFamilyCode: 'Produktfamilien-Code:',
    sizesAvailable: (n) => `${n} Größen verfügbar`,
    variantsSelected: (n) => `${n} Variante${n === 1 ? '' : 'n'} für Anfrage ausgewählt`,
    applyQtyLabel: 'Menge auf Auswahl anwenden:',
    applyBtn: 'Anwenden',
    addToRfq: 'Zur Anfrageliste hinzufügen',
    viewRfq: 'Anfrageliste ansehen →',
    techNoticeTitle: 'Technischer Hinweis',
    rfqEmpty: 'Noch keine Artikel hinzugefügt.',
    contactTitle: 'Kontaktinformationen (erforderlich)',
    fullName: 'Vollständiger Name *',
    companyName: 'Firmenname *',
    emailAddress: 'E-Mail-Adresse *',
    submitRfq: 'Anfrage senden',
    submitting: 'Wird gesendet...',
    specialRequirement: 'Besondere Anforderung',
    noteBtnLabel: '📝 Notiz',
    backToCategory: '← Zurück zur Kategorie',
    backToSearch: '← Zurück zur Suche',
    removeTitle: 'Entfernen',
    fallbackCategoryName: 'Produkte',
    placeholderName: 'Max Mustermann',
    placeholderCompany: 'Ihr Unternehmen',
    placeholderEmail: 'sie@unternehmen.de',
    placeholderNote: 'z. B. spezifische Toleranz, alternative Oberflächenbehandlung...',
    alertSelectVariant: 'Bitte wählen Sie mindestens eine Variante aus.',
    alertRfqEmpty: 'Ihre Anfrageliste ist leer.',
    alertEnterName: 'Bitte geben Sie Ihren Namen ein.',
    alertEnterEmail: 'Bitte geben Sie Ihre E-Mail-Adresse ein.',
    alertEnterCompany: 'Bitte geben Sie Ihren Firmennamen ein.',
    submitSuccess: 'Ihre Anfrage wurde erfolgreich gesendet. Unser Team wird sich in Kürze bei Ihnen melden.',
    submitError: 'Entschuldigung, beim Senden Ihrer Anfrage ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.',
    variantSingular: 'Variante',
    variantPlural: 'Varianten',
    selectedForRfqTail: 'für Anfrage ausgewählt',
    metaDesc: (displayName, din) => `${displayName} - ${din}, alle Standardvarianten mit HASCO/Meusburger-Querverweisen`,
    ogDesc: (displayName, din) => `${displayName} - ${din}, alle Standardvarianten`,
  },
};

// family-config_v2.json 里少数写死的英文默认文案（如 overview_fields[].emptyText 的默认值）
// 不属于 translations.de 覆盖范围，这里做一个小映射表兜底翻译；找不到映射时原样保留英文，不阻塞构建。
const DEFAULT_TEXT_MAP_DE = {
  'Available options under verification': 'Verfügbare Optionen werden noch geprüft',
};
function translateDefaultText(str, lang) {
  if (lang === 'de' && DEFAULT_TEXT_MAP_DE[str]) return DEFAULT_TEXT_MAP_DE[str];
  return str;
}

// ===== 按 category_code 分组 =====
function groupByCategory(products, familyConfig) {
  const groups = new Map();

  products.forEach(p => {
    const catCode = p.category_code;
    if (!catCode) return;
    if (!familyConfig.families[catCode]) {
      console.log(`⚠️ 跳过 ${catCode}（未在 family-config_v2.json 中配置）`);
      return;
    }
    if (!groups.has(catCode)) {
      groups.set(catCode, {
        category_code: catCode,
        config: familyConfig.families[catCode],
        variants: [],
      });
    }
    groups.get(catCode).variants.push(p);
  });

  return Array.from(groups.values());
}

// ===== 生成 ROWS 数据（用于页面表格） =====
// ===== 按 spec_display 排序 =====
function generateRows(variants) {
  const sorted = [...variants].sort((a, b) => {
    const aSpec = a.spec_display || '';
    const bSpec = b.spec_display || '';
    return aSpec.localeCompare(bSpec, undefined, { numeric: true });
  });
  return sorted.map(v => ({
    spec: v.spec_display || '',
    lia: v.lia_code || '',
    hasco: v.hasco_code || null,
    meus: v.meusburger_code || null,
  }));
}

// ===== 生成 Family 详情页 HTML =====
// 2026-08-08修复：新增 categoryMap 参数，替代此前 config.category_path/config.category_name
// 的硬编码字面值——现在运行时按 category_code 查表得出所属SEO分类信息
function generateFamilyHTML(family, categoryMap, lang) {
  const { category_code, config, variants } = family;
  const t = UI_STRINGS[lang];
  const count = variants.length;
  const rows = generateRows(variants);
  const rowsJson = JSON.stringify(rows, null, 2);

  // German rollout（2026-08-09）：德语页面读取 config.translations.de，缺字段兜底回退到英文字段
  const tr = (config.translations && config.translations[lang]) || {};
  const slug = lang === 'de' ? (config.slug_de || config.slug_en) : (config.slug_en || config.slug);
  const pageUrl = `https://liaplias.com/${lang}/products/${slug}.html`;
  const homeUrl = `https://liaplias.com/${lang}/`;
  const pageTitle = tr.title || config.title;

  // 查出该 category_code 所属的SEO分类（Tier1）信息
  const categoryInfo = categoryMap.get(category_code);
  if (!categoryInfo) {
    console.log(`⚠️ ${category_code} 未在 category-mapping.json 的任何SEO分类中找到，面包屑/返回链接将使用兜底值`);
  }
  // 兜底：如果这个category_code还没被分配到任何SEO分类（比如新加的分类还没来得及归类），
  // 不让整个构建失败，退回到通用的 /en/categories/ 列表页
  // 注意（German rollout）：DE分类页还没生成，所以德语版这里也暂时链接到英文分类页，
  // 只有分类名文字本身按语言切换显示
  let categoryPath = categoryInfo ? categoryInfo.path : '/en/categories/';
if (lang === 'de') {
  if (categoryInfo && categoryInfo.path_de) {
    categoryPath = categoryInfo.path_de;
  } else {
    console.log(`⚠️ ${category_code} 所属分类还没有 path_de（category-mapping.json 缺 slug_de），德语版"返回分类"暂时链接英文分类页`);
    categoryPath = categoryInfo ? categoryInfo.path : '/en/categories/';
  }
}
const categoryDisplayName = categoryInfo
  ? (lang === 'de' ? (categoryInfo.name_de || categoryInfo.name_en) : categoryInfo.name_en)
  : t.fallbackCategoryName;

  // 从第一个产品获取数据
  const firstVariant = variants[0] || {};
  const categoryName = firstVariant.category_name_en || config.name || '';
  const sizeFormat = firstVariant.size_format || '';
  const din = firstVariant.din || '';
  const iso = firstVariant.iso || '';

  // 构建 din/iso 显示
  let standardDisplay = '—';
  if (din && iso) {
    standardDisplay = `${din} / ${iso}`;
  } else if (din) {
    standardDisplay = din;
  } else if (iso) {
    standardDisplay = iso;
  }

  // 构建 tech_sub
  let techSub = '';
  if (sizeFormat && din && iso) {
    techSub = `${sizeFormat} · ${din} / ${iso} · ${t.sizesAvailable(count)}`;
  } else if (sizeFormat && (din || iso)) {
    const standard = din || iso;
    techSub = `${sizeFormat} · ${standard} · ${t.sizesAvailable(count)}`;
  } else if (sizeFormat) {
    techSub = `${sizeFormat} · ${t.sizesAvailable(count)}`;
  } else {
    techSub = t.sizesAvailable(count);
  }

  // 使用 category_name_en 替代 config.name 和 config.h1（英文行为不变）
  // German rollout：德语没有对应的 category_name_de 数据库字段，优先用 translations.de.name/h1
  const displayName = lang === 'de' ? (tr.name || config.name || categoryName || '') : (categoryName || config.name || '');
  const displayH1 = lang === 'de' ? (tr.h1 || config.h1 || categoryName || '') : (categoryName || config.h1 || '');

  // ===== Overview 卡片：2026-08-09修复 =====
  // 此前这里是4张写死的卡片（Size Format/Standard/Material/Surface Treatment），
  // config.overview_fields 从未被读取（连config.din/config.tech_sub也是死字段，同批修复）。
  // 现在真正读取 family-config_v2.json 的 overview_fields 配置，pending 状态也改成
  // 按真实数据是否存在动态判断，不再无条件写死 pending:true。
  //
  // 注意：Thread等"每行会变化的参数"（如SS01的螺纹规格M4~M16）不适合放在这里——
  // 一个family可能包含上百种不同的该参数值，Overview区只能取第一条代表全部，
  // 跟"Diameter不该出现在Family卡片"是同一个问题，这类参数只应出现在下方的
  // 逐行 Compatibility Reference 表格里（已经通过 spec_display 完整展示）。
  const computedFieldValues = {
    standard: standardDisplay,
    size_format: sizeFormat,
  };
  function getOverviewFieldValue(source) {
    if (source in computedFieldValues) return computedFieldValues[source];
    return firstVariant[source] || '';
  }
  const overviewCards = (config.overview_fields || []).map(field => {
    const rawValue = getOverviewFieldValue(field.source);
    const hasValue = !!rawValue && rawValue !== '—';
    // German rollout：label 从 translations.de.overview_fields_labels 按英文label查德语译名，查不到就保留英文
    const label = (lang === 'de' && tr.overview_fields_labels && tr.overview_fields_labels[field.label]) || field.label;
    const emptyText = translateDefaultText(field.emptyText || 'Available options under verification', lang);
    return {
      label,
      value: hasValue ? rawValue : emptyText,
      pending: !hasValue,
    };
  }).map(card => `
      <div class="overview-card">
        <div class="label">${esc(card.label)}</div>
        <div class="value${card.pending ? ' pending' : ''}">${esc(card.value)}</div>
      </div>
    `).join('');

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(pageTitle)}</title>
  <meta name="description" content="${esc(t.metaDesc(displayName, din || ''))}">
  <meta name="robots" content="index, follow">
  <meta property="og:title" content="${esc(pageTitle)}">
  <meta property="og:description" content="${esc(t.ogDesc(displayName, din || ''))}">
  <meta property="og:type" content="product.group">
  <meta property="og:url" content="${pageUrl}">
  <meta property="og:site_name" content="LIAPLIAS">
  <link rel="canonical" href="${pageUrl}">
  <link rel="alternate" hreflang="en" href="https://liaplias.com/en/products/${config.slug_en}.html">
  <link rel="alternate" hreflang="de" href="https://liaplias.com/de/products/${config.slug_de}.html">
  <link rel="alternate" hreflang="x-default" href="https://liaplias.com/en/products/${config.slug_en}.html">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org/",
    "@type": "ProductGroup",
    "name": "${esc(category_code)}",
    "description": "${esc(displayName)} - ${esc(din || '')}",
    "productGroupID": "${esc(category_code)}",
    "brand": { "@type": "Brand", "name": "LIAPLIAS" },
    "seller": { "@type": "Organization", "name": "LIAPLIAS", "url": "https://liaplias.com" },
    "category": "${esc(categoryDisplayName)}",
    "variesBy": ["https://schema.org/width"],
    "hasVariant": [
      ${variants.map(v => `{ "@type": "Product", "sku": "${esc(v.lia_code)}", "mpn": "${esc(v.lia_code)}", "name": "${esc(displayName)} ${esc(v.spec_display || '')}" }`).join(',\n      ')}
    ]
  }
  </script>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "${esc(t.home)}", "item": "${homeUrl}" },
      { "@type": "ListItem", "position": 2, "name": "${esc(categoryDisplayName)}", "item": "https://liaplias.com${categoryPath}" },
      { "@type": "ListItem", "position": 3, "name": "${esc(category_code)}", "item": "${pageUrl}" }
    ]
  }
  </script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif; line-height: 1.6; color: #1a2a3a; background: #f0f4f9; }
    .container { max-width: 1100px; margin: 0 auto; padding: 2rem 1.5rem 5rem; }
    .topbar { position: sticky; top: 0; z-index: 20; background: #0a1a2a; color: #fff; }
    .topbar-inner { max-width: 1100px; margin: 0 auto; padding: 0.7rem 1.5rem; display: flex; justify-content: flex-end; align-items: center; gap: 1rem; }
    .rfq-counter { background: #0052a0; padding: 0.4rem 1rem; border-radius: 20px; font-size: 0.85rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 0.4rem; }
    .product-card { background: #ffffff; border-radius: 16px; padding: 1.5rem 2rem; box-shadow: 0 4px 20px rgba(0,0,0,0.06); margin-bottom: 1.5rem; }
    .product-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; border-bottom: 2px solid #e8edf4; padding-bottom: 1.5rem; margin-bottom: 1.5rem; }
    .product-sub { font-size: 1rem; color: #5a6a7a; margin-top: 0.2rem; }
    .product-meta { display: flex; flex-wrap: wrap; gap: 0.5rem 1.2rem; margin-top: 0.6rem; }
    .product-meta span { font-size: 0.85rem; color: #5a6a7a; }
    .product-meta .category-tag { background: #e8edf4; padding: 0.15rem 0.8rem; border-radius: 20px; color: #2a4a6a; }
    .status-badge { display: inline-block; padding: 0.15rem 0.8rem; border-radius: 20px; font-size: 0.8rem; font-weight: 500; background: #d4edda; color: #155724; }
    .quote-btn { background: #0052a0; color: white; border: none; padding: 0.7rem 2rem; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; transition: background 0.2s, transform 0.1s; text-decoration: none; display: inline-block; white-space: nowrap; }
    .quote-btn:hover { background: #003d7a; transform: translateY(-1px); }
    .quote-btn:disabled { background: #b7c0ca; cursor: not-allowed; transform: none; }
    .section-title { font-size: 1.05rem; font-weight: 600; color: #1a2a3a; margin: 1rem 0 0.5rem 0; padding-bottom: 0.25rem; border-bottom: 2px solid #e8edf4; }
    .section-title:first-of-type { margin-top: 0; }
    .overview-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0.6rem; }
    .overview-card { background: #f5f8fc; border-radius: 10px; padding: 0.6rem 1rem; }
    .overview-card .label { font-size: 0.72rem; color: #5a6a7a; margin-bottom: 0.15rem; }
    .overview-card .value { font-size: 1rem; font-weight: 600; color: #0a1a2a; }
    .overview-card .value.pending { font-size: 0.78rem; font-weight: 500; color: #b98900; font-style: italic; }
    table.length-table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 0.9rem; }
    table.length-table th, table.length-table td { text-align: left; padding: 0.6rem 0.6rem; border-bottom: 1px solid #eef2f7; vertical-align: middle; }
table.length-table thead th { background: #f5f8fc; font-weight: 600; color: #2a4a6a; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.03em; position: sticky; top: 0; z-index: 10; }
    table.length-table tbody tr:hover { background: #fafcfe; }
    .lia-code-cell { font-family: 'SFMono-Regular', Consolas, monospace; font-size: 0.82rem; color: #0a1a2a; }
    .dash { color: #b7c0ca; }
    .qty-input { width: 60px; padding: 0.3rem 0.4rem; border: 1px solid #d0d8e0; border-radius: 6px; font-size: 0.85rem; }
    .note-btn { background: none; border: none; color: #0052a0; font-size: 0.8rem; cursor: pointer; text-decoration: underline; padding: 0; }
    .note-row td { border-bottom: 1px solid #eef2f7; background: #fafcfe; padding: 0.4rem 0.6rem 0.8rem; }
    .note-row textarea { width: 100%; min-height: 40px; border: 1px solid #d0d8e0; border-radius: 6px; padding: 0.4rem 0.6rem; font-size: 0.85rem; font-family: inherit; resize: vertical; }
    .note-row { display: none; }
    .note-row.open { display: table-row; }
    tr.selected { background: #eef6ff; }
    .verification-note { color: #6c757d; font-size: 0.9rem; font-style: italic; padding: 8px 12px; background-color: #f8f9fa; border-left: 3px solid #ffc107; border-radius: 4px; margin-top: 1rem; }
    .tech-notice { background: #f5f8fc; border: 1px solid #e0e7f0; border-radius: 10px; padding: 1rem 1.2rem; margin-top: 1.5rem; font-size: 0.88rem; color: #4a5a6a; }
    .tech-notice-title { font-weight: 600; color: #2a4a6a; margin-bottom: 0.3rem; font-size: 0.85rem; }
    .qty-step-btn { width: 22px; height: 22px; border: 1px solid #d0d8e0; background: #fff; border-radius: 4px; cursor: pointer; font-size: 0.9rem; line-height: 1; color: #2a4a6a; }
    .qty-step-btn:hover { background: #f0f4f9; }
    .note-btn-bordered { border: 1px solid #0052a0; border-radius: 6px; padding: 0.25rem 0.6rem; text-decoration: none; }
    .table-actions { display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; flex-wrap: wrap; gap: 0.6rem; }
    .selected-count { font-size: 0.85rem; color: #5a6a7a; }
    .back-links { display: flex; flex-direction: column; gap: 0.25rem; margin-bottom: 1.5rem; }
    .back-link-category { color: #00d4ff; text-decoration: none; font-size: 0.95rem; font-weight: 500; }
    .back-link-category:hover { color: #0a1a2a; }
    .back-link-search { color: #2d7fff; text-decoration: none; font-size: 0.95rem; }
    .back-link-search:hover { color: #0a1a2a; }
    .rfq-panel { position: fixed; top: 0; right: -440px; width: 440px; height: 100%; background: #fff; box-shadow: -4px 0 20px rgba(0,0,0,0.15); z-index: 30; transition: right 0.25s ease; padding: 1.5rem; overflow-y: auto; box-sizing: border-box; }
    .rfq-panel.open { right: 0; }
    .rfq-panel-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
    .rfq-panel-header h3 { margin: 0; font-size: 1.05rem; font-weight: 700; color: #0a1a2a; }
    .rfq-close { background: none; border: none; font-size: 1.4rem; line-height: 1; color: #5a6a7a; cursor: pointer; padding: 0.2rem 0.4rem; border-radius: 4px; }
    .rfq-close:hover { background: #f1f4f7; color: #0a1a2a; }
    .rfq-list-header {
  display: grid;
  grid-template-columns: 56px minmax(100px, 160px) 72px 28px;
  gap: 0.8rem;
  align-items: center;
  padding: 0 0.3rem 0.3rem;
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #8b9bbb;
  border-bottom: 1px solid #e5e7eb;
}
    #rfqItems { max-height: 260px; overflow-y: auto; margin-bottom: 0.5rem; }
    .rfq-empty { font-size: 0.85rem; color: #8b9bbb; padding: 1rem 0.4rem; text-align: center; margin: 0; }
    .rfq-item-row {
  display: grid;
  grid-template-columns: 56px minmax(100px, 160px) 72px 28px;
  gap: 0.8rem;
  align-items: center;
  padding: 0.4rem 0.3rem;
  border-bottom: 1px solid #f0f2f5;
  font-size: 0.8rem;
}
    .rfq-item-row:last-child { border-bottom: none; }
    .rfq-col-size { color: #5a6a7a; text-align: center; font-variant-numeric: tabular-nums; }
    .rfq-col-code { color: #0a1a2a; font-weight: 500; white-space: nowrap; }
.rfq-col-qty {
  text-align: center;
  color: #0a1a2a;
  font-variant-numeric: tabular-nums;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 72px;
  gap: 10px;
}
    .rfq-col-remove { background: none; border: none; color: #b0bac6; font-size: 1.1rem; line-height: 1; cursor: pointer; padding: 0; }
    .rfq-col-remove:hover { color: #d64545; }
    .rfq-contact-block { margin-top: 1.25rem; border-top: 1px solid #e5e7eb; padding-top: 1rem; }
    .rfq-contact-title { font-weight: 600; margin: 0 0 10px 0; font-size: 0.85rem; color: #0a1a2a; }
    .rfq-field-label { display: block; margin-bottom: 10px; font-size: 0.8rem; color: #5a6a7a; }
    .rfq-field-label-last { margin-bottom: 4px; }
    .rfq-field-input { width: 100%; margin-top: 4px; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; font-size: 0.85rem; }
    .rfq-field-input:focus { outline: none; border-color: #0052a0; box-shadow: 0 0 0 2px rgba(0, 82, 160, 0.12); }
    .rfq-submit-wrap { margin-top: 1.25rem; }
    @media (max-width: 768px) {
      .product-header { flex-direction: column; }
      .overview-grid { grid-template-columns: 1fr 1fr; }
      .product-card { padding: 1.5rem; }
      .product-sku { font-size: 1.4rem; }
      .quote-btn { width: 100%; text-align: center; }
      table.length-table { font-size: 0.78rem; }
      table.length-table th, table.length-table td { padding: 0.45rem 0.3rem; }
      .qty-input { width: 45px; }
      .rfq-panel { width: 90%; right: -100%; }
    }
    @media (max-width: 480px) {
      .rfq-panel { width: 100vw; max-width: 100vw; }
      .rfq-list-header,
      .rfq-item-row { grid-template-columns: 56px 1fr 78px 24px; font-size: 0.78rem; }
    }
  </style>
</head>
<body>
  <div class="topbar">
    <div class="topbar-inner">
      <div class="rfq-counter" onclick="toggleRfqPanel()">🛒 ${esc(t.rfqListLabel)} (<span id="rfqCount">0</span>)</div>
    </div>
  </div>

  <div class="rfq-panel" id="rfqPanel">
    <div class="rfq-panel-header">
      <h3>${esc(t.rfqListLabel)}</h3>
      <button class="rfq-close" onclick="toggleRfqPanel()">&times;</button>
    </div>

    <div class="rfq-list-header">
      <span class="rfq-col-size">${esc(t.thSize)}</span>
      <span class="rfq-col-code">${esc(t.thLia)}</span>
      <span class="rfq-col-qty">${esc(t.thQty)}</span>
      <span class="rfq-col-remove"></span>
    </div>

    <div id="rfqItems"><p class="rfq-empty">${esc(t.rfqEmpty)}</p></div>

    <div class="rfq-contact-block">
      <p class="rfq-contact-title">${esc(t.contactTitle)}</p>
      <label class="rfq-field-label">
        ${esc(t.fullName)}
        <input type="text" id="rfqName" placeholder="${esc(t.placeholderName)}" class="rfq-field-input">
      </label>
      <label class="rfq-field-label">
        ${esc(t.companyName)}
        <input type="text" id="rfqCompany" placeholder="${esc(t.placeholderCompany)}" class="rfq-field-input">
      </label>
      <label class="rfq-field-label rfq-field-label-last">
        ${esc(t.emailAddress)}
        <input type="email" id="rfqEmail" placeholder="${esc(t.placeholderEmail)}" class="rfq-field-input">
      </label>
    </div>

    <div class="rfq-submit-wrap">
      <a href="#" class="quote-btn" style="width:100%;text-align:center;display:block;" id="submitRfqBtn">${esc(t.submitRfq)}</a>
    </div>
  </div>

  <div class="container">
    <div class="back-links">
      <div class="back-link-row"><a href="${categoryPath}" class="back-link-category">${esc(t.backToCategory)}</a></div>
      <div class="back-link-row"><a href="/${lang}/code-search.html" class="back-link-search">${esc(t.backToSearch)}</a></div>
    </div>

    <div class="product-card">
      <div class="product-header">
        <div>
          <div class="product-meta" style="margin-top:0;margin-bottom:0.4rem;">
            <span class="category-tag">${esc(displayName)}</span>
            <span class="status-badge">${esc(t.availableForQuotation)}</span>
          </div>
          <h1 style="font-size:1.8rem;font-weight:700;color:#0a1a2a;letter-spacing:-0.02em;">${esc(displayH1)}</h1>
          <div class="product-sub" style="font-size:1rem;font-weight:500;color:#2a4a6a;margin-top:0.2rem;">${esc(t.productFamilyCode)} ${esc(category_code)}</div>
          <div class="product-sub" style="font-size:0.95rem;color:#5a6a7a;margin-top:0.1rem;">${esc(techSub)}</div>
        </div>
      </div>

      <h2 class="section-title">${esc(t.overview)}</h2>
      <div class="overview-grid">
        ${overviewCards}
      </div>

      <h2 class="section-title">${esc(t.compatRef)}</h2>
      <p style="font-size:0.9rem;color:#5a6a7a;margin:-0.2rem 0 0.3rem;">${esc(t.compatRefDesc)}</p>
      <p class="ref-caption" style="font-size:0.8rem;color:#6b7785;margin:0 0 0.8rem;">${esc(t.compatRefCaption)}</p>

<div style="max-height:68vh;overflow-y:auto;border:1px solid #eef2f7;border-radius:8px;">
  <table class="length-table" id="variantTable" style="border-collapse:separate;border-spacing:0;">
    <thead>
      <tr>
        <th style="width:44px;text-align:center;position:sticky;top:0;z-index:10;background:#f5f8fc;border-bottom:2px solid #e8edf4;">${esc(t.thSelect)}<br><input type="checkbox" id="selectAll" onchange="toggleAll(this)" title="${esc(t.selectAllTitle)}"></th>
        <th style="width:38px;text-align:center;position:sticky;top:0;z-index:10;background:#f5f8fc;border-bottom:2px solid #e8edf4;">${esc(t.thNo)}</th>
        <th style="width:120px;text-align:center;position:sticky;top:0;z-index:10;background:#f5f8fc;border-bottom:2px solid #e8edf4;">${esc(t.thSize)}</th>
        <th style="min-width:120px;position:sticky;top:0;z-index:10;background:#f5f8fc;border-bottom:2px solid #e8edf4;">${esc(t.thLia)}</th>
        <th style="min-width:100px;position:sticky;top:0;z-index:10;background:#f5f8fc;border-bottom:2px solid #e8edf4;">${esc(t.thHasco)}</th>
        <th style="min-width:110px;position:sticky;top:0;z-index:10;background:#f5f8fc;border-bottom:2px solid #e8edf4;">${esc(t.thMeus)}</th>
        <th style="width:120px;text-align:center;position:sticky;top:0;z-index:10;background:#f5f8fc;border-bottom:2px solid #e8edf4;">${esc(t.thQty)}</th>
        <th style="width:60px;text-align:center;position:sticky;top:0;z-index:10;background:#f5f8fc;border-bottom:2px solid #e8edf4;">${esc(t.thNote)}</th>
      </tr>
    </thead>
    <tbody id="variantTbody"></tbody>
  </table>
</div>

      <div class="table-actions">
        <span class="selected-count" id="selectedCount">${esc(t.variantsSelected(0))}</span>
        <div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;">
          <span style="font-size:0.82rem;color:#5a6a7a;">${esc(t.applyQtyLabel)}</span>
          <input type="number" min="1" value="1" id="bulkQty" style="width:55px;padding:0.3rem 0.4rem;border:1px solid #d0d8e0;border-radius:6px;font-size:0.85rem;">
          <button class="note-btn" style="border:1px solid #0052a0;border-radius:6px;padding:0.3rem 0.7rem;" onclick="applyQtyToSelected()">${esc(t.applyBtn)}</button>
          <button class="quote-btn" id="addToRfqBtn" onclick="addSelectedToRfq()">${esc(t.addToRfq)}</button>
          <a href="#" onclick="toggleRfqPanel(true);return false;" style="font-size:0.82rem;color:#0052a0;">${esc(t.viewRfq)}</a>
        </div>
      </div>

      <div class="tech-notice">
        <div class="tech-notice-title">${esc(t.techNoticeTitle)}</div>
        <div>${(tr.notice || config.notice).map(esc).join('<br>')}</div>
      </div>
    </div>
  </div>

<script>
const LANG = "${lang}";
const ROWS = ${rowsJson};

const tbody = document.getElementById("variantTbody");
ROWS.forEach((r, i) => {
  const tr = document.createElement("tr");
  tr.dataset.idx = i;
  tr.innerHTML = \`
    <td style="text-align:center;"><input type="checkbox" class="rowSelect" onchange="onRowToggle(\${i})"></td>
    <td style="text-align:center;color:#8b9bbb;font-size:0.8rem;">\${i + 1}</td>
    <td style="text-align:center;">\${r.spec}</td>
    <td class="lia-code-cell">\${r.lia}</td>
    <td>\${r.hasco ?? '<span class="dash">—</span>'}</td>
    <td>\${r.meus ?? '<span class="dash">—</span>'}</td>
<td style="text-align:center;padding-left:0.2rem;padding-right:0.2rem;">
  <span class="qty-placeholder dash" id="qty-placeholder-\${i}">—</span>
<span class="qty-placeholder dash" id="qty-placeholder-\${i}">—</span>
<div class="qty-stepper" id="qty-stepper-\${i}" style="display:none;align-items:center;justify-content:center;gap:0.15rem;">
  <button type="button" class="qty-step-btn" onclick="stepQty(\${i},-1)">−</button>
  <input type="number" min="1" value="1" class="qty-input" id="qty-\${i}" style="width:60px;text-align:center;padding:0.2rem;">
  <button type="button" class="qty-step-btn" onclick="stepQty(\${i},1)">+</button>
  <button type="button" class="qty-step-btn" onclick="clearQty(\${i})" style="color:#d64545;">×</button>
</div>
</td>
    <td style="text-align:center;"><button class="note-btn note-btn-bordered" onclick="toggleNote(\${i})" style="font-size:0.65rem;padding:0.1rem 0.4rem;">${esc(t.noteBtnLabel)}</button></td>\`;
  tbody.appendChild(tr);

  const noteTr = document.createElement("tr");
  noteTr.className = "note-row";
  noteTr.id = \`note-row-\${i}\`;
  noteTr.innerHTML = \`<td></td><td colspan="7"><label style="font-size:0.78rem;color:#5a6a7a;display:block;margin-bottom:0.2rem;">${esc(t.specialRequirement)}</label><textarea placeholder="${esc(t.placeholderNote)}" id="note-\${i}"></textarea></td>\`;
  tbody.appendChild(noteTr);
});

function toggleNote(i) {
  document.getElementById(\`note-row-\${i}\`).classList.toggle("open");
}
function toggleAll(cb) {
  document.querySelectorAll(".rowSelect").forEach((el, i) => { el.checked = cb.checked; onRowToggle(i, false); });
  updateSelectedCount();
}
document.addEventListener("DOMContentLoaded", () => {
  const sa = document.getElementById("selectAll");
  if (sa) sa.parentElement.style.textAlign = "center";
});
function onRowToggle(i, updateCount = true) {
  const tr = document.querySelector(\`tr[data-idx="\${i}"]\`);
  const checked = document.querySelectorAll(".rowSelect")[i].checked;
  tr.classList.toggle("selected", checked);
  document.getElementById(\`qty-placeholder-\${i}\`).style.display = checked ? "none" : "inline";
  document.getElementById(\`qty-stepper-\${i}\`).style.display = checked ? "flex" : "none";
  if (updateCount) updateSelectedCount();
}
function stepQty(i, delta) {
  const input = document.getElementById(\`qty-\${i}\`);
  const next = Math.max(1, (parseInt(input.value, 10) || 1) + delta);
  input.value = next;
}
function clearQty(i) {
  document.getElementById(\`qty-\${i}\`).value = 0;
}

function applyQtyToSelected() {
  const bulk = parseInt(document.getElementById("bulkQty").value, 10) || 1;
  document.querySelectorAll(".rowSelect:checked").forEach((el, idx) => {
    const i = [...document.querySelectorAll(".rowSelect")].indexOf(el);
    document.getElementById(\`qty-\${i}\`).value = bulk;
  });
}
function variantsSelectedText(n) {
  if (LANG === "de") return \`\${n} Variante\${n === 1 ? "" : "n"} für Anfrage ausgewählt\`;
  return \`\${n} variant\${n === 1 ? "" : "s"} selected for RFQ\`;
}
function updateSelectedCount() {
  const n = document.querySelectorAll(".rowSelect:checked").length;
  document.getElementById("selectedCount").textContent = variantsSelectedText(n);
}
document.querySelectorAll(".rowSelect").forEach((el, i) => el.addEventListener("change", () => onRowToggle(i)));

const RFQ_STORAGE_KEY = "liaplias_rfq_list";

function getRFQ() {
  try {
    const raw = localStorage.getItem(RFQ_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) { return []; }
}

function saveRFQ(list) {
  try {
    localStorage.setItem(RFQ_STORAGE_KEY, JSON.stringify(list));
  } catch (err) { console.error(err); }
  renderRfqPanel();
}

function addRFQ(liaCode, qty, note, size) {
  if (!liaCode) return;
  const quantity = Number(qty) > 0 ? Number(qty) : 1;
  const list = getRFQ();
  const existing = list.find((item) => item.liaCode === liaCode);
  if (existing) {
    existing.qty += quantity;
    if (note) existing.note = note;
    if (size) existing.size = size;
  } else {
    list.push({ liaCode: liaCode, qty: quantity, note: note || "", size: size || "" });
  }
  saveRFQ(list);
}

function removeRFQ(liaCode) {
  const list = getRFQ().filter((item) => item.liaCode !== liaCode);
  saveRFQ(list);
}

function clearRFQ() {
  localStorage.removeItem(RFQ_STORAGE_KEY);
  renderRfqPanel();
}

function escRfq(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function renderRfqPanel() {
  const container = document.getElementById("rfqItems");
  if (!container) return;

  const list = getRFQ();
  document.getElementById("rfqCount").textContent = list.length;

  if (list.length === 0) {
    container.innerHTML = '<p class="rfq-empty">${escJs(t.rfqEmpty)}</p>';
    return;
  }

  container.innerHTML = list.map((item) => \`
    <div class="rfq-item-row">
      <span class="rfq-col-size">\${item.size || "—"}</span>
      <span class="rfq-col-code">\${escRfq(item.liaCode)}</span>
      <span class="rfq-col-qty" style="display:flex;align-items:center;gap:4px;">
        <button type="button" style="border:1px solid #ccc;background:#f5f5f5;border-radius:4px;padding:0 6px;cursor:pointer;" onclick="updateSidebarQty('\${item.liaCode}', -1)">−</button>
        <input type="number" min="1" id="qty-sidebar-\${item.liaCode}" value="\${escRfq(item.qty)}" style="width:50px;text-align:center;padding:2px;border:1px solid #ddd;border-radius:4px;font-size:14px;" onchange="updateSidebarQtyInput('\${item.liaCode}')">
        <button type="button" style="border:1px solid #ccc;background:#f5f5f5;border-radius:4px;padding:0 6px;cursor:pointer;" onclick="updateSidebarQty('\${item.liaCode}', 1)">+</button>
      </span>
      <button type="button" class="rfq-col-remove" title="${escJs(t.removeTitle)}"
        onclick="removeRFQ('\${escRfq(item.liaCode)}')">&times;</button>
    </div>
  \`).join("");
}

document.addEventListener("DOMContentLoaded", renderRfqPanel);

function addSelectedToRfq() {
  const selectedCount = document.querySelectorAll(".rowSelect:checked").length;
  if (selectedCount === 0) {
    alert("${escJs(t.alertSelectVariant)}");
    return;
  }

  document.querySelectorAll(".rowSelect:checked").forEach((el, idx) => {
    const i = [...document.querySelectorAll(".rowSelect")].indexOf(el);
    const r = ROWS[i];
    const qty = document.getElementById("qty-" + i).value || 1;
    const note = document.getElementById("note-" + i).value || "";
    addRFQ(r.lia, qty, note, r.spec);
  });

  toggleRfqPanel(true);
}
async function submitRFQ() {
  const list = getRFQ();
  if (list.length === 0) {
    alert("${escJs(t.alertRfqEmpty)}");
    return;
  }

  const nameInput = document.getElementById("rfqName");
  const emailInput = document.getElementById("rfqEmail");
  const companyInput = document.getElementById("rfqCompany");

  const contactName = nameInput ? nameInput.value.trim() : "";
  const inquiryEmail = emailInput ? emailInput.value.trim() : "";
  const inquiryCompany = companyInput ? companyInput.value.trim() : "";

  if (!contactName) {
    alert("${escJs(t.alertEnterName)}");
    return;
  }
  if (!inquiryEmail) {
    alert("${escJs(t.alertEnterEmail)}");
    return;
  }
  if (!inquiryCompany) {
    alert("${escJs(t.alertEnterCompany)}");
    return;
  }

  const submitBtn = document.getElementById("submitRfqBtn");
  const originalBtnText = submitBtn ? submitBtn.innerText : "${escJs(t.submitRfq)}";
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = "${escJs(t.submitting)}";
  }

  const payload = {
    contact: contactName,
    email: inquiryEmail,
    company: inquiryCompany,
    items: list.map((item) => ({
      lia_code: item.liaCode,
      quantity: item.qty,
      note: item.note || "",
    })),
  };

  try {
    const response = await fetch("https://api.liaplias.com/api/rfq", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    let result = {};
    try {
      result = await response.json();
    } catch (parseError) {}

    if (response.ok || response.status === 200 || response.status === 201 || result.success === true) {
      clearRFQ();
      const panel = document.getElementById("rfqPanel");
      if (panel) panel.classList.remove("open");
      alert("${escJs(t.submitSuccess)}");
    } else {
      throw new Error(result.error || 'Server error');
    }

  } catch (err) {
    console.error("[submitRFQ] failed:", err);
    alert("${escJs(t.submitError)}");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = originalBtnText;
    }
  }
}

function toggleRfqPanel(forceOpen) {
  const panel = document.getElementById("rfqPanel");
  if (forceOpen === true) panel.classList.add("open");
  else if (forceOpen === false) panel.classList.remove("open");
  else panel.classList.toggle("open");
}

document.addEventListener("DOMContentLoaded", () => {
  renderRfqPanel();
});

document.getElementById("submitRfqBtn").addEventListener("click", function(e) {
  e.preventDefault();
  submitRFQ();
});

(function highlightMatchedRows() {
  const params = new URLSearchParams(window.location.search);
  const lParam = params.get('l');
  if (!lParam) return;

  const targetLengths = lParam.split(',').map(s => s.trim());
  let firstMatchRow = null;

  ROWS.forEach((r, i) => {
    if (targetLengths.includes(String(r.l))) {
      const tr = document.querySelector(\`#variantTbody tr[data-idx="\${i}"]\`);
      if (tr) {
        tr.style.background = 'rgba(0,212,255,.12)';
        tr.style.outline = '2px solid #00d4ff';
        tr.style.outlineOffset = '-2px';
        if (!firstMatchRow) firstMatchRow = tr;
      }
    }
  });

  if (firstMatchRow) {
    setTimeout(() => {
      firstMatchRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
  }
})();

function updateSidebarQty(liaCode, delta) {
  const list = getRFQ();
  const item = list.find(i => i.liaCode === liaCode);
  if (item) {
    item.qty = Math.max(1, item.qty + delta);
    saveRFQ(list);
    const input = document.getElementById("qty-sidebar-" + liaCode);
    if (input) input.value = item.qty;
  }
}

function updateSidebarQtyInput(liaCode) {
  const list = getRFQ();
  const item = list.find(i => i.liaCode === liaCode);
  const input = document.getElementById("qty-sidebar-" + liaCode);
  if (item && input) {
    let val = parseInt(input.value, 10);
    if (isNaN(val) || val < 1) val = 1;
    item.qty = val;
    saveRFQ(list);
  }
}
</script>
</body>
</html>`;
}

// ===== 主函数 =====
function build() {
  console.log('🚀 LIAPLIAS Family 页面生成开始 (V2)...');
  const productsData = readJSON(PRODUCTS_FILE);
  const products = productsData.products || [];
  console.log(`✅ 加载了 ${products.length} 个 SKU`);

  const familyConfig = readJSON(FAMILY_CONFIG_FILE);
  const familyKeys = Object.keys(familyConfig.families || {});
  console.log(`✅ 加载了 ${familyKeys.length} 个 Family 配置: ${familyKeys.join(', ')}`);

  // 2026-08-08修复：读取 category-mapping.json 并建立 category_code → SEO分类 的查询表
  console.log('📂 读取分类映射:', CATEGORY_MAPPING_FILE);
  const categoryMapping = readJSON(CATEGORY_MAPPING_FILE);
  const categoryMap = buildCategoryMap(categoryMapping);
  console.log(`✅ 建立了 ${categoryMap.size} 个 category_code 的SEO分类映射`);

  const groups = groupByCategory(products, familyConfig);
  console.log(`📋 共 ${groups.length} 个 Family 需要生成`);

  // 自动回填缺失的 slug_en/slug_de（不覆盖已有值）
  autoFillSlugs(groups);

  // German rollout（2026-08-09）：按语言各生成一遍，输出到各自目录
  let generated = 0;
  Object.entries(OUTPUT_DIR_BY_LANG).forEach(([lang, outputDir]) => {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
      console.log(`📁 创建目录: ${outputDir}`);
    }

    groups.forEach(family => {
      const slug = lang === 'de' ? (family.config.slug_de || family.config.slug_en) : family.config.slug_en;
      if (lang === 'de' && !family.config.slug_de) {
        console.log(`⚠️ ${family.category_code} 没有配置 slug_de，德语页面暂用英文 slug 生成: ${slug}`);
      }
      const html = generateFamilyHTML(family, categoryMap, lang);
      const filePath = path.join(outputDir, `${slug}.html`);
      fs.writeFileSync(filePath, html, 'utf-8');
      console.log(`  ✅ 生成 [${lang}]: ${slug}.html (${family.variants.length} 个 SKU)`);
      generated++;
    });
  });

  console.log(`📄 共生成 ${generated} 个 Family 页面`);
  console.log('🎉 构建完成 (V2, EN+DE)!');
}

build();