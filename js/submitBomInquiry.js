/**
 * LIAPLIAS — BOM Inquiry Frontend
 * submitBomInquiry()
 *
 * Dependencies:
 *   - window.bomRows  : Array，由 handleBomFile() 解析后赋值
 *   - Modal 字段 name : company / contact / email / whatsapp / qty / order_type / notes
 *   - BOM_API_URL     : Worker 端点（见下方常量）
 */

const BOM_API_URL = "https://api.liaplias.com/api/bom-inquiry";

/* ─── 主函数 ─────────────────────────────────────────────── */

async function submitBomInquiry() {
  // 1. 读取 BOM 数据
  const rows = window.bomRows;

  if (!rows || rows.length === 0) {
    showBomToast("error", "Please upload a BOM file first. / 请先上传 BOM 文件。");
    return;
  }

  // 2. 收集联系人信息（字段 name 属性）
  const contactInfo = collectContactInfo();

  if (!contactInfo.email) {
    showBomToast("error", "Email is required. / 邮箱为必填项。");
    highlightField("email");
    return;
  }

  // 3. 构建 items 数组（对齐 Worker 字段名）
  const items = rows.map((r) => ({
    rowNum:           r.rowNum,
    hascoCode:        r.hv   || "",
    meusburgerCode:   r.mv   || "",
    liaCode:          r.lv   || "",          // 若 handleBomFile 有此字段
    description:      r.desc || "",
    qtyRequired:      r.qty  || "",
    unit:             r.unit || "",
    diameter:         r.diameter || "",
    length:           r.length   || "",
    materialNote:     r.materialNote || "",
    deliveryDeadline: r.deliveryDeadline || "",
  }));

  // 4. 发送请求
  setSubmitButtonState(true);

  try {
    const res = await fetch(BOM_API_URL, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ items, contactInfo }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const msg = data.error || `Server error ${res.status}`;
      showBomToast("error", msg);
      return;
    }

    // 5. 成功处理
    showBomToast("success", "BOM inquiry sent successfully! We will contact you soon.\n询价已发送，我们将尽快与您联系。");
    resetBomForm();

  } catch (err) {
    console.error("[BOM Inquiry] Network error:", err);
    showBomToast("error", "Network error, please try again. / 网络错误，请重试。");
  } finally {
    setSubmitButtonState(false);
  }
}

/* ─── 辅助函数 ───────────────────────────────────────────── */

/** 从模态框收集联系人字段 */
function collectContactInfo() {
  const fields = ["company", "contact", "email", "whatsapp", "qty", "order_type", "notes"];
  const info = {};
  fields.forEach((name) => {
    const el = document.querySelector(`[name="${name}"]`);
    if (el) info[name] = el.value.trim();
  });
  return info;
}

/** 按钮加载态切换 */
function setSubmitButtonState(loading) {
  // 优先找明确的 BOM 提交按钮，找不到则退回通用 submit
  const btn =
    document.getElementById("bomSubmitBtn") ||
    document.querySelector(".bom-submit-btn") ||
    document.querySelector('[onclick="submitBomInquiry()"]');

  if (!btn) return;

  if (loading) {
    btn.dataset.originalText = btn.innerHTML;
    btn.innerHTML = `<span class="spinner"></span> Sending… / 发送中…`;
    btn.disabled = true;
  } else {
    btn.innerHTML = btn.dataset.originalText || "Submit Inquiry";
    btn.disabled = false;
  }
}

/** 字段高亮（简单红框） */
function highlightField(name) {
  const el = document.querySelector(`[name="${name}"]`);
  if (!el) return;
  el.style.outline = "2px solid #e53e3e";
  el.focus();
  el.addEventListener("input", () => (el.style.outline = ""), { once: true });
}

/** 成功后重置：清空预览 & 表单 */
function resetBomForm() {
  // 清空 BOM 数据
  window.bomRows = [];

  // 清空文件输入
  const fileInput = document.getElementById("bomFile") || document.querySelector('input[type="file"]');
  if (fileInput) fileInput.value = "";

  // 清空预览表格
  const preview = document.getElementById("bomPreview") || document.querySelector(".bom-preview");
  if (preview) preview.innerHTML = "";

  // 清空联系人字段
  const fields = ["company", "contact", "email", "whatsapp", "qty", "order_type", "notes"];
  fields.forEach((name) => {
    const el = document.querySelector(`[name="${name}"]`);
    if (el) el.value = "";
  });

  // 关闭模态框（兼容常见写法）
  const modal =
    document.getElementById("bomModal") ||
    document.getElementById("inquiryModal") ||
    document.querySelector(".modal.active") ||
    document.querySelector(".modal[style*='display: block']");

  if (modal) {
    modal.style.display = "none";
    modal.classList.remove("active", "show");
  }
}

/** Toast 提示（若项目已有 showToast 则复用，否则降级 alert） */
function showBomToast(type, message) {
  // 复用项目已有函数
  if (typeof showToast === "function") {
    showToast(type, message);
    return;
  }
  if (typeof showNotification === "function") {
    showNotification(message, type);
    return;
  }

  // 降级：注入简单 toast
  const existing = document.getElementById("__bomToast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "__bomToast";
  Object.assign(toast.style, {
    position:     "fixed",
    bottom:       "24px",
    right:        "24px",
    padding:      "14px 22px",
    borderRadius: "8px",
    color:        "#fff",
    fontSize:     "14px",
    lineHeight:   "1.5",
    whiteSpace:   "pre-line",
    zIndex:       "99999",
    boxShadow:    "0 4px 16px rgba(0,0,0,.2)",
    background:   type === "success" ? "#2f855a" : "#c53030",
    maxWidth:     "360px",
    transition:   "opacity .3s",
  });
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 400);
  }, 4500);
}

/* ─── spinner CSS（若项目已有可删除） ───────────────────── */
(function injectSpinnerStyle() {
  if (document.getElementById("__bomSpinnerStyle")) return;
  const style = document.createElement("style");
  style.id = "__bomSpinnerStyle";
  style.textContent = `
    .spinner {
      display: inline-block;
      width: 14px; height: 14px;
      border: 2px solid rgba(255,255,255,.4);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin .7s linear infinite;
      vertical-align: middle;
      margin-right: 6px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `;
  document.head.appendChild(style);
})();
