import { handleBomInquiry } from './bom-inquiry-worker.js';

export default {
  async fetch(request, env, ctx) {
   if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      });
    }
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    const path = url.pathname;

    // ==========================================================
    // 【关键修改点】OPTIONS 预检请求现在会调用我们更新后的 CORS 逻辑
    // ==========================================================
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: cors(env, request),
      });
    }

    try {
      if (method === 'GET' && path === '/api/products') {
        try {
          const { results } = await env.DB.prepare('SELECT * FROM products ORDER BY lia_code DESC').all();
          return new Response(JSON.stringify({ success: true, data: results }), {
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          });
        } catch (error) {
          return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          });
        }
      }

      if (method === 'POST' && path === '/api/inquiries') return await handleInquiry(request, env);
      if (method === 'POST' && path === '/api/partners') return await handlePartner(request, env);
      if (method === 'GET' && path === '/api/options') return await handleOptions(request, env, url);
      if (method === 'POST' && path === '/api/companies') return await handleCompany(request, env);
      if (method === 'POST' && path === '/api/contacts') return await handleContact(request, env);
      if (method === 'POST' && path === '/api/bom-inquiry') return await handleInquiry(request, env);
      if (method === 'POST' && path === '/api/rfq') return await handleRfq(request, env);

      return jsonErr('Not found', 404, env, request);
    } catch (err) {
      console.error('[Worker]', err);
      return jsonErr('Internal server error', 500, env, request);
    }
  },
};

// ==========================================================
// 原有表单处理函数 (保持不变)
// ==========================================================
async function handleInquiry(request, env) {
  const body = await parseBody(request);
  if (!body) return jsonErr('Invalid request body', 400, env, request);
  const { contact: name, email, company, form_type = 'general', lang = 'en', codes, quantity, notes, subject, message } = body;
  if (!name?.trim()) return jsonErr('name is required', 422, env, request);
  if (!email?.trim()) return jsonErr('email is required', 422, env, request);
  if (!validEmail(email)) return jsonErr('Invalid email address', 422, env, request);
  const inqId = await generateInqId(env);
  const noteVal = (notes || message)?.trim() || null;
  try {
    await env.DB.prepare(`
      INSERT INTO inquiries
        (id, contact_name, email, company, form_type, lang, codes, quantity, notes, subject, message, created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
    `).bind(inqId, name.trim(), email.trim().toLowerCase(), company?.trim() || null, form_type, lang, codes?.trim() || null, quantity?.trim() || null, noteVal, subject?.trim() || null, message?.trim() || null).run();
  } catch (e) { console.error('[D1 inquiries]', e.message); }
  const typeLabel = { quote: '📋 Quote Request', bom_matching: '📁 BOM Matching', general: '📬 General Inquiry' }[form_type] ?? '📬 Inquiry';
  const mailResult1 = await sendMail(env, { to: env.NOTIFY_EMAIL || 'info@liaplias.com', replyTo: email.trim(), subject: `[LIAPLIAS] ${typeLabel} — ${inqId}`, html: tplInquiry({ inqId, typeLabel, name, email, company, codes, quantity, notes: noteVal, subject, lang }) });
  const mailResult2 = await sendMail(env, { to: email.trim(), subject: lang === 'zh' ? `[LIAPLIAS] 已收到您的询价 — ${inqId}` : `[LIAPLIAS] Inquiry received — ${inqId}`, html: tplAutoReply({ inqId, name, lang }) });
  return jsonOk({ id: inqId, mail_debug: { notify: mailResult1, reply: mailResult2 } }, 201, env, request);
}

async function handlePartner(request, env) {
  const body = await parseBody(request);
  if (!body) return jsonErr('Invalid request body', 400, env, request);
  const { company, country, contact_name, title, email, phone, partner_type, categories, volume, message, lang = 'en' } = body;
  if (!company?.trim()) return jsonErr('company is required', 422, env, request);
  if (!contact_name?.trim()) return jsonErr('contact_name is required', 422, env, request);
  if (!email?.trim()) return jsonErr('email is required', 422, env, request);
  if (!validEmail(email)) return jsonErr('Invalid email address', 422, env, request);
  const appId = `PART-${dateStamp()}-${randSuffix()}`;
  await sendMail(env, { to: env.NOTIFY_EMAIL || 'info@liaplias.com', replyTo: email.trim(), subject: `[LIAPLIAS] Partner Application — ${company.trim()} — ${appId}`, html: tplPartner({ appId, company, country, contact_name, title, email, phone, partner_type, categories, volume, message }) });
  await sendMail(env, { to: email.trim(), subject: lang === 'zh' ? `[LIAPLIAS] 已收到您的合作伙伴申请 — ${appId}` : `[LIAPLIAS] Partner application received — ${appId}`, html: tplPartnerAutoReply({ appId, contact_name, lang }) });
  return jsonOk({ id: appId }, 201, env, request);
}

async function handleOptions(request, env, url) {
  const category = url.searchParams.get('category');
  const parent = url.searchParams.get('parent');
  if (!category) return jsonErr('category param required', 400, env, request);
  const { results } = parent
    ? await env.DB.prepare(`SELECT code, label_en, label_zh FROM options WHERE category=? AND parent_code=? ORDER BY sort_order, code`).bind(category, parent).all()
    : await env.DB.prepare(`SELECT code, label_en, label_zh FROM options WHERE category=? AND parent_code IS NULL ORDER BY sort_order, code`).bind(category).all();
  return jsonOk({ options: results }, 200, env, request);
}

async function handleCompany(request, env) {
  const body = await parseBody(request);
  if (!body) return jsonErr('Invalid request body', 400, env, request);
  const { continent, country_code, industry_class, industry_sub } = body;
  if (!continent || !country_code || !industry_class) return jsonErr('continent, country_code, industry_class required', 422, env, request);
  let nextSeq = 11;
  try {
    const { results } = await env.DB.prepare(`SELECT id FROM companies WHERE id LIKE ? ORDER BY id DESC LIMIT 1`).bind(`${continent}-${country_code}-${industry_class}-%`).all();
    if (results.length > 0) { const last = parseInt(results[0].id.split('-').pop(), 10); if (!isNaN(last)) nextSeq = last + 1; }
  } catch (e) { console.error('[D1 companies seq]', e.message); }
  const subPart = industry_sub ? `-${industry_sub}` : '';
  const companyId = `${continent}-${country_code}-${industry_class}${subPart}-${String(nextSeq).padStart(3, '0')}`;
  await env.DB.prepare(`INSERT INTO companies (id, continent, country_code, industry_class, industry_sub, created_at) VALUES (?,?,?,?,?,datetime('now'))`).bind(companyId, continent, country_code, industry_class, industry_sub || null).run();
  return jsonOk({ company_id: companyId }, 201, env, request);
}

async function handleContact(request, env) {
  const body = await parseBody(request);
  if (!body) return jsonErr('Invalid request body', 400, env, request);
  const { company_id, name, email, position } = body;
  if (!company_id?.trim()) return jsonErr('company_id is required', 422, env, request);
  if (!name?.trim()) return jsonErr('name is required', 422, env, request);
  let nextPerson = 1;
  try {
    const { results } = await env.DB.prepare(`SELECT id FROM contacts WHERE id LIKE ? ORDER BY id DESC LIMIT 1`).bind(`${company_id}-%`).all();
    if (results.length > 0) { const last = parseInt(results[0].id.split('-').pop(), 10); if (!isNaN(last)) nextPerson = last + 1; }
  } catch (e) { console.error('[D1 contacts seq]', e.message); }
  const contactId = `${company_id}-${String(nextPerson).padStart(2, '0')}`;
  await env.DB.prepare(`INSERT INTO contacts (id, company_id, name, email, position, created_at) VALUES (?,?,?,?,?,datetime('now'))`).bind(contactId, company_id.trim(), name.trim(), email?.trim() || null, position?.trim() || null).run();
  return jsonOk({ contact_id: contactId }, 201, env, request);
}

// ==========================================================
// HANDLER — RFQ (已整合姓名、邮箱、公司)
// ==========================================================
async function handleRfq(request, env) {
  const body = await parseBody(request);
  if (!body) return jsonErr('Invalid request body', 400, env, request);

  const { contact, email, company, items } = body;

  if (!Array.isArray(items) || items.length === 0) {
    return jsonErr('RFQ items cannot be empty', 422, env, request);
  }
  for (const item of items) {
    if (!item.lia_code || !String(item.lia_code).trim()) {
      return jsonErr('Each item requires a lia_code', 422, env, request);
    }
    const qty = Number(item.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      return jsonErr(`Invalid quantity for ${item.lia_code}`, 422, env, request);
    }
  }

  if (!contact?.trim()) return jsonErr('Contact name is required', 422, env, request);
  if (!email?.trim()) return jsonErr('Email is required', 422, env, request);
  if (!validEmail(email)) return jsonErr('Invalid email address', 422, env, request);
  if (!company?.trim()) return jsonErr('Company name is required', 422, env, request);

  const rfqId = await generateRfqId(env);

  try {
    const insertInquiry = env.DB.prepare(`
      INSERT INTO rfq_inquiries (id, contact_name, email, company, status, created_at)
      VALUES (?, ?, ?, ?, 'NEW', CURRENT_TIMESTAMP)
    `).bind(rfqId, contact.trim(), email.trim().toLowerCase(), company.trim());

    const insertItems = items.map((item) =>
      env.DB.prepare(`
        INSERT INTO rfq_items (inquiry_id, lia_code, quantity, note, created_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).bind(rfqId, String(item.lia_code).trim(), Number(item.quantity), item.note?.trim() || null)
    );

    await env.DB.batch([insertInquiry, ...insertItems]);
  } catch (e) {
    console.error('[D1 rfq_inquiries/rfq_items]', e.message);
    return jsonErr('Failed to save RFQ', 500, env, request);
  }

  const mailResult = await sendMail(env, {
    to: env.NOTIFY_EMAIL || 'info@liaplias.com',
    replyTo: email.trim(),
    subject: `[LIAPLIAS] 📦 RFQ Submitted — ${rfqId}`,
    html: tplRfq({ rfqId, contact, email, company, items }),
  });

  const autoReplyResult = await sendMail(env, {
    to: email.trim(),
    subject: `[LIAPLIAS] Your RFQ has been received — ${rfqId}`,
    html: tplRfqAutoReply({ rfqId, contact, company }),
  });

  return jsonOk({
    id: rfqId,
    mail_debug: { notify: mailResult, reply: autoReplyResult },
  }, 201, env, request);
}

async function generateRfqId(env) {
  const prefix = `RFQ-${dateStamp()}`;
  let seq = 1;
  try {
    const { results } = await env.DB.prepare(`SELECT id FROM rfq_inquiries WHERE id LIKE ? ORDER BY id DESC LIMIT 1`).bind(`${prefix}-%`).all();
    if (results.length > 0) { const last = parseInt(results[0].id.split('-').pop(), 10); if (!isNaN(last)) seq = last + 1; }
  } catch { return `${prefix}-${randSuffix()}`; }
  return `${prefix}-${String(seq).padStart(3, '0')}`;
}

// ==========================================================
// Email Utils & Templates
// ==========================================================
async function sendMail(env, { to, replyTo, subject, html }) {
  const from = 'info@liaplias.com';
  const payload = { from: `LIAPLIAS <${from}>`, to: [to], subject: subject, html: html, reply_to: replyTo ? [replyTo] : undefined };
  console.log('[RESEND] 尝试发送邮件到:', to);
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.RESEND_API_KEY}` },
      body: JSON.stringify(payload),
    });
    const responseText = await res.text();
    if (!res.ok) { console.error('[RESEND] 发送失败:', res.status, responseText); return { success: false, status: res.status, body: responseText }; }
    return { success: true, status: res.status, body: responseText };
  } catch (e) { console.error('[RESEND] 异常:', e.message); return { success: false, error: e.message }; }
}

const wrap = (body) => `<!DOCTYPE html><html><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body style="margin:0;padding:0;background:#0a0f1e;font-family:'DM Sans',Arial,Helvetica,sans-serif;color:#f0f4ff;"><table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:40px auto;"><tbody><td style="background:#111827;border:1px solid rgba(45,127,255,.22);border-radius:14px;padding:36px 40px;"><table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;"><tr><td style="font-family:'Space Grotesk',Arial,sans-serif;font-size:1.1rem;font-weight:800;letter-spacing:.07em;color:#2d7fff;">LIAP<span style="color:#00d4ff;">LIAS</span></td><td align="right" style="font-size:.72rem;color:#8b9bbb;">Operated by NOLVO</td></tr></table>${body}<div style="margin-top:32px;padding-top:18px;border-top:1px solid rgba(45,127,255,.1);font-size:.72rem;color:#3d4f70;line-height:1.6;">© 2025 LIAPLIAS · EUIPO &amp; USPTO Registered Trademark · Operated by NOLVO<br/><a href="mailto:info@liaplias.com" style="color:#2d7fff;text-decoration:none;">info@liaplias.com</a></div></td></tr></table></body></html>`;

const frow = (label, val) => val ? `<tr><td style="color:#8b9bbb;font-size:.78rem;padding:5px 0;width:150px;vertical-align:top;">${esc(label)}</td><td style="color:#f0f4ff;font-size:.82rem;padding:5px 0 5px 12px;line-height:1.55;">${esc(String(val))}</td></tr>` : '';

function tplInquiry({ inqId, typeLabel, name, email, company, codes, quantity, notes, subject, lang }) {
  return wrap(`<h2 style="font-family:'Space Grotesk',Arial,sans-serif;font-size:1rem;font-weight:700;margin:0 0 4px;">${esc(typeLabel)}</h2><p style="font-size:.78rem;color:#00d4ff;letter-spacing:.07em;margin:0 0 22px;">${esc(inqId)}</p><table cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-bottom:18px;">${frow('Name', name)}${frow('Email', email)}${frow('Company', company)}${frow('Language', lang)}${frow('Product Codes', codes)}${frow('Qty / Delivery', quantity)}${frow('Subject', subject)}</table>${notes ? `<p style="font-size:.72rem;color:#8b9bbb;margin:0 0 5px;text-transform:uppercase;letter-spacing:.08em;">Notes / Message</p><div style="background:rgba(45,127,255,.07);border-left:3px solid #2d7fff;border-radius:0 6px 6px 0;padding:12px 16px;font-size:.84rem;line-height:1.65;color:#f0f4ff;">${esc(notes)}</div>` : ''}<p style="margin-top:20px;font-size:.76rem;color:#8b9bbb;">Reply to respond directly to the sender.</p>`);
}

function tplPartner({ appId, company, country, contact_name, title, email, phone, partner_type, categories, volume, message }) {
  return wrap(`<h2 style="font-family:'Space Grotesk',Arial,sans-serif;font-size:1rem;font-weight:700;margin:0 0 4px;">🤝 Partner Application</h2><p style="font-size:.78rem;color:#00d4ff;letter-spacing:.07em;margin:0 0 22px;">${esc(appId)}</p><table cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-bottom:18px;">${frow('Company', company)}${frow('Country', country)}${frow('Contact', contact_name)}${frow('Job Title', title)}${frow('Email', email)}${frow('Phone', phone)}${frow('Partner Type', partner_type)}${frow('Categories', categories)}${frow('Est. Volume', volume)}</table>${message ? `<p style="font-size:.72rem;color:#8b9bbb;margin:0 0 5px;text-transform:uppercase;letter-spacing:.08em;">Introduction &amp; Goals</p><div style="background:rgba(45,127,255,.07);border-left:3px solid #2d7fff;border-radius:0 6px 6px 0;padding:12px 16px;font-size:.84rem;line-height:1.65;color:#f0f4ff;">${esc(message)}</div>` : ''}`);
}

function tplAutoReply({ inqId, name, lang }) {
  if (lang === 'zh') return wrap(`<h2 style="font-family:'Space Grotesk',Arial,sans-serif;font-size:1rem;font-weight:700;margin:0 0 14px;">您好，${esc(name)}，</h2><p style="color:#f0f4ff;line-height:1.75;margin:0 0 10px;">我们已收到您的询价，参考编号：<strong style="color:#00d4ff;">${esc(inqId)}</strong>。</p><p style="color:#8b9bbb;line-height:1.75;margin:0 0 18px;">我们的团队将在 <strong style="color:#f0f4ff;">1个工作日</strong> 内与您联系。<br/>如有紧急需求，请回复此邮件或发送至<a href="mailto:info@liaplias.com" style="color:#2d7fff;text-decoration:none;">info@liaplias.com</a>。</p><p style="font-size:.82rem;color:#8b9bbb;">此致<br/>LIAPLIAS 团队 · 由 NOLVO 运营</p>`);
  return wrap(`<h2 style="font-family:'Space Grotesk',Arial,sans-serif;font-size:1rem;font-weight:700;margin:0 0 14px;">Hello ${esc(name)},</h2><p style="color:#f0f4ff;line-height:1.75;margin:0 0 10px;">We've received your inquiry. Reference: <strong style="color:#00d4ff;">${esc(inqId)}</strong>.</p><p style="color:#8b9bbb;line-height:1.75;margin:0 0 18px;">Our team will be in touch within <strong style="color:#f0f4ff;">1 business day</strong>.<br/>For urgent matters, reply to this email or write to <a href="mailto:info@liaplias.com" style="color:#2d7fff;text-decoration:none;">info@liaplias.com</a>.</p><p style="font-size:.82rem;color:#8b9bbb;">Best regards,<br/>LIAPLIAS · Operated by NOLVO</p>`);
}

function tplPartnerAutoReply({ appId, contact_name, lang }) {
  if (lang === 'zh') return wrap(`<h2 style="font-family:'Space Grotesk',Arial,sans-serif;font-size:1rem;font-weight:700;margin:0 0 14px;">您好，${esc(contact_name)}，</h2><p style="color:#f0f4ff;line-height:1.75;margin:0 0 10px;">我们已收到您的合作伙伴申请，参考编号：<strong style="color:#00d4ff;">${esc(appId)}</strong>。</p><p style="color:#8b9bbb;line-height:1.75;margin:0 0 18px;">我们将在 <strong style="color:#f0f4ff;">3个工作日</strong> 内完成评估并回复资质审核结果。</p><p style="font-size:.82rem;color:#8b9bbb;">此致<br/>LIAPLIAS 团队 · 由 NOLVO 运营</p>`);
  return wrap(`<h2 style="font-family:'Space Grotesk',Arial,sans-serif;font-size:1rem;font-weight:700;margin:0 0 14px;">Hello ${esc(contact_name)},</h2><p style="color:#f0f4ff;line-height:1.75;margin:0 0 10px;">We've received your partner application. Reference: <strong style="color:#00d4ff;">${esc(appId)}</strong>.</p><p style="color:#8b9bbb;line-height:1.75;margin:0 0 18px;">Our team will review and respond within <strong style="color:#f0f4ff;">3 business days</strong> with qualification details.</p><p style="font-size:.82rem;color:#8b9bbb;">Best regards,<br/>LIAPLIAS · Operated by NOLVO</p>`);
}

function tplRfq({ rfqId, contact, email, company, items }) {
  const itemRows = items.map((item) => `<tr><td style="color:#f0f4ff;font-size:.82rem;padding:8px 10px;border-bottom:1px solid rgba(45,127,255,.1);">${esc(item.lia_code)}</td><td style="color:#f0f4ff;font-size:.82rem;padding:8px 10px;border-bottom:1px solid rgba(45,127,255,.1);text-align:center;">${esc(String(item.quantity))}</td><td style="color:#8b9bbb;font-size:.8rem;padding:8px 10px;border-bottom:1px solid rgba(45,127,255,.1);">${esc(item.note || '')}</td></tr>`).join('');
  return wrap(`<h2 style="font-family:'Space Grotesk',Arial,sans-serif;font-size:1rem;font-weight:700;margin:0 0 4px;">📦 RFQ Submitted</h2><p style="font-size:.78rem;color:#00d4ff;letter-spacing:.07em;margin:0 0 22px;">${esc(rfqId)}</p><table cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-bottom:18px;">${frow('Contact', contact)}${frow('Email', email)}${frow('Company', company)}${frow('Item Count', String(items.length))}</table><table cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-bottom:10px;"><thead><tr><th align="left" style="font-size:.72rem;color:#8b9bbb;text-transform:uppercase;letter-spacing:.08em;padding:0 10px 8px;border-bottom:1px solid rgba(45,127,255,.22);">LIA Code</th><th align="center" style="font-size:.72rem;color:#8b9bbb;text-transform:uppercase;letter-spacing:.08em;padding:0 10px 8px;border-bottom:1px solid rgba(45,127,255,.22);">Qty</th><th align="left" style="font-size:.72rem;color:#8b9bbb;text-transform:uppercase;letter-spacing:.08em;padding:0 10px 8px;border-bottom:1px solid rgba(45,127,255,.22);">Note</th></tr></thead><tbody>${itemRows}</tbody></table><p style="margin-top:20px;font-size:.76rem;color:#8b9bbb;">Reply to respond directly to the sender.</p>`);
}

function tplRfqAutoReply({ rfqId, contact, company }) {
  return wrap(`<h2 style="font-family:'Space Grotesk',Arial,sans-serif;font-size:1rem;font-weight:700;margin:0 0 14px;">Hello ${esc(contact)},</h2><p style="color:#f0f4ff;line-height:1.75;margin:0 0 10px;">We've received your RFQ for ${esc(company)}. Reference: <strong style="color:#00d4ff;">${esc(rfqId)}</strong>.</p><p style="color:#8b9bbb;line-height:1.75;margin:0 0 18px;">Our team will review the requested items and be in touch within <strong style="color:#f0f4ff;">1 business day</strong>.<br/>For urgent matters, reply to this email or write to <a href="mailto:info@liaplias.com" style="color:#2d7fff;text-decoration:none;">info@liaplias.com</a>.</p><p style="font-size:.82rem;color:#8b9bbb;">Best regards,<br/>LIAPLIAS · Operated by NOLVO</p>`);
}

// ==========================================================
// Utils
// ==========================================================
async function generateInqId(env) {
  const prefix = `INQ-${dateStamp()}`;
  let seq = 1;
  try {
    const { results } = await env.DB.prepare(`SELECT id FROM inquiries WHERE id LIKE ? ORDER BY id DESC LIMIT 1`).bind(`${prefix}-%`).all();
    if (results.length > 0) { const last = parseInt(results[0].id.split('-').pop(), 10); if (!isNaN(last)) seq = last + 1; }
  } catch { return `${prefix}-${randSuffix()}`; }
  return `${prefix}-${String(seq).padStart(3, '0')}`;
}
function dateStamp() { return new Date().toISOString().slice(0, 10).replace(/-/g, ''); }
function randSuffix() { return Math.random().toString(36).slice(2, 6).toUpperCase(); }
async function parseBody(request) {
  try {
    const ct = request.headers.get('Content-Type') || '';
    if (ct.includes('application/json')) return await request.json();
    if (ct.includes('multipart/form-data') || ct.includes('urlencoded')) { const fd = await request.formData(); return Object.fromEntries(fd.entries()); }
    return await request.json();
  } catch { return null; }
}
function validEmail(str) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(str)); }
function esc(str) { return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

// ==========================================================
// 【核心修改点：CORS 函数升级】
// 新增了判断 origin.endsWith('.pages.dev') 的逻辑，直接避开了跨域拦截。
// ==========================================================
function cors(env, request) {
  const allowed = (env.ALLOWED_ORIGINS || 'https://www.liaplias.com').split(',').map(s => s.trim());
  const origin = request.headers.get('Origin') || '';

  // 自动允许 .pages.dev 测试域名，以及 wrangler.toml 中配置的正式域名
  const isAllowed = allowed.includes(origin) || (origin && origin.endsWith('.pages.dev'));

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : allowed[0],
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonOk(data, status, env, request) {
  return new Response(JSON.stringify({ ok: true, ...data }), { status, headers: { 'Content-Type': 'application/json', ...cors(env, request) } });
}
function jsonErr(message, status, env, request) {
  return new Response(JSON.stringify({ ok: false, error: message }), { status, headers: { 'Content-Type': 'application/json', ...cors(env, request) } });
}