const RENDER_BACKEND_URL = "https://pronotexp-api.onrender.com";
const API_BASE_URL =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? ""
    : RENDER_BACKEND_URL;

// UI state: track the active tab and cached QR payload processed from the uploaded image.
let currentTab = "qr";
let extractedQRData = null;

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
}

// Show feedback for the user while the app is processing login and export steps.
function setStatus(text, isError = false) {
  const statusEl = document.getElementById("status");
  statusEl.innerText = text;
  statusEl.classList.toggle("error", isError);
}

// Restrict the PIN field to digits only, mirroring the 4-digit constraint on input.
document.getElementById("qr-pin").addEventListener("input", (e) => {
  e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4);
});

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
  const btnDownload = document.getElementById("btn-download");
  btnDownload.classList.add("hidden");

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

    const jsonResult = await res.json();

    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(jsonResult, null, 4));
    btnDownload.href = dataStr;
    btnDownload.classList.remove("hidden");

    setStatus("🎉 Données exportées avec succès !");
  } catch (err) {
    setStatus(`❌ ${err.message}`, true);
  } finally {
    btnExport.disabled = false;
    btnExport.innerText = originalLabel;
  }
}