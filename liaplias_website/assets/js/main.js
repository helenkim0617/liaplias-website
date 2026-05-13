// ============================================================
// main.js — NOLVO 全局脚本
// 功能：导航栏行为 / 语言切换 / 滚动动画 / 图片懒加载
// ============================================================

(function () {
  'use strict';

  // ── 语言路径映射 ─────────────────────────────────────────────
  const LANG_PATH = {
    en: '/en/',
    zh: '/zh/',
    de: '/de/',
    fr: '/fr/',
  };

  // ── 工具：获取当前页面所在语言 ───────────────────────────────
  function getCurrentLang() {
    return document.documentElement.lang || 'en';
  }

  // ── 工具：获取当前页面文件名（如 index.html）────────────────
  function getCurrentPage() {
    const path = window.location.pathname;
    const parts = path.split('/').filter(Boolean);
    // 路径结构 /en/index.html → parts = ['en','index.html']
    return parts[parts.length - 1] || 'index.html';
  }

  // ── 语言切换 ─────────────────────────────────────────────────
  function initLangSwitcher() {
    const btns = document.querySelectorAll('[data-lang-btn]');
    const current = getCurrentLang();
    const page    = getCurrentPage();

    btns.forEach(btn => {
      const lang = btn.getAttribute('data-lang-btn');

      // 标记当前语言
      if (lang === current) {
        btn.classList.add('active');
        btn.setAttribute('aria-current', 'true');
      }

      btn.addEventListener('click', function () {
        if (lang === current) return;
        const targetPath = LANG_PATH[lang];
        if (targetPath) {
          window.location.href = targetPath + page;
        }
      });
    });
  }

  // ── 导航栏：滚动时加背景 ─────────────────────────────────────
  function initNavScroll() {
    const nav = document.getElementById('main-nav');
    if (!nav) return;

    let lastY = 0;

    function onScroll() {
      const y = window.scrollY;

      // 加背景
      if (y > 20) {
        nav.classList.add('nav--scrolled');
      } else {
        nav.classList.remove('nav--scrolled');
      }

      // 向下滚动 > 80px 时隐藏，向上滚动时显示
      if (y > 80 && y > lastY + 8) {
        nav.classList.add('nav--hidden');
      } else if (y < lastY - 4) {
        nav.classList.remove('nav--hidden');
      }
      lastY = y;
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // 初始执行一次
  }

  // ── 移动端汉堡菜单 ───────────────────────────────────────────
  function initMobileMenu() {
    const toggle = document.getElementById('nav-toggle');
    const menu   = document.getElementById('nav-menu');
    if (!toggle || !menu) return;

    toggle.addEventListener('click', function () {
      const isOpen = menu.classList.toggle('nav-menu--open');
      toggle.classList.toggle('nav-toggle--open', isOpen);
      toggle.setAttribute('aria-expanded', isOpen);
      // 防止背景滚动
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    // 点击菜单项后关闭
    menu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        menu.classList.remove('nav-menu--open');
        toggle.classList.remove('nav-toggle--open');
        toggle.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });

    // 点击遮罩关闭
    document.addEventListener('click', function (e) {
      if (!nav_toggle && !menu.contains(e.target) && !toggle.contains(e.target)) {
        menu.classList.remove('nav-menu--open');
        toggle.classList.remove('nav-toggle--open');
        document.body.style.overflow = '';
      }
    });
  }

  // ── 滚动触发动画（Intersection Observer）────────────────────
  function initScrollReveal() {
    const elements = document.querySelectorAll('.reveal');
    if (!elements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    elements.forEach(el => observer.observe(el));
  }

  // ── 图片懒加载 ───────────────────────────────────────────────
  function initLazyImages() {
    const images = document.querySelectorAll('img.lazy');
    if (!images.length) return;

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const img = entry.target;
              if (img.dataset.src) {
                img.src = img.dataset.src;
                img.addEventListener('load', () => img.classList.add('loaded'));
                img.addEventListener('error', () => img.classList.add('loaded'));
              }
              observer.unobserve(img);
            }
          });
        },
        { rootMargin: '200px 0px' }
      );
      images.forEach(img => observer.observe(img));
    } else {
      // Fallback：直接加载
      images.forEach(img => {
        if (img.dataset.src) {
          img.src = img.dataset.src;
          img.classList.add('loaded');
        }
      });
    }
  }

  // ── 数字计数动画（stats 区域）────────────────────────────────
  function initCountUp() {
    const els = document.querySelectorAll('[data-countup]');
    if (!els.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const el       = entry.target;
            const target   = parseFloat(el.getAttribute('data-countup'));
            const suffix   = el.getAttribute('data-suffix') || '';
            const duration = 1400;
            const start    = performance.now();
            const isFloat  = String(target).includes('.');

            function update(now) {
              const elapsed  = now - start;
              const progress = Math.min(elapsed / duration, 1);
              // Ease out cubic
              const eased = 1 - Math.pow(1 - progress, 3);
              const current = target * eased;
              el.textContent = (isFloat ? current.toFixed(1) : Math.floor(current)) + suffix;
              if (progress < 1) requestAnimationFrame(update);
            }
            requestAnimationFrame(update);
            observer.unobserve(el);
          }
        });
      },
      { threshold: 0.5 }
    );
    els.forEach(el => observer.observe(el));
  }

  // ── 平滑滚动（锚点）─────────────────────────────────────────
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(link => {
      link.addEventListener('click', function (e) {
        const id  = this.getAttribute('href').slice(1);
        const el  = document.getElementById(id);
        if (!el) return;
        e.preventDefault();
        const navH = parseInt(getComputedStyle(document.documentElement)
          .getPropertyValue('--nav-h')) || 64;
        const top = el.getBoundingClientRect().top + window.scrollY - navH - 16;
        window.scrollTo({ top, behavior: 'smooth' });
      });
    });
  }

  // ── 当前导航链接高亮 ─────────────────────────────────────────
  function highlightCurrentNav() {
    const page = getCurrentPage();
    document.querySelectorAll('[data-nav-page]').forEach(link => {
      if (link.getAttribute('data-nav-page') === page) {
        link.classList.add('nav-link--active');
        link.setAttribute('aria-current', 'page');
      }
    });
  }

  // ── Init ─────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    initLangSwitcher();
    initNavScroll();
    initMobileMenu();
    initScrollReveal();
    initLazyImages();
    initCountUp();
    initSmoothScroll();
    highlightCurrentNav();
  });

})();