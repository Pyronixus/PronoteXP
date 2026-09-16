// Export logic: JSON packaging + structured XLSX/ODS table generation from exportedJson.

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

// Known backend field names -> human French labels.
const FIELD_LABELS = {
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
  coefficient: "Coefficient",
  comment: "Commentaire",
  student: "Élève",
  class_average: "Moyenne classe",
  max: "Max",
  min: "Min",
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
};

function humanizeKey(key) {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  return key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function humanizeValue(value) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const d = new Date(value);
    if (!isNaN(d)) {
      const hasTime =
        /T\d{2}:\d{2}/.test(value) && !value.includes("T00:00:00");
      return hasTime
        ? d.toLocaleString("fr-FR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : d.toLocaleDateString("fr-FR");
    }
  }
  return value;
}

// Flattens a nested object into { "Label parent - Label enfant": valeur } with French labels.
function flattenTranslated(value, prefix = "", result = {}) {
  if (value === null || value === undefined) {
    result[prefix || "Valeur"] = "";
    return result;
  }
  if (Array.isArray(value)) {
    result[prefix || "Valeur"] = value
      .map((entry) =>
        entry && typeof entry === "object"
          ? Object.values(flattenTranslated(entry)).join(", ")
          : humanizeValue(entry),
      )
      .join(" | ");
    return result;
  }
  if (typeof value === "object") {
    Object.entries(value).forEach(([key, entry]) => {
      const label = humanizeKey(key);
      flattenTranslated(entry, prefix ? `${prefix} - ${label}` : label, result);
    });
    return result;
  }
  result[prefix || "Valeur"] = humanizeValue(value);
  return result;
}

// Fallback extraction for any category without a dedicated shape below.
function genericRows(value) {
  if (Array.isArray(value)) {
    return value.length ? value.map((row) => flattenTranslated(row)) : [];
  }
  if (value && typeof value === "object") {
    return Object.entries(value).map(([key, entry]) => ({
      Champ: humanizeKey(key),
      Valeur:
        entry && typeof entry === "object"
          ? Object.values(flattenTranslated(entry)).join(", ")
          : humanizeValue(entry),
    }));
  }
  return [{ Valeur: humanizeValue(value) }];
}

function periodsRows(value) {
  if (!Array.isArray(value)) return genericRows(value);
  const rows = [];
  value.forEach((period) => {
    (period.grades || []).forEach((grade) => {
      rows.push({
        Période: period.name,
        Type: "Note",
        Matière: grade.subject,
        Date: humanizeValue(grade.date),
        Valeur: grade.grade,
        Sur: grade.out_of,
        Coefficient: grade.coefficient,
        Commentaire: grade.comment,
      });
    });
    (period.averages || []).forEach((average) => {
      rows.push({
        Période: period.name,
        Type: "Moyenne",
        Matière: average.subject,
        Valeur: average.student,
        "Moyenne classe": average.class_average,
        Max: average.max,
        Min: average.min,
      });
    });
  });
  return rows.length ? rows : genericRows(value);
}

function timetableRows(value) {
  if (!Array.isArray(value) || !value.length) return genericRows(value);
  return value.map((lesson) => ({
    Matière: lesson.subject ?? "",
    Professeur: lesson.teacher ?? "",
    Salle: lesson.classroom ?? "",
    Début: humanizeValue(lesson.start),
    Fin: humanizeValue(lesson.end),
    Annulé: humanizeValue(lesson.canceled),
  }));
}

function homeworkRows(value) {
  if (!Array.isArray(value) || !value.length) return genericRows(value);
  return value.map((hw) => ({
    Matière: hw.subject ?? "",
    Description: hw.description ?? "",
    "À faire pour le": humanizeValue(hw.date),
    Fait: humanizeValue(hw.done),
  }));
}

function absencesRows(value) {
  if (!Array.isArray(value) || !value.length) return genericRows(value);
  return value.map((a) => ({
    Du: humanizeValue(a.from),
    Au: humanizeValue(a.to),
    Jours: a.days ?? "",
    Heures: a.hours ?? "",
    Justifié: humanizeValue(a.justified),
    Motif: (a.reasons || []).join(", "),
  }));
}

function delaysRows(value) {
  if (!Array.isArray(value) || !value.length) return genericRows(value);
  return value.map((d) => ({
    Date: humanizeValue(d.date),
    Minutes: d.minutes ?? "",
    Justifié: humanizeValue(d.justified),
    Justification: d.justification ?? "",
    Motif: (d.reasons || []).join(", "),
  }));
}

function punishmentsRows(value) {
  if (!Array.isArray(value) || !value.length) return genericRows(value);
  return value.map((p) => ({
    Date: humanizeValue(p.given),
    Nature: p.nature ?? "",
    Motif: (p.reasons || []).join(", "),
    Donné_par: p.giver ?? "",
    Circonstances: p.circumstances ?? "",
    "Devoir donné": p.homework ?? "",
    "Pendant le cours": humanizeValue(p.during_lesson),
    Exclusion: humanizeValue(p.exclusion),
    "Durée (min)": p.duration ?? "",
  }));
}

function newsRows(value) {
  if (!Array.isArray(value) || !value.length) return genericRows(value);
  return value.map((n) => ({
    Titre: n.title ?? "",
    Catégorie: n.category ?? "",
    Auteur: n.author ?? "",
    Publié_le: humanizeValue(n.start_date),
    Lu: humanizeValue(n.read),
    Contenu: n.content ?? "",
  }));
}

function menusRows(value) {
  if (!Array.isArray(value) || !value.length) return genericRows(value);
  const meal = (m) => (m.is_lunch ? "Déjeuner" : m.is_dinner ? "Dîner" : "");
  const join = (list) => (list || []).join(", ");
  return value.map((m) => ({
    Date: humanizeValue(m.date),
    Repas: meal(m),
    Entrée: join(m.first_meal),
    Plat: join(m.main_meal),
    Accompagnement: join(m.side_meal),
    Fromage: join(m.cheese),
    Dessert: join(m.dessert),
    Autre: join(m.other_meal),
  }));
}

const CATEGORY_ROW_BUILDERS = {
  periods: periodsRows,
  timetable: timetableRows,
  homework: homeworkRows,
  absences: absencesRows,
  delays: delaysRows,
  punishments: punishmentsRows,
  news: newsRows,
  menus: menusRows,
};

function rowsForCategory(category, value) {
  const builder = CATEGORY_ROW_BUILDERS[category];
  return builder ? builder(value) : genericRows(value);
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

function addSheet(workbook, name, value, category = "") {
  const rows = rowsForCategory(category, value);
  const sheet = XLSX.utils.json_to_sheet(
    rows.length ? rows : [{ Information: "Aucune donnée" }],
  );
  const columns = rows.length
    ? [...new Set(rows.flatMap((row) => Object.keys(row)))]
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