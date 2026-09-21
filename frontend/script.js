const RENDER_BACKEND_URL = "https://pronotexp-api.onrender.com";
const isGitHubPages = window.location.hostname.endsWith(".github.io");
const API_BASE_URL = isGitHubPages ? RENDER_BACKEND_URL : "";

// UI state: track the active tab and cached QR payload processed from the uploaded image.
let currentTab = "qr";
let extractedQRData = null;
let exportedJson = null;
// Switch the visible form section while updating the active tab styling.
function setTab(tab) {
  currentTab = tab;
  const tabs = ["qr", "token", "cred"];
  tabs.forEach((t) => {
    const btn = document.getElementById(`btn-tab-${t}`);
    const sec = document.getElementById(`section-${t}`);
    const active = t === tab;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-selected", String(active));
    sec.classList.toggle("hidden", !active);
  });
  updateTutorialButton();
}

// Show feedback for the user while the app is processing login and export steps.
function setStatus(text, isError = false) {
  const statusEl = document.getElementById("status");
  statusEl.innerText = text;
  statusEl.classList.toggle("error", isError);
}

function openTableModal() {
  const modal = document.getElementById("table-modal");
  modal.classList.remove("hidden");
  document.getElementById("table-format").focus();
}

function closeTableModal() {
  document.getElementById("table-modal").classList.add("hidden");
}

function isEmptyCategory(value) {
  if (value === null || value === undefined || value === "") return true;
  if (Array.isArray(value))
    return value.length === 0 || value.every(isEmptyCategory);
  if (typeof value === "object")
    return Object.values(value).every(isEmptyCategory);
  return false;
}

function updateCategoryStates() {
  document.querySelectorAll(".category-list .check-item").forEach((item) => {
    const category = item.dataset.category;
    const empty = isEmptyCategory(exportedJson?.[category]);
    item.classList.toggle("is-empty", empty);
    item.querySelector(".category-badge").innerText = empty
      ? "Vide"
      : item.dataset.scope;
    item.setAttribute(
      "aria-label",
      `${item.querySelector("strong").innerText}${empty ? " - catégorie vide" : ""}`,
    );
  });
}

function selectedCategories() {
  return [...document.querySelectorAll(".category-list input:checked")].map(
    (input) => input.value,
  );
}

function toggleAllCategories() {
  const inputs = [...document.querySelectorAll(".category-list input")];
  const shouldCheck = inputs.some((input) => !input.checked);
  inputs.forEach((input) => {
    input.checked = shouldCheck;
  });
  updateCategorySummary();
}

function updateCategorySummary() {
  const count = selectedCategories().length;
  document.querySelector(".summary-hint").innerText = count
    ? `${count} catégorie${count > 1 ? "s" : ""}`
    : "Aucune catégorie";
}

// Restrict the PIN field to digits only, mirroring the 4-digit constraint on input.
document.getElementById("qr-pin").addEventListener("input", (e) => {
  e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4);
});

document.querySelectorAll(".category-list input").forEach((input) => {
  input.addEventListener("change", updateCategorySummary);
});
updateCategorySummary();

const categoryMenu = document.querySelector(".category-menu");
const categorySummary = categoryMenu.querySelector("summary");
categorySummary.addEventListener("click", (event) => {
  event.preventDefault();
  if (categoryMenu.classList.contains("is-open")) {
    categoryMenu.classList.add("is-closing");
    categoryMenu.classList.remove("is-open");
    window.setTimeout(() => {
      categoryMenu.open = false;
      categoryMenu.classList.remove("is-closing");
    }, 220);
    return;
  }
  categoryMenu.open = true;
  window.requestAnimationFrame(() => categoryMenu.classList.add("is-open"));
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeTableModal();
    closeTutorialModal();
  }
});

updateTutorialButton();

// Clear any previously decoded QR payload as soon as a new file is picked.
function readQRCodeImage(input) {
  extractedQRData = null;
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  const reader = new FileReader();

  reader.onload = function (e) {
    const img = new Image();
    img.onload = function () {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0, img.width, img.height);

      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (code) {
        try {
          extractedQRData = JSON.parse(code.data);
          setStatus("✅ Image QR Code lue avec succès !");
        } catch (err) {
          extractedQRData = code.data;
          setStatus("✅ QR Code détecté !");
        }
      } else {
        extractedQRData = null;
        setStatus("❌ Impossible de déchiffrer le QR Code.", true);
      }
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

// Main request logic: validate form fields, call the correct endpoint, and save the export.
async function startExport() {
  const btnExport = document.getElementById("btn-export");
  document.getElementById("export-options").classList.add("hidden");
  exportedJson = null;

  let endpoint = "";
  let payload = {};

  // QR mode requires an uploaded QR payload and a 4-digit PIN.
  if (currentTab === "qr") {
    const pin = document.getElementById("qr-pin").value;
    if (!extractedQRData) {
      setStatus("❌ Veuillez sélectionner un QR Code.", true);
      return;
    }
    if (!pin || pin.length !== 4) {
      setStatus("❌ Veuillez saisir votre code PIN à 4 chiffres.", true);
      return;
    }
    endpoint = `${API_BASE_URL}/api/export/qrcode`;
    payload = { qr_data: extractedQRData, pin: pin };

    // Token-based mode sends the PRONOTE URL, username, and session token to the backend.
  } else if (currentTab === "token") {
    const url = document.getElementById("token-url").value.trim();
    const user = document.getElementById("token-user").value.trim();
    const token = document.getElementById("token-val").value.trim();

    if (!url || !user || !token) {
      setStatus("❌ Remplissez l'URL, l'identifiant et le jeton.", true);
      return;
    }
    endpoint = `${API_BASE_URL}/api/export/token`;
    payload = { url: url, username: user, token: token };

    // Manual credentials use the selected ENT/backend login mode when available.
  } else {
    const url = document.getElementById("cred-url").value.trim();
    const user = document.getElementById("cred-user").value.trim();
    const pass = document.getElementById("cred-pass").value;
    const entName = document.getElementById("cred-ent").value;

    if (!url || !user || !pass) {
      setStatus("❌ Veuillez remplir tous les champs d'identifiants.", true);
      return;
    }
    endpoint = `${API_BASE_URL}/api/export/credentials`;
    payload = {
      url: url,
      username: user,
      password: pass,
      ent_name: entName || null,
    };
  }

  const originalLabel = btnExport.innerText;
  btnExport.disabled = true;
  btnExport.innerText = "Connexion en cours…";
  setStatus("⏳ Connexion en cours...");

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorMsg = await res.json();
      throw new Error(errorMsg.detail || "Erreur d'exportation.");
    }

    exportedJson = await res.json();
    updateCategoryStates();
    document.getElementById("export-options").classList.remove("hidden");

    setStatus("🎉 Données exportées avec succès !");
  } catch (err) {
    setStatus(`❌ ${err.message}`, true);
  } finally {
    btnExport.disabled = false;
    btnExport.innerText = originalLabel;
  }
}
