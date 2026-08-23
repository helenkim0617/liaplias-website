// ============================================================
// RFQ 核心功能 - 全站共享
// ============================================================

const RFQ_STORAGE_KEY = "liaplias_rfq_list";

function getRFQ() {
  try {
    const raw = localStorage.getItem(RFQ_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function saveRFQ(list) {
  try {
    localStorage.setItem(RFQ_STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.error(err);
  }
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
  const countEl = document.getElementById("rfqCount");
  if (countEl) countEl.textContent = list.length;

  if (list.length === 0) {
    container.innerHTML = '<p class="rfq-empty">No items added yet.</p>';
    return;
  }

  container.innerHTML = list.map((item, index) => `
    <div class="rfq-item-row" data-rfq-index="${index}">
      <span class="rfq-col-size">${escRfq(item.size || "—")}</span>
      <span class="rfq-col-code">${escRfq(item.liaCode)}</span>
      <span class="rfq-col-qty" style="display:flex;align-items:center;gap:4px;">
        <button type="button" class="rfq-qty-btn" data-rfq-action="decrement" style="border:1px solid #ccc;background:#f5f5f5;border-radius:4px;padding:0 6px;cursor:pointer;">−</button>
        <input type="number" min="1" value="${escRfq(item.qty)}" class="rfq-qty-input" style="width:50px;text-align:center;padding:2px;border:1px solid #ddd;border-radius:4px;font-size:14px;">
        <button type="button" class="rfq-qty-btn" data-rfq-action="increment" style="border:1px solid #ccc;background:#f5f5f5;border-radius:4px;padding:0 6px;cursor:pointer;">+</button>
      </span>
      <button type="button" class="rfq-col-remove" title="Remove" data-rfq-action="remove">&times;</button>
    </div>
  `).join("");
}

function getRfqItemCodeFromControl(control) {
  const row = control.closest(".rfq-item-row");
  if (!row) return "";

  const index = Number(row.dataset.rfqIndex);
  const item = getRFQ()[index];
  return item ? item.liaCode : "";
}

function toggleRfqPanel(forceOpen) {
  const panel = document.getElementById("rfqPanel");
  if (!panel) return;
  if (forceOpen === true) panel.classList.add("open");
  else if (forceOpen === false) panel.classList.remove("open");
  else panel.classList.toggle("open");
}

function updateSidebarQty(liaCode, delta) {
  const list = getRFQ();
  const item = list.find(i => i.liaCode === liaCode);
  if (item) {
    item.qty = Math.max(1, item.qty + delta);
    saveRFQ(list);
  }
}

function updateSidebarQtyInput(liaCode, nextValue) {
  const list = getRFQ();
  const item = list.find(i => i.liaCode === liaCode);
  if (!item) return;

  let val = parseInt(nextValue, 10);
  if (isNaN(val) || val < 1) val = 1;
  item.qty = val;
  saveRFQ(list);
}

// ============================================================
// 提交 RFQ
// ============================================================

async function submitRFQ() {
  const list = getRFQ();
  if (list.length === 0) {
    alert("Your RFQ list is empty.");
    return;
  }

  const nameInput = document.getElementById("rfqName");
  const emailInput = document.getElementById("rfqEmail");
  const companyInput = document.getElementById("rfqCompany");

  const contactName = nameInput ? nameInput.value.trim() : "";
  const inquiryEmail = emailInput ? emailInput.value.trim() : "";
  const inquiryCompany = companyInput ? companyInput.value.trim() : "";

  if (!contactName) {
    alert("Please enter your contact name.");
    return;
  }
  if (!inquiryEmail) {
    alert("Please enter your email address.");
    return;
  }
  if (!inquiryCompany) {
    alert("Please enter your company name.");
    return;
  }

  const submitBtn = document.getElementById("submitRfqBtn");
  const originalBtnText = submitBtn ? submitBtn.innerText : "Submit RFQ";
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = "Submitting...";
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
      alert("✅ RFQ submitted successfully! Our team will contact you shortly.");

      // 仅在真正提交成功后才清空表单和询价单，保留失败时用户已填写的数据
      setTimeout(function() {
        document.querySelectorAll("input[type='checkbox']").forEach(function(el) {
          el.checked = false;
        });
        document.querySelectorAll(".qty-stepper").forEach(function(el) {
          el.style.display = "none";
        });
        document.querySelectorAll(".qty-placeholder").forEach(function(el) {
          el.style.display = "inline";
        });
        if (typeof updateSelectedCount === 'function') {
          updateSelectedCount();
        }
        clearRFQ();
        if (nameInput) nameInput.value = "";
        if (emailInput) emailInput.value = "";
        if (companyInput) companyInput.value = "";
        toggleRfqPanel(false);
      }, 200);
    } else {
      const message = result.error || result.message || `Server error ${response.status}`;
      throw new Error(message);
    }

  } catch (err) {
    console.error("[submitRFQ] failed:", err);
    alert("❌ Submission failed. Please check your input and try again.");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = originalBtnText;
    }
  }
}

// ============================================================
// DOM 就绪后自动渲染
// ============================================================

document.addEventListener("DOMContentLoaded", function() {
  renderRfqPanel();

  const rfqItems = document.getElementById("rfqItems");
  if (rfqItems) {
    rfqItems.addEventListener("click", function(e) {
      const actionControl = e.target.closest("[data-rfq-action]");
      if (!actionControl) return;

      const liaCode = getRfqItemCodeFromControl(actionControl);
      if (!liaCode) return;

      const action = actionControl.dataset.rfqAction;
      if (action === "increment") updateSidebarQty(liaCode, 1);
      else if (action === "decrement") updateSidebarQty(liaCode, -1);
      else if (action === "remove") removeRFQ(liaCode);
    });

    rfqItems.addEventListener("change", function(e) {
      if (!e.target.classList.contains("rfq-qty-input")) return;

      const liaCode = getRfqItemCodeFromControl(e.target);
      if (liaCode) updateSidebarQtyInput(liaCode, e.target.value);
    });
  }

  // 绑定提交按钮
  const submitBtn = document.getElementById("submitRfqBtn");
  if (submitBtn) {
    submitBtn.addEventListener("click", function(e) {
      e.preventDefault();
      submitRFQ();
    });
  }
});
