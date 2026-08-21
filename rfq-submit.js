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

  container.innerHTML = list.map((item) => `
    <div class="rfq-item-row">
      <span class="rfq-col-size">${item.size || "—"}</span>
      <span class="rfq-col-code">${escRfq(item.liaCode)}</span>
      <span class="rfq-col-qty" style="display:flex;align-items:center;gap:4px;">
        <button type="button" style="border:1px solid #ccc;background:#f5f5f5;border-radius:4px;padding:0 6px;cursor:pointer;" onclick="updateSidebarQty('${item.liaCode}', -1)">−</button>
        <input type="number" min="1" id="qty-sidebar-${item.liaCode}" value="${escRfq(item.qty)}" style="width:50px;text-align:center;padding:2px;border:1px solid #ddd;border-radius:4px;font-size:14px;" onchange="updateSidebarQtyInput('${item.liaCode}')">
        <button type="button" style="border:1px solid #ccc;background:#f5f5f5;border-radius:4px;padding:0 6px;cursor:pointer;" onclick="updateSidebarQty('${item.liaCode}', 1)">+</button>
      </span>
      <button type="button" class="rfq-col-remove" title="Remove"
        onclick="removeRFQ('${escRfq(item.liaCode)}')">&times;</button>
    </div>
  `).join("");
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
    } else {
      console.warn("RFQ submission returned a non-OK status, but UI will reset.");
    }

  } catch (err) {
    console.error("[submitRFQ] failed:", err);
    alert("❌ Submission failed. Please check your input and try again.");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = originalBtnText;
    }

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
  }
}

// ============================================================
// DOM 就绪后自动渲染
// ============================================================

document.addEventListener("DOMContentLoaded", function() {
  renderRfqPanel();

  // 绑定提交按钮
  const submitBtn = document.getElementById("submitRfqBtn");
  if (submitBtn) {
    submitBtn.addEventListener("click", function(e) {
      e.preventDefault();
      submitRFQ();
    });
  }
});