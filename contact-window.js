/**
 * LIAPLIAS Contact Window V1.0
 * Include once per page: <script src="/contact-window.js" defer></script>
 * Trigger: <button data-contact-trigger>Send Inquiry</button>
 *
 * Posts directly to the existing live endpoint:
 *   POST https://api.liaplias.com/api/inquiries
 *   { contact, email, message, form_type: "general" }
 * No backend/D1/R2/RFQ code is touched by this file.
 */
(function () {
  const ENDPOINT = 'https://api.liaplias.com/api/inquiries';

  // ============================================================
  // MULTI-LANGUAGE STRINGS (added for V1.0 localization)
  // ============================================================
  const STRINGS = {
    en: {
      title: 'Send Inquiry',
      subtitle: 'Tell us about your project or manufacturing needs.',
      nameLabel: 'Name *',
      emailLabel: 'Email *',
      messageLabel: 'Message *',
      submit: 'Send Inquiry',
      sending: 'Sending...',
      successTitle: 'Thank you',
      successMsg: "We've received your inquiry and will get back to you shortly.",
      errorRequired: 'Please fill in all fields.',
      errorEmail: 'Please enter a valid email address.',
      errorGeneric: 'Something went wrong. Please try again, or email us directly at inquiry@liaplias.com.',
      closeLabel: 'Close',
    },
    de: {
      title: 'Anfrage senden',
      subtitle: 'Erzählen Sie uns von Ihrem Projekt oder Ihrem Fertigungsbedarf.',
      nameLabel: 'Name *',
      emailLabel: 'E-Mail *',
      messageLabel: 'Nachricht *',
      submit: 'Anfrage senden',
      sending: 'Wird gesendet...',
      successTitle: 'Vielen Dank',
      successMsg: 'Wir haben Ihre Anfrage erhalten und werden uns in Kürze bei Ihnen melden.',
      errorRequired: 'Bitte füllen Sie alle Felder aus.',
      errorEmail: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
      errorGeneric: 'Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut oder schreiben Sie uns direkt an inquiry@liaplias.com.',
      closeLabel: 'Schließen',
    },
    fr: {
      title: 'Envoyer une demande',
      subtitle: 'Parlez-nous de votre projet ou de vos besoins en fabrication.',
      nameLabel: 'Nom *',
      emailLabel: 'E-mail *',
      messageLabel: 'Message *',
      submit: 'Envoyer une demande',
      sending: 'Envoi en cours...',
      successTitle: 'Merci',
      successMsg: 'Nous avons reçu votre demande et vous répondrons dans les plus brefs délais.',
      errorRequired: 'Veuillez remplir tous les champs.',
      errorEmail: 'Veuillez saisir une adresse e-mail valide.',
      errorGeneric: 'Une erreur est survenue. Veuillez réessayer ou nous écrire directement à inquiry@liaplias.com.',
      closeLabel: 'Fermer',
    },
    zh: {
      title: '发送询盘',
      subtitle: '告诉我们您的项目或制造需求。',
      nameLabel: '姓名 *',
      emailLabel: '邮箱 *',
      messageLabel: '留言 *',
      submit: '发送询盘',
      sending: '发送中...',
      successTitle: '感谢您',
      successMsg: '我们已收到您的询盘，将尽快回复您。',
      errorRequired: '请填写所有必填字段。',
      errorEmail: '请输入有效的邮箱地址。',
      errorGeneric: '出了点问题，请重试或直接发送邮件至 inquiry@liaplias.com。',
      closeLabel: '关闭',
    }
  };

  // ============================================================
  // LANGUAGE DETECTION (added for V1.0 localization)
  // ============================================================
  function detectLanguage() {
    // Priority 1: document.documentElement.lang
    const htmlLang = document.documentElement.lang;
    if (htmlLang) {
      const normalized = htmlLang.toLowerCase().trim();
      // Map 'zh-CN', 'zh-TW', etc. to 'zh'
      const langMap = {
        'en': 'en',
        'de': 'de',
        'fr': 'fr',
        'zh': 'zh',
        'zh-cn': 'zh',
        'zh-tw': 'zh',
        'zh-hk': 'zh',
        'zh-sg': 'zh',
      };
      const mapped = langMap[normalized] || normalized;
      if (STRINGS[mapped]) return mapped;
    }

    // Priority 2: URL path fallback (/en/, /de/, /fr/, /zh/)
    const path = window.location.pathname.toLowerCase();
    const segments = path.split('/').filter(s => s.length > 0);
    if (segments.length > 0) {
      const first = segments[0];
      if (STRINGS[first]) return first;
    }

    // Fallback: English
    return 'en';
  }

  // ============================================================
  // CSS (UNCHANGED - frozen baseline)
  // ============================================================
  const CSS = `
  .lcw-overlay{position:fixed;inset:0;background:rgba(5,8,16,.65);z-index:10000;
    display:flex;align-items:center;justify-content:center;padding:1.5rem;opacity:0;
    transition:opacity .2s ease;}
  .lcw-overlay.lcw-open{opacity:1;}
  .lcw-modal{background:var(--bg2,#0d1525);border:1px solid var(--border2,rgba(255,255,255,.13));
    border-radius:var(--r-lg,18px);width:100%;max-width:460px;max-height:90vh;overflow-y:auto;
    padding:2rem;position:relative;transform:translateY(16px);transition:transform .2s ease;
    font-family:'Inter',system-ui,sans-serif;color:var(--text,#f0f4ff);}
  .lcw-overlay.lcw-open .lcw-modal{transform:translateY(0);}
  .lcw-title{font-family:'Space Grotesk',sans-serif;font-size:1.4rem;font-weight:700;margin-bottom:.4rem;}
  .lcw-sub{font-size:.85rem;color:var(--text-mid,#8b9bbb);margin-bottom:1.5rem;}
  .lcw-field{margin-bottom:1rem;}
  .lcw-field label{display:block;font-size:.78rem;color:var(--text-mid,#8b9bbb);margin-bottom:.35rem;}
  .lcw-field input,.lcw-field textarea{
    width:100%;background:rgba(255,255,255,.04);border:1px solid var(--border2,rgba(255,255,255,.13));
    border-radius:8px;padding:.65rem .8rem;color:var(--text,#f0f4ff);font-size:.9rem;
    font-family:inherit;box-sizing:border-box;}
  .lcw-field textarea{min-height:110px;resize:vertical;}
  .lcw-field input:focus,.lcw-field textarea:focus{outline:none;border-color:var(--blue,#2d7fff);}
  .lcw-hp{position:absolute;left:-9999px;opacity:0;}
  .lcw-actions{margin-top:1.5rem;}
  .lcw-submit{background:var(--blue,#2d7fff);color:#fff;border:none;border-radius:10px;
    padding:.85rem 1.8rem;font-family:'Space Grotesk',sans-serif;font-size:.9rem;font-weight:600;
    cursor:pointer;width:100%;transition:background .2s;}
  .lcw-submit:hover:not(:disabled){background:var(--blue-l,#5b9fff);}
  .lcw-submit:disabled{opacity:.6;cursor:not-allowed;}
  .lcw-close{position:absolute;top:1rem;right:1.2rem;background:none;border:none;
    color:var(--text-mid,#8b9bbb);font-size:1.3rem;line-height:1;cursor:pointer;padding:.2rem;}
  .lcw-error{color:#ff6b6b;font-size:.8rem;margin-top:.6rem;display:none;}
  .lcw-error.lcw-show{display:block;}
  .lcw-success{text-align:center;padding:1.5rem 0;}
  .lcw-success h3{font-family:'Space Grotesk',sans-serif;margin-bottom:.6rem;}
  .lcw-success p{color:var(--text-mid,#8b9bbb);font-size:.88rem;}
  @media (max-width:640px){
    .lcw-overlay{padding:0;align-items:flex-end;}
    .lcw-modal{max-width:100%;max-height:100vh;height:100vh;border-radius:0;
      transform:translateY(100%);display:flex;flex-direction:column;justify-content:center;}
  }
  `;

  // ============================================================
  // FUNCTIONS (minimally modified for localization)
  // ============================================================
  function injectCSS() {
    if (document.getElementById('lcw-style')) return;
    const style = document.createElement('style');
    style.id = 'lcw-style';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function buildModal() {
    const lang = detectLanguage();
    const t = STRINGS[lang] || STRINGS.en;

    const overlay = document.createElement('div');
    overlay.className = 'lcw-overlay';
    overlay.innerHTML = `
      <div class="lcw-modal" role="dialog" aria-modal="true" aria-label="${t.title}">
        <button type="button" class="lcw-close" aria-label="${t.closeLabel}">&times;</button>
        <div class="lcw-body">
          <div class="lcw-title">${t.title}</div>
          <div class="lcw-sub">${t.subtitle}</div>
          <form class="lcw-form" novalidate>
            <input type="text" name="company_website" class="lcw-hp" tabindex="-1" autocomplete="off">
            <div class="lcw-field">
              <label for="lcw-name">${t.nameLabel}</label>
              <input type="text" id="lcw-name" name="contact" required maxlength="200" autocomplete="name">
            </div>
            <div class="lcw-field">
              <label for="lcw-email">${t.emailLabel}</label>
              <input type="email" id="lcw-email" name="email" required maxlength="200" autocomplete="email">
            </div>
            <div class="lcw-field">
              <label for="lcw-message">${t.messageLabel}</label>
              <textarea id="lcw-message" name="message" required maxlength="5000"></textarea>
            </div>
            <div class="lcw-error"></div>
            <div class="lcw-actions">
              <button type="submit" class="lcw-submit">${t.submit}</button>
            </div>
          </form>
        </div>
      </div>
    `;
    wireModal(overlay);
    return overlay;
  }

  function wireModal(overlay) {
    const close = () => closeModal(overlay);
    overlay.querySelector('.lcw-close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape' && document.body.contains(overlay)) close();
    });

    const form = overlay.querySelector('.lcw-form');
    const errorBox = overlay.querySelector('.lcw-error');
    const submitBtn = overlay.querySelector('.lcw-submit');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Honeypot: silently no-op for bots.
      if (form.company_website.value) {
        showSuccess(overlay);
        return;
      }

      const contact = form.contact.value.trim();
      const email = form.email.value.trim();
      const message = form.message.value.trim();

      // Get current language for error messages
      const lang = detectLanguage();
      const t = STRINGS[lang] || STRINGS.en;

      errorBox.classList.remove('lcw-show');

      if (!contact || !email || !message) {
        errorBox.textContent = t.errorRequired;
        errorBox.classList.add('lcw-show');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errorBox.textContent = t.errorEmail;
        errorBox.classList.add('lcw-show');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = t.sending;

      try {
        const fd = new FormData();
        fd.append('contact', contact);
        fd.append('email', email);
        fd.append('message', message);
        fd.append('form_type', 'general');

        const res = await fetch(ENDPOINT, {
          method: 'POST',
          body: fd,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error('submit_failed');
        showSuccess(overlay);
      } catch (err) {
        console.error('Contact Window submit error:', err);
        errorBox.textContent = t.errorGeneric;
        errorBox.classList.add('lcw-show');
        submitBtn.disabled = false;
        submitBtn.textContent = t.submit;
      }
    });
  }

  function showSuccess(overlay) {
    const lang = detectLanguage();
    const t = STRINGS[lang] || STRINGS.en;

    const body = overlay.querySelector('.lcw-body');
    body.innerHTML = `
      <div class="lcw-success">
        <h3>${t.successTitle}</h3>
        <p>${t.successMsg}</p>
      </div>
    `;
    setTimeout(() => closeModal(overlay), 3500);
  }

  function closeModal(overlay) {
    overlay.classList.remove('lcw-open');
    setTimeout(() => overlay.remove(), 200);
    document.body.style.overflow = '';
  }

  function openModal() {
    injectCSS();
    const overlay = buildModal();
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => overlay.classList.add('lcw-open'));
    overlay.querySelector('#lcw-name').focus();
  }

  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-contact-trigger]');
    if (trigger) {
      e.preventDefault();
      openModal();
    }
  });
})();