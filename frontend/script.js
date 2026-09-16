const RENDER_BACKEND_URL = "https://pronotexp-api.onrender.com";
const isGitHubPages = window.location.hostname.endsWith(".github.io");
const API_BASE_URL = isGitHubPages ? RENDER_BACKEND_URL : "";

// UI state: track the active tab and cached QR payload processed from the uploaded image.
let currentTab = "qr";
let extractedQRData = null;
let exportedJson = null;

const categoryLabels = {
  periods: "notes",
  timetable: "emploi_du_temps",
  homework: "devoirs",
  absences: "absences",
  delays: "retards",
  punishments: "punitions",
  news: "actualites",
  menus: "menus",
};

const categorySheetLabels = {
  periods: "Notes et moyennes",
  timetable: "Emploi du temps",
  homework: "Devoirs",
  absences: "Absences",
  delays: "Retards",
  punishments: "Punitions",
  news: "Actualités",
  menus: "Menus",
};

const tableFieldLabels = {
  periode: "Période",
  type: "Type",
  matiere: "Matière",
  subject: "Matière",
  teacher: "Professeur",
  classroom: "Salle",
  start: "Début",
  end: "Fin",
  canceled: "Annulé",
  description: "Description",
  done: "Fait",
  date: "Date",
  name: "Nom",
  class_name: "Classe",
  establishment: "Établissement",
  grade: "Note",
  out_of: "Sur",
  sur: "Sur",
  coefficient: "Coefficient",
  comment: "Commentaire",
  commentaire: "Commentaire",
  student: "Élève",
  class_average: "Moyenne de classe",
  moyenne_classe: "Moyenne de classe",
  max: "Maximum",
  maximum: "Maximum",
  min: "Minimum",
  minimum: "Minimum",
  from: "Du",
  to: "Au",
  hours: "Heures",
  justified: "Justifié",
  reason: "Motif",
  minutes: "Minutes",
  nature: "Nature",
  given_by: "Donné par",
  exclusion: "Exclusion",
  duration: "Durée",
  schedule: "Créneau",
  during_lesson: "Pendant le cours",
  title: "Titre",
  content: "Contenu",
  category: "Catégorie",
  read: "Lu",
  creation_date: "Date de création",
  start_date: "Date de début",
  end_date: "Date de fin",
  is_lunch: "Déjeuner",
  is_dinner: "Dîner",
  meal: "Repas",
  dishes: "Plats",
  food: "Plats",
  app: "Application",
  generated_at: "Généré le",
  logged_in: "Connecté",
  information: "Information",
};

function tableLabel(key) {
  if (tableFieldLabels[key]) return tableFieldLabels[key];
  return key
    .replace(/_/g, " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

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

function openTableModal() {
  const modal = document.getElementById("table-modal");
  modal.classList.remove("hidden");
  document.getElementById("table-format").focus();
}

function closeTableModal() {
  document.getElementById("table-modal").classList.add("hidden");
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

function downloadBlob(content, filename, type = "application/json") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function preparedExport() {
  const categories = selectedCategories();
  const splitFiles = document.getElementById("split-files").checked;
  const result = {
    export_metadata: exportedJson.export_metadata || {},
    user_info: exportedJson.user_info || {},
  };
  const separate = {};

  categories.forEach((category) => {
    result[category] = exportedJson[category] || [];
    if (splitFiles) {
      separate[category] = result[category];
      delete result[category];
    }
  });
  return { result, separate, categories, splitFiles };
}

function downloadPreparedJson() {
  if (!exportedJson) return;
  const { result, separate, categories, splitFiles } = preparedExport();
  if (!categories.length) {
    setStatus("❌ Sélectionnez au moins une catégorie.", true);
    return;
  }
  downloadBlob(JSON.stringify(result, null, 2), "export_pronote.json");
  Object.entries(separate).forEach(([category, data]) => {
    downloadBlob(
      JSON.stringify(data, null, 2),
      `export_pronote_${categoryLabels[category]}.json`,
    );
  });
  setStatus(
    splitFiles
      ? "✅ JSON principal et fichiers séparés téléchargés."
      : "✅ JSON téléchargé.",
  );
}

function flattenObject(value, prefix = "", result = {}) {
  if (value === null || value === undefined) {
    result[prefix || "valeur"] = "";
    return result;
  }
  if (typeof value !== "object" || value instanceof Date) {
    result[prefix || "valeur"] = value;
    return result;
  }
  if (Array.isArray(value)) {
    result[prefix || "valeur"] = value
      .map((entry) =>
        typeof entry === "object" ? JSON.stringify(entry) : entry,
      )
      .join(" | ");
    return result;
  }
  Object.entries(value).forEach(([key, entry]) => {
    flattenObject(entry, prefix ? `${prefix}_${key}` : key, result);
  });
  return result;
}

function rowsFromValue(value) {
  if (Array.isArray(value)) {
    return value.length ? value.map((row) => flattenObject(row)) : [];
  }
  if (value && typeof value === "object") {
    return Object.entries(value).map(([key, entry]) => ({
      champ: key,
      valeur:
        typeof entry === "object" && entry !== null
          ? JSON.stringify(entry)
          : (entry ?? ""),
    }));
  }
  return [{ valeur: value ?? "" }];
}

function rowsForCategory(category, value) {
  if (category !== "periods" || !Array.isArray(value))
    return rowsFromValue(value);

  const rows = [];
  value.forEach((period) => {
    (period.grades || []).forEach((grade) => {
      rows.push({
        periode: period.name,
        type: "Note",
        matiere: grade.subject,
        date: grade.date,
        valeur: grade.grade,
        sur: grade.out_of,
        coefficient: grade.coefficient,
        commentaire: grade.comment,
      });
    });
    (period.averages || []).forEach((average) => {
      rows.push({
        periode: period.name,
        type: "Moyenne",
        matiere: average.subject,
        valeur: average.student,
        moyenne_classe: average.class_average,
        maximum: average.max,
        minimum: average.min,
      });
    });
  });
  return rows.length ? rows : rowsFromValue(value);
}

function addSheet(workbook, name, value, category = "") {
  const rows = rowsForCategory(category, value);
  const translatedRows = (
    rows.length ? rows : [{ information: "Aucune donnée" }]
  ).map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, entry]) => [tableLabel(key), entry]),
    ),
  );
  const sheet = XLSX.utils.json_to_sheet(translatedRows);
  const columns = translatedRows.length
    ? [...new Set(translatedRows.flatMap((row) => Object.keys(row)))]
    : ["Information"];
  sheet["!cols"] = columns.map((column) => ({
    wch: Math.min(Math.max(column.length + 2, 14), 32),
  }));
  XLSX.utils.book_append_sheet(workbook, sheet, name.slice(0, 31));
}

function createWorkbook(categories, includeAllData = true) {
  const workbook = XLSX.utils.book_new();
  if (includeAllData) {
    addSheet(workbook, "Informations", exportedJson.user_info || {});
    addSheet(workbook, "Métadonnées", exportedJson.export_metadata || {});
  }
  categories.forEach((category) => {
    addSheet(
      workbook,
      categorySheetLabels[category],
      exportedJson[category],
      category,
    );
  });
  return workbook;
}

function downloadTableFiles() {
  if (!exportedJson) return;
  const { categories, splitFiles } = preparedExport();
  if (!categories.length) {
    setStatus("❌ Sélectionnez au moins une catégorie.", true);
    return;
  }
  const format = document.getElementById("table-format").value;
  const extension = format === "ods" ? "ods" : "xlsx";
  const bookType = extension;

  if (splitFiles) {
    categories.forEach((category) => {
      const workbook = createWorkbook([category], false);
      XLSX.writeFile(
        workbook,
        `export_pronote_${categoryLabels[category]}.${extension}`,
        { bookType },
      );
    });
    setStatus(
      `✅ ${categories.length} fichiers ${extension.toUpperCase()} téléchargés.`,
    );
    closeTableModal();
    return;
  }

  const workbook = createWorkbook(categories);
  XLSX.writeFile(workbook, `export_pronote.${extension}`, { bookType });
  setStatus(`✅ Tableau ${extension.toUpperCase()} téléchargé.`);
  closeTableModal();
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
  if (event.key === "Escape") closeTableModal();
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
    document.getElementById("export-options").classList.remove("hidden");

    setStatus("🎉 Données exportées avec succès !");
  } catch (err) {
    setStatus(`❌ ${err.message}`, true);
  } finally {
    btnExport.disabled = false;
    btnExport.innerText = originalLabel;
  }
}
