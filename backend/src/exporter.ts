import { Client, Period, type ENTFunction } from "pronotets";
import * as ent from "pronotets/ent";

export interface CredentialsPayload {
  url: string;
  username: string;
  password: string;
  ent_name?: string | null;
}

export interface QRCodePayload {
  qr_data: Record<string, unknown> | string;
  pin: string;
}

export interface TokenPayload {
  url: string;
  username: string;
  token: string;
}

type ExportData = Record<string, unknown> & {
  export_metadata: Record<string, unknown>;
  user_info: Record<string, unknown>;
  periods: Record<string, unknown>[];
  timetable: Record<string, unknown>[];
  homework: Record<string, unknown>[];
  absences: Record<string, unknown>[];
  delays: Record<string, unknown>[];
  punishments: Record<string, unknown>[];
  news: Record<string, unknown>[];
  menus: Record<string, unknown>[];
};

/**
 * Normalize the establishment URL so it can be passed consistently to the client.
 */
function cleanPronoteUrl(rawUrl: string): string {
  const url = new URL(rawUrl.trim());
  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/eleve\.html\/?$/i, "/");
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  return url.toString();
}

/** ENT names accepted by the frontend and mapped to available providers. */
const ENT_PROVIDERS: Record<string, ENTFunction | undefined> = {
  "": undefined,
  none: undefined,
  monlycee_net: ent.ileDeFrance,
  ile_de_france: ent.ileDeFrance,
  ent77: ent.ent77,
  ecollege78: ent.entEcollege78,
  entEssonne: ent.entEssonne,
  parisClasseNumerique: ent.parisClasseNumerique,
  lyceeconnecteAquitaine: ent.lyceeconnecteAquitaine,
  entHdf: ent.entHdf,
  occitanie: ent.occitanieMontpellier,
  occitanieEduconnect: ent.occitanieMontpellierEduconnect,
  acRennes: ent.acRennes,
};

function getEntProvider(name?: string | null): ENTFunction | undefined {
  if (!name) return undefined;
  const provider = ENT_PROVIDERS[name];
  if (!(name in ENT_PROVIDERS)) {
    throw new Error(`ENT non supporté par cette version de PronoteXP : ${name}`);
  }
  return provider;
}

function recordError(exportData: ExportData, key: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  exportData.export_metadata.errors ??= {};
  (exportData.export_metadata.errors as Record<string, string>)[key] =
    `${error instanceof Error ? error.constructor.name : "Error"}: ${message}`;
}

function stableNormalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableNormalize);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(record)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, stableNormalize(item)])
    );
  }
  return value;
}

function deduplicateRecords<T>(records: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const record of records) {
    if (record == null) continue;
    const signature = JSON.stringify(stableNormalize(record));
    if (seen.has(signature)) continue;
    seen.add(signature);
    result.push(record);
  }
  return result;
}

function foodNames(foods: unknown): string[] {
  if (!Array.isArray(foods)) return [];
  return foods.map((food) => {
    if (typeof food === "string") return food;
    if (food && typeof food === "object" && "name" in food) {
      return String((food as { name?: unknown }).name ?? "");
    }
    return String(food ?? "");
  });
}

function createExportData(loggedIn: boolean): ExportData {
  return {
    export_metadata: {
      app: "PronoteXP",
      generated_at: new Date().toISOString(),
      logged_in: loggedIn,
      backend: "pronoteTs",
    },
    user_info: {},
    periods: [],
    timetable: [],
    homework: [],
    absences: [],
    delays: [],
    punishments: [],
    news: [],
    menus: [],
  };
}

export async function extractPronoteData(client: Client): Promise<ExportData> {
  // pronoteTs keeps Period objects in a static Set for Grade.period resolution.
  // The exporter serializes explicit fields only, so release those references after each invocation.
  const today = new Date();
  const exportData = createExportData(client.logged_in);
  const periods = client.periods;

  try {
    exportData.user_info = {
      name: client.info.name,
      class_name: client.info.className,
      establishment: client.info.establishment,
    };
  } catch {
    // User info is optional; continue exporting the other categories.
  }

  for (const period of periods) {
    const periodData: Record<string, unknown> = {
      id: period.id,
      name: period.name,
      start: period.start.toISOString(),
      end: period.end.toISOString(),
      overall_average: null,
      class_overall_average: null,
      grades: [],
      averages: [],
    };

    try {
      periodData.overall_average = await period.overallAverage();
    } catch (error) {
      recordError(exportData, `periods[${period.name}].overall_average`, error);
    }

    try {
      periodData.class_overall_average = await period.classOverallAverage();
    } catch (error) {
      recordError(exportData, `periods[${period.name}].class_overall_average`, error);
    }

    try {
      const grades = await period.grades();
      periodData.grades = grades.map((grade) => ({
        id: grade.id,
        subject: grade.subject?.name ?? null,
        date: grade.date.toISOString(),
        grade: grade.grade,
        out_of: grade.outOf,
        coefficient: grade.coefficient ?? null,
        comment: grade.comment ?? null,
        average: grade.average ?? null,
        max: grade.max ?? null,
        min: grade.min ?? null,
        is_bonus: grade.isBonus,
        is_optional: grade.isOptionnal,
      }));
    } catch (error) {
      recordError(exportData, `grades[${period.name}]`, error);
    }

    try {
      const averages = await period.averages();
      periodData.averages = averages.map((average) => ({
        subject: average.subject?.name ?? null,
        student: average.student,
        out_of: average.outOf,
        class_average: average.classAverage,
        max: average.max,
        min: average.min,
      }));
    } catch (error) {
      recordError(exportData, `averages[${period.name}]`, error);
    }

    try {
      const absences = await period.absences();
      exportData.absences.push(
        ...absences.map((absence) => ({
          id: absence.id,
          from: absence.fromDate.toISOString(),
          to: absence.toDate.toISOString(),
          justified: absence.justified,
          hours: absence.hours ?? null,
          days: absence.days,
          reasons: absence.reasons,
        }))
      );
    } catch (error) {
      recordError(exportData, `absences[${period.name}]`, error);
    }

    try {
      const delays = await period.delays();
      exportData.delays.push(
        ...delays.map((delay) => ({
          id: delay.id,
          date: delay.date.toISOString(),
          minutes: delay.minutes,
          justified: delay.justified,
          justification: delay.justification ?? null,
          reasons: delay.reasons,
        }))
      );
    } catch (error) {
      recordError(exportData, `delays[${period.name}]`, error);
    }

    try {
      const punishments = await period.punishments();
      exportData.punishments.push(
        ...punishments.map((punishment) => ({
          id: punishment.id,
          given: punishment.given.toISOString(),
          during_lesson: punishment.during_lesson,
          exclusion: punishment.exclusion,
          homework: punishment.homework ?? null,
          circumstances: punishment.circumstances,
          nature: punishment.nature,
          reasons: punishment.reasons,
          giver: punishment.giver,
          duration: punishment.duration ?? null,
        }))
      );
    } catch (error) {
      recordError(exportData, `punishments[${period.name}]`, error);
    }

    exportData.periods.push(periodData);
  }

  try {
    const start = new Date(today);
    start.setDate(start.getDate() - 60);
    const end = new Date(today);
    end.setDate(end.getDate() + 30);

    const lessons = await client.lessons(start, end);
    exportData.timetable = lessons.map((lesson) => ({
      subject: lesson.subject?.name ?? null,
      teacher: lesson.teacherName,
      classroom: lesson.classroom,
      start: lesson.start.toISOString(),
      end: lesson.end.toISOString(),
      canceled: lesson.canceled,
    }));
  } catch (error) {
    recordError(exportData, "timetable", error);
  }

  try {
    const periodStarts = periods.map((period) => period.start.getTime()).filter(Number.isFinite);
    const periodEnds = periods.map((period) => period.end.getTime()).filter(Number.isFinite);
    const start = new Date(periodStarts.length ? Math.min(...periodStarts) : today.getTime() - 365 * 86400000);
    const end = new Date(periodEnds.length ? Math.max(...periodEnds) : today.getTime() + 365 * 86400000);

    const homework = await client.homework(start, end);
    exportData.homework = homework.map((item) => ({
      id: item.id,
      subject: item.subject?.name ?? null,
      description: item.description,
      done: item.done,
      date: item.date.toISOString(),
    }));
  } catch (error) {
    recordError(exportData, "homework", error);
  }

  try {
    const start = new Date(today);
    start.setDate(start.getDate() - 60);
    start.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setDate(end.getDate() + 30);
    end.setHours(23, 59, 59, 999);

    const infos = await client.informationAndSurveys({ dateFrom: start, dateTo: end });
    const news: Record<string, unknown>[] = [];
    for (const info of infos) {
      let content: string | null = null;
      try {
        content = await info.content();
      } catch {
        // Keep the entry even when the optional content request fails.
      }
      news.push({
        id: info.id,
        title: info.title ?? null,
        author: info.author,
        category: info.category,
        read: info.read,
        creation_date: info.creationDate.toISOString(),
        start_date: info.startDate?.toISOString() ?? null,
        end_date: info.endDate?.toISOString() ?? null,
        content,
      });
    }
    exportData.news = news;
  } catch (error) {
    recordError(exportData, "news", error);
  }

  try {
    const start = new Date(today);
    start.setDate(start.getDate() - 7);
    const end = new Date(today);
    end.setDate(end.getDate() + 14);

    const menus = await client.menus(start, end);
    exportData.menus = menus.map((menu) => ({
      id: menu.id,
      name: menu.name ?? null,
      date: menu.date.toISOString(),
      is_lunch: menu.isLunch,
      is_dinner: menu.isDinner,
      first_meal: foodNames(menu.firstMeal),
      main_meal: foodNames(menu.mainMeal),
      side_meal: foodNames(menu.sideMeal),
      other_meal: foodNames(menu.otherMeal),
      cheese: foodNames(menu.cheese),
      dessert: foodNames(menu.dessert),
    }));
  } catch (error) {
    recordError(exportData, "menus", error);
  }

  exportData.periods = deduplicateRecords(exportData.periods);
  exportData.timetable = deduplicateRecords(exportData.timetable);
  exportData.homework = deduplicateRecords(exportData.homework);
  exportData.absences = deduplicateRecords(exportData.absences);
  exportData.delays = deduplicateRecords(exportData.delays);
  exportData.punishments = deduplicateRecords(exportData.punishments);
  exportData.news = deduplicateRecords(exportData.news);
  exportData.menus = deduplicateRecords(exportData.menus);

  for (const period of exportData.periods) {
    if (!period || typeof period !== "object") continue;
    const record = period as Record<string, unknown>;
    if (Array.isArray(record.grades)) record.grades = deduplicateRecords(record.grades as Record<string, unknown>[]);
    if (Array.isArray(record.averages)) {
      record.averages = deduplicateRecords(record.averages as Record<string, unknown>[]);
    }
  }

  Period.instances.clear();
  return exportData;
}

export async function exportWithCredentials(payload: CredentialsPayload): Promise<ExportData> {
  const provider = getEntProvider(payload.ent_name);
  let client: Client;
  try {
    client = await Client.login(cleanPronoteUrl(payload.url), payload.username, payload.password, {
      ent: provider,
    });
  } catch (error) {
    throw new Error(normalizeLoginError(error));
  }
  if (!client.logged_in) throw new Error("Identifiants incorrects.");
  return extractPronoteData(client);
}

export async function exportWithToken(payload: TokenPayload): Promise<ExportData> {
  let client: Client;
  try {
    client = await Client.tokenLogin(
      cleanPronoteUrl(payload.url),
      payload.username,
      payload.token,
      crypto.randomUUID()
    );
  } catch (error) {
    throw new Error(`Échec jeton : ${normalizeLoginError(error)}`);
  }
  if (!client.logged_in) throw new Error("Jeton expiré ou identifiants incorrects.");
  return extractPronoteData(client);
}

export async function exportWithQrCode(payload: QRCodePayload): Promise<ExportData> {
  let qrData: Record<string, unknown>;
  if (typeof payload.qr_data === "string") {
    try {
      qrData = JSON.parse(payload.qr_data) as Record<string, unknown>;
    } catch {
      throw new Error("Contenu du QR Code invalide.");
    }
  } else {
    qrData = payload.qr_data;
  }

  const missing = ["login", "jeton", "url"].filter((key) => !qrData[key]);
  if (missing.length) {
    throw new Error(`QR Code PRONOTE incomplet : champ(s) manquant(s) : ${missing.join(", ")}.`);
  }
  if (!/^\d{4}$/.test(payload.pin)) {
    throw new Error("Le code PIN doit contenir exactement 4 chiffres.");
  }

  try {
    const client = await Client.qrcodeLogin(
      qrData as { login: string; jeton: string; url: string },
      payload.pin,
      crypto.randomUUID()
    );
    if (!client.logged_in) throw new Error("Code PIN invalide ou QR code expiré.");
    return extractPronoteData(client);
  } catch (error) {
    const message = normalizeLoginError(error);
    const friendly = /invalid confirmation code|invalid pin/i.test(message)
      ? "Code PIN incorrect pour ce QR Code."
      : message || "Le QR Code n'a pas pu être traité par PRONOTE.";
    throw new Error(`Erreur QR Code : ${friendly}`);
  }
}

function normalizeLoginError(error: unknown): string {
  const message = error instanceof Error ? error.message.trim() : String(error).trim();
  if (/Page html is different/i.test(message)) {
    return "Cet établissement impose une connexion SSO/ENT. Utilisez un fournisseur ENT pris en charge ou l'onglet QR Code.";
  }
  return message || "Erreur inconnue lors de la connexion à PRONOTE.";
}
