// ============================================================
// locales.js — NOLVO 多语言文本
// en / zh 完整，de / fr 占位
// 用法：window.NOLVO_LANG 由页面 <html lang="xx"> 决定
// ============================================================

const LOCALES = {

  // ── 英文 ────────────────────────────────────────────────────
  en: {
    // 导航
    'nav.home':        'Home',
    'nav.cooperation': 'Cooperation',
    'nav.industries':  'Industries',
    'nav.search':      'Code Search',
    'nav.solutions':   'Solutions',
    'nav.partners':    'Partners',
    'nav.contact':     'Contact',
    'nav.get_quote':   'Get a Quote',

    // 语言切换
    'lang.en': 'EN',
    'lang.zh': '中',
    'lang.de': 'DE',
    'lang.fr': 'FR',

    // Hero
    'hero.tag':        'Global CNC Sourcing Partner',
    'hero.title_1':    'Precision CNC Parts.',
    'hero.title_2':    'China Made.',
    'hero.title_3':    'World Ready.',
    'hero.subtitle':   'HASCO & Meusburger compatible standard components, plus custom CNC machining — sourced from certified Chinese factories, delivered to your door.',
    'hero.cta_primary':   'Search by Code',
    'hero.cta_secondary': 'Learn How We Work',
    'hero.badge_hasco':   'HASCO Compatible',
    'hero.badge_meusb':   'Meusburger Compatible',
    'hero.badge_iso':     'ISO Certified Factories',

    // Stats bar
    'stats.skus':       '400+',
    'stats.skus_label': 'SKUs in Database',
    'stats.factories':  '3+',
    'stats.factories_label': 'Certified Factories',
    'stats.markets':    '20+',
    'stats.markets_label':   'Countries Served',
    'stats.lead':       '7–15',
    'stats.lead_label': 'Day Lead Time',

    // Capabilities
    'cap.tag':    'What We Offer',
    'cap.title':  'Full-Spectrum CNC Capability',
    'cap.desc':   'From off-the-shelf standard components to fully bespoke machined parts — one partner, one standard, one point of contact.',
    'cap.std.title':  'Standard Components',
    'cap.std.desc':   'Mold guide elements, ejector pins, springs, fasteners and more. Fully compatible with HASCO & Meusburger numbering systems.',
    'cap.custom.title': 'Custom Machining',
    'cap.custom.desc':  'Upload your drawing (PDF / DWG). We quote within 24 hours. Tolerances down to ±0.005 mm.',
    'cap.source.title': 'Supply Chain Integration',
    'cap.source.desc':  'We consolidate orders across factories, handle QC inspection, and ship directly to your warehouse or project site.',
    'cap.digital.title':'Digital Catalog',
    'cap.digital.desc': 'Search 400+ SKUs by HASCO code, Meusburger code, or keyword. Download spec sheets. Submit BOM for bulk inquiry.',

    // Industries
    'ind.tag':   'Industries We Serve',
    'ind.title': 'Built for the Industries That Build Everything',
    'ind.mold.title':    'Mold & Tooling',
    'ind.mold.desc':     'Standard components for injection molds, die-casting tools, and stamping dies.',
    'ind.auto.title':    'Automotive',
    'ind.auto.desc':     'Precision parts for body, chassis, powertrain and interior assembly jigs.',
    'ind.elec.title':    'Electronics & 3C',
    'ind.elec.desc':     'Fine-tolerance fixtures, brackets and housings for consumer electronics manufacturing.',
    'ind.energy.title':  'New Energy',
    'ind.energy.desc':   'Structural and functional components for EV battery, solar and wind equipment.',
    'ind.build.title':   'Building & Construction',
    'ind.build.desc':    'Precision fittings for architectural hardware, sanitary ware and modular building systems.',
    'ind.aero.title':    'Aerospace & Industrial',
    'ind.aero.desc':     'High-spec machined parts with full traceability for demanding industrial applications.',

    // How it works
    'how.tag':    'How It Works',
    'how.title':  'From Inquiry to Delivery in 4 Steps',
    'how.s1.title': '01 — Search or Upload',
    'how.s1.desc':  'Enter a HASCO / Meusburger code, keyword, or upload your BOM spreadsheet.',
    'how.s2.title': '02 — Submit Inquiry',
    'how.s2.desc':  'Confirm your product list, add quantities and delivery requirements, then submit.',
    'how.s3.title': '03 — Receive Quote',
    'how.s3.desc':  'We respond within 24 hours with pricing, lead time and factory certification.',
    'how.s4.title': '04 — Confirm & Ship',
    'how.s4.desc':  'Approve the quote, we handle production, QC and international shipping.',

    // CTA banner
    'cta.title':    'Ready to Simplify Your CNC Sourcing?',
    'cta.desc':     'Search 400+ standard components or upload a BOM for bulk inquiry — no registration required.',
    'cta.primary':  'Search by Code',
    'cta.secondary':'Contact Us',

    // Footer
    'footer.tagline':    'Precision CNC Parts — China Made, World Ready.',
    'footer.operator':   'Operated by NOLVO',
    'footer.trademark':  'LIAPLIAS® Trademark registered in EU & US.',
    'footer.nav_title':  'Navigation',
    'footer.legal_title':'Legal',
    'footer.privacy':    'Privacy Policy',
    'footer.terms':      'Terms of Use',
    'footer.rights':     '© 2026 NOLVO / LIAPLIAS. All rights reserved.',
    'footer.contact_title': 'Contact',
    'footer.email':      'info@liaplias.com',
    'footer.website':    'liaplias.com',
  },

  // ── 中文 ────────────────────────────────────────────────────
  zh: {
    'nav.home':        '首页',
    'nav.cooperation': '合作模式',
    'nav.industries':  '服务行业',
    'nav.search':      '编码查询',
    'nav.solutions':   '解决方案',
    'nav.partners':    '合作伙伴',
    'nav.contact':     '联系我们',
    'nav.get_quote':   '获取报价',

    'lang.en': 'EN',
    'lang.zh': '中',
    'lang.de': 'DE',
    'lang.fr': 'FR',

    'hero.tag':        '全球CNC采购合作伙伴',
    'hero.title_1':    '精密CNC零件。',
    'hero.title_2':    '中国制造。',
    'hero.title_3':    '全球交付。',
    'hero.subtitle':   '兼容HASCO与Meusburger编号的标准件，以及定制CNC加工件——来自认证中国工厂，直接配送到您的工厂。',
    'hero.cta_primary':   '按编码查询',
    'hero.cta_secondary': '了解合作方式',
    'hero.badge_hasco':   '兼容HASCO',
    'hero.badge_meusb':   '兼容Meusburger',
    'hero.badge_iso':     'ISO认证工厂',

    'stats.skus':          '400+',
    'stats.skus_label':    'SKU数据库',
    'stats.factories':     '3+',
    'stats.factories_label': '认证工厂',
    'stats.markets':       '20+',
    'stats.markets_label': '覆盖国家',
    'stats.lead':          '7–15',
    'stats.lead_label':    '天交货期',

    'cap.tag':   '我们的服务',
    'cap.title': '全面的CNC供应能力',
    'cap.desc':  '从现货标准件到全定制加工件——一个合作伙伴，一套标准，一个联系点。',
    'cap.std.title':    '标准件供应',
    'cap.std.desc':     '模具导向件、顶针、弹簧、紧固件等，完全兼容HASCO和Meusburger编号体系。',
    'cap.custom.title': '定制CNC加工',
    'cap.custom.desc':  '上传图纸（PDF/DWG），24小时内报价，公差可达±0.005mm。',
    'cap.source.title': '供应链整合',
    'cap.source.desc':  '整合多家工厂订单，统一质检，直接配送至您的仓库或项目现场。',
    'cap.digital.title':'数字化产品目录',
    'cap.digital.desc': '按HASCO编号、Meusburger编号或关键词查询400+个SKU，支持BOM批量询价。',

    'ind.tag':   '服务行业',
    'ind.title': '为构建一切的行业而生',
    'ind.mold.title':   '模具与工装',
    'ind.mold.desc':    '注塑模、压铸模、冲压模的标准零件供应。',
    'ind.auto.title':   '汽车行业',
    'ind.auto.desc':    '车身、底盘、动力总成及内饰装配夹具的精密零件。',
    'ind.elec.title':   '电子与3C',
    'ind.elec.desc':    '消费电子制造用高精度夹具、支架和外壳加工。',
    'ind.energy.title': '新能源',
    'ind.energy.desc':  '新能源汽车电池、光伏和风电设备的结构功能件。',
    'ind.build.title':  '建筑与居住',
    'ind.build.desc':   '建筑五金、卫浴和集成房屋系统的精密配件。',
    'ind.aero.title':   '航空航天与工业',
    'ind.aero.desc':    '高规格加工零件，可追溯，满足严苛工业应用需求。',

    'how.tag':   '合作流程',
    'how.title': '4步从询价到交付',
    'how.s1.title': '01 — 查询或上传',
    'how.s1.desc':  '输入HASCO/Meusburger编号、关键词，或上传BOM表格。',
    'how.s2.title': '02 — 提交询价',
    'how.s2.desc':  '确认产品清单，填写数量和交货要求，提交询价。',
    'how.s3.title': '03 — 收到报价',
    'how.s3.desc':  '24小时内收到含价格、交期和工厂认证的详细报价。',
    'how.s4.title': '04 — 确认与发货',
    'how.s4.desc':  '确认报价后，我们负责生产、质检和国际物流。',

    'cta.title':    '准备好简化您的CNC采购了吗？',
    'cta.desc':     '查询400+标准件，或上传BOM进行批量询价——无需注册账号。',
    'cta.primary':  '按编码查询',
    'cta.secondary':'联系我们',

    'footer.tagline':    '精密CNC零件——中国制造，全球交付。',
    'footer.operator':   '运营方：NOLVO',
    'footer.trademark':  'LIAPLIAS® 商标已在欧盟及美国注册。',
    'footer.nav_title':  '导航',
    'footer.legal_title':'法律',
    'footer.privacy':    '隐私政策',
    'footer.terms':      '使用条款',
    'footer.rights':     '© 2026 NOLVO / LIAPLIAS 版权所有。',
    'footer.contact_title': '联系方式',
    'footer.email':      'info@liaplias.com',
    'footer.website':    'liaplias.com',
  },

  // ── 德文（占位）─────────────────────────────────────────────
  de: {
    'nav.home':        'Startseite',         // {{de: translate pending}}
    'nav.cooperation': 'Kooperation',
    'nav.industries':  'Branchen',
    'nav.search':      'Code-Suche',
    'nav.solutions':   'Lösungen',
    'nav.partners':    'Partner',
    'nav.contact':     'Kontakt',
    'nav.get_quote':   'Angebot anfordern',
    // All other keys — fall back to EN until translated
    '__fallback': 'en',
  },

  // ── 法文（占位）─────────────────────────────────────────────
  fr: {
    'nav.home':        'Accueil',            // {{fr: translate pending}}
    'nav.cooperation': 'Coopération',
    'nav.industries':  'Industries',
    'nav.search':      'Recherche par Code',
    'nav.solutions':   'Solutions',
    'nav.partners':    'Partenaires',
    'nav.contact':     'Contact',
    'nav.get_quote':   'Demander un Devis',
    '__fallback': 'en',
  },
};

// ── Public API ───────────────────────────────────────────────
window.NOLVO = window.NOLVO || {};

/**
 * 检测当前语言（从 <html lang> 属性读取，默认 en）
 */
window.NOLVO.getLang = function () {
  const lang = document.documentElement.lang || 'en';
  return LOCALES[lang] ? lang : 'en';
};

/**
 * 翻译函数
 * @param {string} key   翻译键，如 'nav.home'
 * @param {string} [lang] 指定语言，默认读取当前页面语言
 * @returns {string}
 */
window.NOLVO.t = function (key, lang) {
  lang = lang || window.NOLVO.getLang();
  const dict = LOCALES[lang] || LOCALES['en'];
  // 若当前语言无此键，尝试 fallback（de/fr fallback to en）
  if (dict[key] !== undefined) return dict[key];
  if (dict['__fallback'])      return LOCALES[dict['__fallback']][key] || key;
  return key;
};

/**
 * 渲染页面所有 data-i18n 元素
 * <span data-i18n="nav.home"></span>
 * <a data-i18n-attr="href" data-i18n-val="/en/index.html"></a>
 */
window.NOLVO.renderI18n = function () {
  const t = window.NOLVO.t;
  // 文本内容
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = t(key);
  });
  // 属性（如 placeholder、title、alt）
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.getAttribute('data-i18n-title'));
  });
  document.querySelectorAll('[data-i18n-alt]').forEach(el => {
    el.alt = t(el.getAttribute('data-i18n-alt'));
  });
};

// 页面加载完成后自动渲染
document.addEventListener('DOMContentLoaded', window.NOLVO.renderI18n);