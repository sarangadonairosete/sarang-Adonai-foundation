import { youtubeFields } from "./youtube.js";

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);
const EVENT_TYPES = new Set([
  "birthday", "graduation", "feeding_program", "outreach", "church_service",
  "sports", "education", "health_camp", "other",
]);
const CLASSES = new Set([
  "P1", "P2", "P3", "P4", "P5", "P6", "P7",
  "S1", "S2", "S3", "S4", "S5", "S6",
]);
const TERMS = new Set(["Term1", "Term2", "Term3"]);
const PERFORMANCE = new Set(["Excellent", "Good", "Needs Support"]);
const NEED_TYPES = new Set([
  "orphaned_children", "widowed", "elderly", "disabled", "extreme_poverty", "other",
]);
const SUPPORT_STATUSES = new Set(["urgent_need", "partially_supported", "fully_supported"]);
const SUBJECT_KEYS = ["math", "english", "science", "sst"];

function response(request, env, data, status = 200) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
  });
  if (request.headers.get("Origin") === env.ALLOWED_ORIGIN) {
    headers.set("Access-Control-Allow-Origin", env.ALLOWED_ORIGIN);
  }
  return new Response(JSON.stringify(data), { status, headers });
}

async function matchesPassword(value, expected) {
  const provided = String(value || "").trim();
  const secret = String(expected || "").trim();
  if (!provided || !secret) return false;
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(secret)),
  ]);
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];
  return difference === 0;
}

async function requireAdmin(request, env) {
  return matchesPassword(request.headers.get("X-Admin-Password"), env.ADMIN_PASSWORD);
}

function adminMode(url) {
  return url.searchParams.get("admin") === "1";
}

function approved(value) {
  return value === "1" || value === "true" || value === "on";
}

function cleanText(value, limit) {
  return String(value || "").trim().slice(0, limit);
}

function safeFilename(filename) {
  const leaf = String(filename || "image").split(/[\\/]/).pop() || "image";
  const normalized = leaf.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  return (normalized.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "image").slice(0, 120);
}

function imageError(file, required) {
  if (!file) return required ? "Choose an image to upload." : null;
  if (!(file instanceof File)) return "Choose a valid image file.";
  if (!IMAGE_TYPES.has(file.type)) return "Use a JPEG, PNG, WebP, GIF, or AVIF image.";
  if (file.size < 1 || file.size > MAX_IMAGE_BYTES) return "Images must be smaller than 25 MB.";
  return null;
}

async function saveImage(env, prefix, id, file) {
  const key = `${prefix}/${id}-${crypto.randomUUID()}-${safeFilename(file.name)}`;
  await env.MEDIA.put(key, file.stream(), {
    httpMetadata: {
      contentType: file.type,
      cacheControl: "public, max-age=31536000, immutable",
    },
  });
  return {
    key,
    url: `${env.R2_PUBLIC_BASE_URL.replace(/\/+$/, "")}/${key}`,
  };
}

function imageKeyFromUrl(value, env, prefix) {
  if (!value) return null;
  let imageUrl;
  let publicBase;
  try {
    imageUrl = new URL(value);
    publicBase = new URL(env.R2_PUBLIC_BASE_URL);
  } catch {
    return null;
  }
  if (imageUrl.origin !== publicBase.origin) return null;
  let key;
  try {
    key = decodeURIComponent(imageUrl.pathname.replace(/^\/+/, ""));
  } catch {
    return null;
  }
  return new RegExp(`^${prefix}/[0-9a-f-]{36}-[0-9a-f-]{36}-[A-Za-z0-9._-]+$`, "i").test(key)
    ? key
    : null;
}

function uploadedFile(form) {
  const photo = form.get("photo");
  if (photo instanceof File && photo.size > 0) return photo;
  const image = form.get("image");
  if (image instanceof File && image.size > 0) return image;
  return null;
}

async function parseForm(request, env) {
  if (!(await requireAdmin(request, env))) {
    return { error: response(request, env, { error: "Invalid admin password." }, 401) };
  }
  try {
    return { form: await request.formData() };
  } catch {
    return { error: response(request, env, { error: "Submit the details as multipart form data." }, 400) };
  }
}

async function listRows(env, sql, values = []) {
  const result = await env.DB.prepare(sql).bind(...values).all();
  return result.results || [];
}

async function getEvents(request, env, url) {
  const admin = adminMode(url);
  if (admin && !(await requireAdmin(request, env))) {
    return response(request, env, { error: "Invalid admin password." }, 401);
  }
  const type = url.searchParams.get("type");
  if (type && !EVENT_TYPES.has(type)) {
    return response(request, env, { error: "Event type is not valid." }, 400);
  }
  const status = url.searchParams.get("status");
  if (status && !["upcoming", "past"].includes(status)) {
    return response(request, env, { error: "Status must be upcoming or past." }, 400);
  }
  const conditions = [];
  const values = [];
  if (!admin) conditions.push("public_approved = 1");
  if (type) { conditions.push("event_type = ?"); values.push(type); }
  if (status === "upcoming") conditions.push("event_date >= date('now')");
  if (status === "past") conditions.push("event_date < date('now')");
  const order = status === "past" ? "event_date DESC" : "event_date ASC";
  const sql = `SELECT id, title, event_type, event_date, location, description, image_url, public_approved, youtube_url, youtube_id, visibility, media_type, created_at FROM events ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""} ORDER BY ${order}, created_at DESC`;
  const rows = await listRows(env, sql, values);
  const today = new Date().toISOString().slice(0, 10);
  const events = rows.map(row => ({
    ...row,
    status: row.event_date >= today ? "upcoming" : "past",
    public_approved: Boolean(row.public_approved),
  }));
  return response(request, env, { events });
}

function eventFields(form, existing = {}) {
  const title = cleanText(form.get("title"), 180);
  const eventType = cleanText(form.get("event_type"), 40);
  const eventDate = cleanText(form.get("event_date"), 10);
  const location = cleanText(form.get("location"), 240);
  const description = cleanText(form.get("description"), 3000);
  const videos = youtubeFields(form, existing);
  if (videos.error) return { error: videos.error };
  const date = new Date(`${eventDate}T00:00:00.000Z`);
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(eventDate)
    && !Number.isNaN(date.valueOf())
    && date.toISOString().slice(0, 10) === eventDate;
  if (!title || !eventDate || !validDate || (eventType && !EVENT_TYPES.has(eventType))) {
    return { error: "Enter a title, valid event date, and valid event type." };
  }
  return {
    fields: {
      title,
      event_type: eventType || "other",
      event_date: eventDate,
      location,
      description,
      status: eventDate >= new Date().toISOString().slice(0, 10) ? "upcoming" : "past",
      public_approved: approved(form.get("public_approved")) ? 1 : 0,
      ...videos,
    },
  };
}

async function createEvent(request, env) {
  const parsed = await parseForm(request, env);
  if (parsed.error) return parsed.error;
  const { form } = parsed;
  const extracted = eventFields(form);
  if (extracted.error) return response(request, env, { error: extracted.error }, 400);
  const fields = extracted.fields;
  const file = uploadedFile(form);
  const invalidImage = imageError(file, false);
  if (invalidImage) return response(request, env, { error: invalidImage }, 400);

  const id = crypto.randomUUID();
  let saved = null;
  try {
    if (file) saved = await saveImage(env, "events", id, file);
    await env.DB.prepare(
      "INSERT INTO events (id, title, event_type, event_date, location, description, image_url, status, created_at, public_approved, youtube_url, youtube_id, visibility, media_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?)",
    ).bind(id, fields.title, fields.event_type, fields.event_date, fields.location, fields.description, saved?.url || "", fields.status, fields.public_approved, fields.youtube_url, fields.youtube_id, fields.visibility, fields.media_type).run();
  } catch {
    if (saved) await env.MEDIA.delete(saved.key).catch(() => {});
    return response(request, env, { error: "The event could not be saved." }, 500);
  }
  return response(request, env, { event: { id, ...fields, image_url: saved?.url || "" } }, 201);
}

async function updateEvent(request, env, id) {
  const parsed = await parseForm(request, env);
  if (parsed.error) return parsed.error;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return response(request, env, { error: "Invalid event ID." }, 400);
  const existing = await env.DB.prepare("SELECT * FROM events WHERE id = ?").bind(id).first();
  if (!existing) return response(request, env, { error: "Event not found." }, 404);
  const extracted = eventFields(parsed.form, existing);
  if (extracted.error) return response(request, env, { error: extracted.error }, 400);
  const fields = extracted.fields;
  const file = uploadedFile(parsed.form);
  const invalidImage = imageError(file, false);
  if (invalidImage) return response(request, env, { error: invalidImage }, 400);
  let saved = null;
  try {
    if (file) saved = await saveImage(env, "events", id, file);
    const imageUrl = saved?.url || existing.image_url || "";
    await env.DB.prepare(
      "UPDATE events SET title = ?, event_type = ?, event_date = ?, location = ?, description = ?, image_url = ?, status = ?, public_approved = ?, youtube_url = ?, youtube_id = ?, visibility = ?, media_type = ? WHERE id = ?",
    ).bind(fields.title, fields.event_type, fields.event_date, fields.location, fields.description, imageUrl, fields.status, fields.public_approved, fields.youtube_url, fields.youtube_id, fields.visibility, fields.media_type, id).run();
    if (saved) {
      const oldKey = imageKeyFromUrl(existing.image_url, env, "events");
      if (oldKey) await env.MEDIA.delete(oldKey).catch(() => {});
    }
    return response(request, env, { event: { id, ...fields, image_url: imageUrl } });
  } catch {
    if (saved) await env.MEDIA.delete(saved.key).catch(() => {});
    return response(request, env, { error: "The event could not be updated." }, 500);
  }
}

async function deleteEvent(request, env, id) {
  if (!(await requireAdmin(request, env))) return response(request, env, { error: "Invalid admin password." }, 401);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return response(request, env, { error: "Invalid event ID." }, 400);
  const existing = await env.DB.prepare("SELECT id, image_url FROM events WHERE id = ?").bind(id).first();
  if (!existing) return response(request, env, { error: "Event not found." }, 404);
  const key = imageKeyFromUrl(existing.image_url, env, "events");
  try {
    if (key) await env.MEDIA.delete(key);
    await env.DB.prepare("DELETE FROM events WHERE id = ?").bind(id).run();
  } catch {
    return response(request, env, { error: "The event could not be deleted." }, 500);
  }
  return response(request, env, { deleted: id });
}

function parseSubjects(value) {
  let input = value;
  if (typeof value === "string") {
    try { input = JSON.parse(value); } catch { return { error: "Enter valid subject scores." }; }
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { error: "Enter valid subject scores." };
  }
  const subjects = {};
  for (const key of SUBJECT_KEYS) {
    const score = Number(input[key]);
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      return { error: `Enter a score from 0 to 100 for ${key}.` };
    }
    subjects[key] = Math.round(score * 10) / 10;
  }
  const average = Math.round((SUBJECT_KEYS.reduce((sum, key) => sum + subjects[key], 0) / SUBJECT_KEYS.length) * 10) / 10;
  return { subjects, average };
}

function studentRecord(row) {
  let subjects = {};
  try { subjects = JSON.parse(row.subjects || "{}"); } catch {}
  return {
    ...row,
    subjects,
    public_approved: Boolean(row.public_approved),
  };
}

async function getStudents(request, env, url) {
  const admin = adminMode(url);
  if (admin && !(await requireAdmin(request, env))) {
    return response(request, env, { error: "Invalid admin password." }, 401);
  }
  const className = url.searchParams.get("class");
  const year = url.searchParams.get("year");
  if (className && !CLASSES.has(className)) return response(request, env, { error: "Class is not valid." }, 400);
  if (year && !/^\d{4}$/.test(year)) return response(request, env, { error: "Year must contain four digits." }, 400);
  const conditions = [];
  const values = [];
  if (!admin) conditions.push("public_approved = 1");
  if (className) { conditions.push('"class" = ?'); values.push(className); }
  if (year) { conditions.push("year = ?"); values.push(year); }
  const top = url.searchParams.get("top");
  let limit = "";
  if (top !== null) {
    const count = Number(top);
    if (!Number.isInteger(count) || count < 1 || count > 50) return response(request, env, { error: "Top must be between 1 and 50." }, 400);
    limit = " LIMIT ?";
    values.push(count);
  }
  const rows = await listRows(env,
    `SELECT id, name, "class", age, photo_url, performance, term, year, subjects, average_score, story, public_approved, youtube_url, youtube_id, visibility, media_type, created_at FROM students ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""} ORDER BY average_score DESC, name COLLATE NOCASE ASC${limit}`,
    values);
  return response(request, env, { students: rows.map(studentRecord) });
}

function studentFields(form, existing = {}) {
  const name = cleanText(form.get("name"), 120);
  const className = cleanText(form.get("class"), 3).toUpperCase();
  const ageValue = cleanText(form.get("age"), 3);
  const age = ageValue ? Number(ageValue) : null;
  const term = cleanText(form.get("term"), 10);
  const year = cleanText(form.get("year"), 4);
  const performance = cleanText(form.get("performance"), 30);
  const story = cleanText(form.get("story"), 3000);
  const videos = youtubeFields(form, existing);
  if (videos.error) return { error: videos.error };
  const subjectResult = parseSubjects(form.get("subjects"));
  if (!name || !CLASSES.has(className) || (age !== null && (!Number.isInteger(age) || age < 3 || age > 25)) || !TERMS.has(term) || !/^\d{4}$/.test(year) || !PERFORMANCE.has(performance)) {
    return { error: "Enter a name, valid class, age, term, year, and performance remark." };
  }
  if (subjectResult.error) return { error: subjectResult.error };
  return {
    fields: {
      name, className, age, term, year, performance, story,
      subjects: JSON.stringify(subjectResult.subjects),
      average_score: subjectResult.average,
      public_approved: approved(form.get("public_approved")) ? 1 : 0,
      ...videos,
    },
  };
}

async function createStudent(request, env) {
  const parsed = await parseForm(request, env);
  if (parsed.error) return parsed.error;
  const extracted = studentFields(parsed.form);
  if (extracted.error) return response(request, env, { error: extracted.error }, 400);
  const fields = extracted.fields;
  const file = uploadedFile(parsed.form);
  const invalidImage = imageError(file, true);
  if (invalidImage) return response(request, env, { error: invalidImage }, 400);
  const id = crypto.randomUUID();
  let saved = null;
  try {
    saved = await saveImage(env, "students", id, file);
    await env.DB.prepare(
      'INSERT INTO students (id, name, "class", age, photo_url, performance, term, year, subjects, average_score, story, created_at, public_approved, youtube_url, youtube_id, visibility, media_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?)',
    ).bind(id, fields.name, fields.className, fields.age, saved.url, fields.performance, fields.term, fields.year, fields.subjects, fields.average_score, fields.story, fields.public_approved, fields.youtube_url, fields.youtube_id, fields.visibility, fields.media_type).run();
  } catch {
    if (saved) await env.MEDIA.delete(saved.key).catch(() => {});
    return response(request, env, { error: "The student record could not be saved." }, 500);
  }
  return response(request, env, { student: studentRecord({
    id, name: fields.name, class: fields.className, age: fields.age, photo_url: saved.url,
    performance: fields.performance, term: fields.term, year: fields.year,
    subjects: fields.subjects, average_score: fields.average_score, story: fields.story,
    public_approved: fields.public_approved,
    youtube_url: fields.youtube_url, youtube_id: fields.youtube_id, visibility: fields.visibility, media_type: fields.media_type,
  }) }, 201);
}

async function updateStudent(request, env, id) {
  const parsed = await parseForm(request, env);
  if (parsed.error) return parsed.error;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return response(request, env, { error: "Invalid student ID." }, 400);
  const existing = await env.DB.prepare("SELECT * FROM students WHERE id = ?").bind(id).first();
  if (!existing) return response(request, env, { error: "Student record not found." }, 404);
  const extracted = studentFields(parsed.form, existing);
  if (extracted.error) return response(request, env, { error: extracted.error }, 400);
  const fields = extracted.fields;
  const file = uploadedFile(parsed.form);
  const invalidImage = imageError(file, false);
  if (invalidImage) return response(request, env, { error: invalidImage }, 400);
  let saved = null;
  try {
    if (file) saved = await saveImage(env, "students", id, file);
    const photoUrl = saved?.url || existing.photo_url;
    await env.DB.prepare(
      'UPDATE students SET name = ?, "class" = ?, age = ?, photo_url = ?, performance = ?, term = ?, year = ?, subjects = ?, average_score = ?, story = ?, public_approved = ?, youtube_url = ?, youtube_id = ?, visibility = ?, media_type = ? WHERE id = ?',
    ).bind(fields.name, fields.className, fields.age, photoUrl, fields.performance, fields.term, fields.year, fields.subjects, fields.average_score, fields.story, fields.public_approved, fields.youtube_url, fields.youtube_id, fields.visibility, fields.media_type, id).run();
    if (saved) {
      const oldKey = imageKeyFromUrl(existing.photo_url, env, "students");
      if (oldKey) await env.MEDIA.delete(oldKey).catch(() => {});
    }
    return response(request, env, { student: studentRecord({
      ...existing, ...fields, class: fields.className, photo_url: photoUrl,
    }) });
  } catch {
    if (saved) await env.MEDIA.delete(saved.key).catch(() => {});
    return response(request, env, { error: "The student record could not be updated." }, 500);
  }
}

async function deleteStudent(request, env, id) {
  if (!(await requireAdmin(request, env))) return response(request, env, { error: "Invalid admin password." }, 401);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return response(request, env, { error: "Invalid student ID." }, 400);
  const existing = await env.DB.prepare("SELECT id, photo_url FROM students WHERE id = ?").bind(id).first();
  if (!existing) return response(request, env, { error: "Student record not found." }, 404);
  const key = imageKeyFromUrl(existing.photo_url, env, "students");
  try {
    if (key) await env.MEDIA.delete(key);
    await env.DB.prepare("DELETE FROM students WHERE id = ?").bind(id).run();
  } catch {
    return response(request, env, { error: "The student record could not be deleted." }, 500);
  }
  return response(request, env, { deleted: id });
}

function familyRecord(row, admin) {
  const record = {
    id: row.id,
    family_name: row.family_name,
    village: row.village,
    district: row.district,
    members_count: row.members_count,
    need_type: row.need_type,
    story: row.story || "",
    photo_url: row.photo_url || "",
    youtube_url: row.youtube_url || "",
    youtube_id: row.youtube_id || "",
    visibility: row.visibility || "unlisted",
    media_type: row.youtube_id ? "youtube" : (row.media_type || "photo"),
    support_status: row.support_status,
    created_at: row.created_at,
    public_approved: Boolean(row.public_approved),
  };
  if (admin) record.contact_info = row.contact_info || "";
  return record;
}

async function getFamilies(request, env, url) {
  const admin = adminMode(url);
  if (admin && !(await requireAdmin(request, env))) {
    return response(request, env, { error: "Invalid admin password." }, 401);
  }
  const village = cleanText(url.searchParams.get("village"), 120);
  const status = url.searchParams.get("status");
  if (status && !SUPPORT_STATUSES.has(status)) return response(request, env, { error: "Support status is not valid." }, 400);
  const conditions = [];
  const values = [];
  if (!admin) conditions.push("public_approved = 1");
  if (village) { conditions.push("village = ?"); values.push(village); }
  if (status) { conditions.push("support_status = ?"); values.push(status); }
  const rows = await listRows(env,
    `SELECT id, family_name, village, district, members_count, need_type, story, photo_url, support_status, contact_info, public_approved, youtube_url, youtube_id, visibility, media_type, created_at FROM families ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""} ORDER BY CASE support_status WHEN 'urgent_need' THEN 0 WHEN 'partially_supported' THEN 1 ELSE 2 END, created_at DESC`,
    values);
  return response(request, env, { families: rows.map(row => familyRecord(row, admin)) });
}

function familyFields(form, existing = {}) {
  const familyName = cleanText(form.get("family_name"), 160);
  const village = cleanText(form.get("village"), 120);
  const district = cleanText(form.get("district"), 120);
  const membersCount = Number(form.get("members_count"));
  const needType = cleanText(form.get("need_type"), 40);
  const story = cleanText(form.get("story"), 3000);
  const supportStatus = cleanText(form.get("support_status"), 40);
  const contactInfo = cleanText(form.get("contact_info"), 500);
  const videos = youtubeFields(form, existing);
  if (videos.error) return { error: videos.error };
  if (!familyName || !village || !district || !Number.isInteger(membersCount) || membersCount < 1 || membersCount > 100 || !NEED_TYPES.has(needType) || !SUPPORT_STATUSES.has(supportStatus)) {
    return { error: "Enter a family name, village, district, valid member count, need type, and support status." };
  }
  return {
    fields: {
      family_name: familyName, village, district, members_count: membersCount,
      need_type: needType, story, support_status: supportStatus,
      contact_info: contactInfo,
      public_approved: approved(form.get("public_approved")) ? 1 : 0,
      ...videos,
    },
  };
}

async function createFamily(request, env) {
  const parsed = await parseForm(request, env);
  if (parsed.error) return parsed.error;
  const extracted = familyFields(parsed.form);
  if (extracted.error) return response(request, env, { error: extracted.error }, 400);
  const fields = extracted.fields;
  const file = uploadedFile(parsed.form);
  const invalidImage = imageError(file, false);
  if (invalidImage) return response(request, env, { error: invalidImage }, 400);
  const id = crypto.randomUUID();
  let saved = null;
  try {
    if (file) saved = await saveImage(env, "families", id, file);
    await env.DB.prepare(
      "INSERT INTO families (id, family_name, village, district, members_count, need_type, story, photo_url, support_status, contact_info, created_at, public_approved, youtube_url, youtube_id, visibility, media_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?)",
    ).bind(id, fields.family_name, fields.village, fields.district, fields.members_count, fields.need_type, fields.story, saved?.url || "", fields.support_status, fields.contact_info, fields.public_approved, fields.youtube_url, fields.youtube_id, fields.visibility, fields.media_type).run();
  } catch {
    if (saved) await env.MEDIA.delete(saved.key).catch(() => {});
    return response(request, env, { error: "The family record could not be saved." }, 500);
  }
  return response(request, env, { family: familyRecord({
    id, ...fields, photo_url: saved?.url || "", created_at: new Date().toISOString(),
  }, true) }, 201);
}

async function updateFamily(request, env, id) {
  const parsed = await parseForm(request, env);
  if (parsed.error) return parsed.error;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return response(request, env, { error: "Invalid family ID." }, 400);
  const existing = await env.DB.prepare("SELECT * FROM families WHERE id = ?").bind(id).first();
  if (!existing) return response(request, env, { error: "Family record not found." }, 404);
  const extracted = familyFields(parsed.form, existing);
  if (extracted.error) return response(request, env, { error: extracted.error }, 400);
  const fields = extracted.fields;
  const file = uploadedFile(parsed.form);
  const invalidImage = imageError(file, false);
  if (invalidImage) return response(request, env, { error: invalidImage }, 400);
  let saved = null;
  try {
    if (file) saved = await saveImage(env, "families", id, file);
    const photoUrl = saved?.url || existing.photo_url || "";
    await env.DB.prepare(
      "UPDATE families SET family_name = ?, village = ?, district = ?, members_count = ?, need_type = ?, story = ?, photo_url = ?, support_status = ?, contact_info = ?, public_approved = ?, youtube_url = ?, youtube_id = ?, visibility = ?, media_type = ? WHERE id = ?",
    ).bind(fields.family_name, fields.village, fields.district, fields.members_count, fields.need_type, fields.story, photoUrl, fields.support_status, fields.contact_info, fields.public_approved, fields.youtube_url, fields.youtube_id, fields.visibility, fields.media_type, id).run();
    if (saved) {
      const oldKey = imageKeyFromUrl(existing.photo_url, env, "families");
      if (oldKey) await env.MEDIA.delete(oldKey).catch(() => {});
    }
    return response(request, env, { family: familyRecord({
      ...existing, ...fields, photo_url: photoUrl,
    }, true) });
  } catch {
    if (saved) await env.MEDIA.delete(saved.key).catch(() => {});
    return response(request, env, { error: "The family record could not be updated." }, 500);
  }
}

async function deleteFamily(request, env, id) {
  if (!(await requireAdmin(request, env))) return response(request, env, { error: "Invalid admin password." }, 401);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return response(request, env, { error: "Invalid family ID." }, 400);
  const existing = await env.DB.prepare("SELECT id, photo_url FROM families WHERE id = ?").bind(id).first();
  if (!existing) return response(request, env, { error: "Family record not found." }, 404);
  const key = imageKeyFromUrl(existing.photo_url, env, "families");
  try {
    if (key) await env.MEDIA.delete(key);
    await env.DB.prepare("DELETE FROM families WHERE id = ?").bind(id).run();
  } catch {
    return response(request, env, { error: "The family record could not be deleted." }, 500);
  }
  return response(request, env, { deleted: id });
}

export async function handleManagementRequest(request, env, path, url) {
  if (path === "/api/events") {
    if (request.method === "GET") return getEvents(request, env, url);
    if (request.method === "POST") return createEvent(request, env);
  }
  if (path === "/api/students") {
    if (request.method === "GET") return getStudents(request, env, url);
    if (request.method === "POST") return createStudent(request, env);
  }
  if (path === "/api/families") {
    if (request.method === "GET") return getFamilies(request, env, url);
    if (request.method === "POST") return createFamily(request, env);
  }

  const match = path.match(/^\/api\/(events|students|families)\/([^/]+)$/);
  if (!match) return null;
  const [, resource, rawId] = match;
  let id;
  try { id = decodeURIComponent(rawId); } catch {
    return response(request, env, { error: "Invalid record ID." }, 400);
  }
  if (resource === "events") {
    if (request.method === "PUT") return updateEvent(request, env, id);
    if (request.method === "DELETE") return deleteEvent(request, env, id);
  }
  if (resource === "students") {
    if (request.method === "PUT") return updateStudent(request, env, id);
    if (request.method === "DELETE") return deleteStudent(request, env, id);
  }
  if (resource === "families") {
    if (request.method === "PUT") return updateFamily(request, env, id);
    if (request.method === "DELETE") return deleteFamily(request, env, id);
  }
  return null;
}
