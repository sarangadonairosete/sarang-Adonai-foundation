import { handleManagementRequest } from "./management.js";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

function corsHeaders(request, env) {
  const headers = new Headers({
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Password",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
  });

  if (request.headers.get("Origin") === env.ALLOWED_ORIGIN) {
    headers.set("Access-Control-Allow-Origin", env.ALLOWED_ORIGIN);
  }

  return headers;
}

function json(request, env, data, status = 200, extraHeaders = {}) {
  const headers = corsHeaders(request, env);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  for (const [key, value] of Object.entries(extraHeaders)) headers.set(key, value);
  return new Response(JSON.stringify(data), { status, headers });
}

async function passwordMatches(provided, expected) {
  const normalizedProvided = String(provided || "").trim();
  const normalizedExpected = String(expected || "").trim();
  if (!normalizedProvided || !normalizedExpected) return false;
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(normalizedProvided)),
    crypto.subtle.digest("SHA-256", encoder.encode(normalizedExpected)),
  ]);
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) difference |= a[i] ^ b[i];
  return difference === 0;
}

function safeFilename(filename) {
  const leaf = String(filename || "image").split(/[\\/]/).pop() || "image";
  const normalized = leaf.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const safe = normalized.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return (safe || "image").slice(0, 120);
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function imageObject(request, env, item) {
  return {
    id: item.id,
    public_url: item.public_url,
    filename: item.filename,
    date: item.date,
    year: item.year,
    month: item.month,
    day: item.day,
    caption: item.caption || "",
    created_at: item.created_at,
  };
}

async function getGallery(request, env) {
  const result = await env.DB.prepare(
    "SELECT id, public_url, filename, date, year, month, day, caption, created_at FROM media ORDER BY date DESC, created_at DESC",
  ).all();
  const groups = new Map();

  for (const row of result.results || []) {
    if (!groups.has(row.date)) {
      groups.set(row.date, {
        date: row.date,
        year: row.year,
        month: row.month,
        day: row.day,
        items: [],
      });
    }
    groups.get(row.date).items.push(imageObject(request, env, row));
  }

  return json(request, env, { groups: [...groups.values()] });
}

async function uploadMedia(request, env) {
  const password = request.headers.get("X-Admin-Password") || "";
  if (!(await passwordMatches(password, env.ADMIN_PASSWORD))) {
    return json(request, env, { error: "Invalid admin password." }, 401);
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return json(request, env, { error: "Upload must use multipart form data." }, 400);
  }

  const file = form.get("file");
  const caption = String(form.get("caption") || "").trim().slice(0, 500);
  const date = String(form.get("date") || "");

  if (!(file instanceof File)) return json(request, env, { error: "Choose an image to upload." }, 400);
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return json(request, env, { error: "Use a JPEG, PNG, WebP, GIF, or AVIF image." }, 415);
  }
  if (file.size < 1 || file.size > MAX_UPLOAD_BYTES) {
    return json(request, env, { error: "Images must be smaller than 25 MB." }, 413);
  }
  if (!validDate(date)) return json(request, env, { error: "Choose a valid date." }, 400);

  const [year, month, day] = date.split("-");
  const id = crypto.randomUUID();
  const filename = safeFilename(file.name);
  const key = `gallery/${id}-${crypto.randomUUID()}-${filename}`;
  const publicUrl = `${env.R2_PUBLIC_BASE_URL.replace(/\/+$/, "")}/${key}`;

  try {
    await env.MEDIA.put(key, file.stream(), {
      httpMetadata: {
        contentType: file.type,
        cacheControl: "public, max-age=31536000, immutable",
      },
      customMetadata: { date, caption },
    });

    await env.DB.prepare(
      "INSERT INTO media (id, public_url, filename, date, year, month, day, caption) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(id, publicUrl, file.name.slice(0, 255), date, year, month, day, caption)
      .run();
  } catch {
    await env.MEDIA.delete(key).catch(() => {});
    return json(request, env, { error: "The image could not be saved. Please retry." }, 500);
  }

  return json(request, env, {
    item: {
      id,
      public_url: publicUrl,
      filename: file.name.slice(0, 255),
      date,
      year,
      month,
      day,
      caption,
    },
  }, 201);
}

async function deleteMedia(request, env, id) {
  const password = request.headers.get("X-Admin-Password") || "";
  if (!(await passwordMatches(password, env.ADMIN_PASSWORD))) {
    return json(request, env, { error: "Invalid admin password." }, 401);
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json(request, env, { error: "Invalid media ID." }, 400);

  const row = await env.DB.prepare(
    "SELECT id, public_url FROM media WHERE id = ?",
  ).bind(id).first();
  if (!row) return json(request, env, { error: "Media item not found." }, 404);

  let objectUrl;
  let publicBase;
  try {
    objectUrl = new URL(row.public_url);
    publicBase = new URL(env.R2_PUBLIC_BASE_URL);
  } catch {
    return json(request, env, { error: "Stored media URL is invalid." }, 500);
  }
  if (objectUrl.origin !== publicBase.origin) {
    return json(request, env, { error: "Stored media URL does not match the configured bucket." }, 500);
  }

  const key = decodeURIComponent(objectUrl.pathname.replace(/^\/+/, ""));
  const legacyGalleryKey = /^\d{4}\/\d{2}\/\d{2}\/[0-9a-f-]{36}-[A-Za-z0-9._-]+$/i.test(key);
  const currentGalleryKey = /^gallery\/[0-9a-f-]{36}-[0-9a-f-]{36}-[A-Za-z0-9._-]+$/i.test(key);
  if (!legacyGalleryKey && !currentGalleryKey) {
    return json(request, env, { error: "Stored object path is invalid." }, 500);
  }

  try {
    await env.MEDIA.delete(key);
    await env.DB.prepare("DELETE FROM media WHERE id = ?").bind(id).run();
  } catch {
    return json(request, env, { error: "The media item could not be deleted." }, 500);
  }

  return json(request, env, { deleted: id });
}

async function updateMedia(request, env, id) {
  const password = request.headers.get("X-Admin-Password") || "";
  if (!(await passwordMatches(password, env.ADMIN_PASSWORD))) {
    return json(request, env, { error: "Invalid admin password." }, 401);
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json(request, env, { error: "Invalid media ID." }, 400);
  const existing = await env.DB.prepare(
    "SELECT id, public_url, filename, date, year, month, day, caption, created_at FROM media WHERE id = ?",
  ).bind(id).first();
  if (!existing) return json(request, env, { error: "Media item not found." }, 404);

  let form;
  try {
    form = await request.formData();
  } catch {
    return json(request, env, { error: "Submit the update as multipart form data." }, 400);
  }
  const date = String(form.get("date") || existing.date);
  const caption = String(form.get("caption") ?? existing.caption ?? "").trim().slice(0, 500);
  if (!validDate(date)) return json(request, env, { error: "Choose a valid date." }, 400);

  const file = form.get("file");
  const hasFile = file instanceof File && file.size > 0;
  if (hasFile && !ALLOWED_IMAGE_TYPES.has(file.type)) {
    return json(request, env, { error: "Use a JPEG, PNG, WebP, GIF, or AVIF image." }, 415);
  }
  if (hasFile && file.size > MAX_UPLOAD_BYTES) {
    return json(request, env, { error: "Images must be smaller than 25 MB." }, 413);
  }

  const [year, month, day] = date.split("-");
  let newKey = null;
  let publicUrl = existing.public_url;
  let filename = existing.filename;
  try {
    if (hasFile) {
      filename = file.name.slice(0, 255);
      newKey = `gallery/${id}-${crypto.randomUUID()}-${safeFilename(file.name)}`;
      publicUrl = `${env.R2_PUBLIC_BASE_URL.replace(/\/+$/, "")}/${newKey}`;
      await env.MEDIA.put(newKey, file.stream(), {
        httpMetadata: {
          contentType: file.type,
          cacheControl: "public, max-age=31536000, immutable",
        },
        customMetadata: { date, caption },
      });
    }
    await env.DB.prepare(
      "UPDATE media SET public_url = ?, filename = ?, date = ?, year = ?, month = ?, day = ?, caption = ? WHERE id = ?",
    ).bind(publicUrl, filename, date, year, month, day, caption, id).run();
  } catch {
    if (newKey) await env.MEDIA.delete(newKey).catch(() => {});
    return json(request, env, { error: "The media item could not be updated." }, 500);
  }

  if (newKey) {
    try {
      const oldUrl = new URL(existing.public_url);
      const baseUrl = new URL(env.R2_PUBLIC_BASE_URL);
      const oldKey = decodeURIComponent(oldUrl.pathname.replace(/^\/+/, ""));
      if (oldUrl.origin === baseUrl.origin) {
        await env.MEDIA.delete(oldKey).catch(() => {});
      }
    } catch {}
  }
  return json(request, env, {
    item: imageObject(request, env, {
      id, public_url: publicUrl, filename, date, year, month, day, caption,
      created_at: existing.created_at,
    }),
  });
}

function staffObjectKey(publicUrl, env) {
  let objectUrl;
  let publicBase;
  try {
    objectUrl = new URL(publicUrl);
    publicBase = new URL(env.R2_PUBLIC_BASE_URL);
  } catch {
    return null;
  }
  if (objectUrl.origin !== publicBase.origin) return null;

  let key;
  try {
    key = decodeURIComponent(objectUrl.pathname.replace(/^\/+/, ""));
  } catch {
    return null;
  }
  return /^staff\/[0-9a-f-]{36}-[0-9a-f-]{36}-[A-Za-z0-9._-]+$/i.test(key)
    ? key
    : null;
}

function staffRecord(row) {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    photo_url: row.photo_url,
    bio: row.bio || "",
    created_at: row.created_at,
  };
}

async function getStaff(request, env) {
  const result = await env.DB.prepare(
    "SELECT id, name, role, photo_url, bio, created_at FROM staff ORDER BY created_at ASC, name COLLATE NOCASE ASC",
  ).all();
  return json(request, env, { staff: (result.results || []).map(staffRecord) });
}

function validStaffPhoto(file) {
  if (!(file instanceof File)) return "Choose a staff photo.";
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return "Use a JPEG, PNG, WebP, GIF, or AVIF image.";
  }
  if (file.size < 1 || file.size > MAX_UPLOAD_BYTES) {
    return "Images must be smaller than 25 MB.";
  }
  return null;
}

async function readStaffForm(request, env) {
  const password = request.headers.get("X-Admin-Password") || "";
  if (!(await passwordMatches(password, env.ADMIN_PASSWORD))) {
    return { response: json(request, env, { error: "Invalid admin password." }, 401) };
  }

  try {
    return { form: await request.formData() };
  } catch {
    return { response: json(request, env, { error: "Submit the staff details as multipart form data." }, 400) };
  }
}

function staffFields(form) {
  const name = String(form.get("name") || "").trim().slice(0, 120);
  const role = String(form.get("role") || "").trim().slice(0, 120);
  const bio = String(form.get("bio") || "").trim().slice(0, 2000);
  return { name, role, bio };
}

async function createStaff(request, env) {
  const parsed = await readStaffForm(request, env);
  if (parsed.response) return parsed.response;

  const { form } = parsed;
  const { name, role, bio } = staffFields(form);
  const photo = form.get("photo");
  const photoError = validStaffPhoto(photo);
  if (photoError) return json(request, env, { error: photoError }, 400);
  if (!name || !role) {
    return json(request, env, { error: "Enter both a staff name and role." }, 400);
  }

  const id = crypto.randomUUID();
  const filename = safeFilename(photo.name);
  const key = `staff/${id}-${crypto.randomUUID()}-${filename}`;
  const photoUrl = `${env.R2_PUBLIC_BASE_URL.replace(/\/+$/, "")}/${key}`;

  try {
    await env.MEDIA.put(key, photo.stream(), {
      httpMetadata: {
        contentType: photo.type,
        cacheControl: "public, max-age=31536000, immutable",
      },
    });
    await env.DB.prepare(
      "INSERT INTO staff (id, name, role, photo_url, bio, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)",
    ).bind(id, name, role, photoUrl, bio).run();
  } catch {
    await env.MEDIA.delete(key).catch(() => {});
    return json(request, env, { error: "The staff profile could not be saved. Please retry." }, 500);
  }

  return json(request, env, {
    staff: { id, name, role, photo_url: photoUrl, bio },
  }, 201);
}

async function updateStaff(request, env, id) {
  const password = request.headers.get("X-Admin-Password") || "";
  if (!(await passwordMatches(password, env.ADMIN_PASSWORD))) {
    return json(request, env, { error: "Invalid admin password." }, 401);
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return json(request, env, { error: "Invalid staff ID." }, 400);
  }

  const existing = await env.DB.prepare(
    "SELECT id, name, role, photo_url, bio, created_at FROM staff WHERE id = ?",
  ).bind(id).first();
  if (!existing) return json(request, env, { error: "Staff profile not found." }, 404);

  let form;
  try {
    form = await request.formData();
  } catch {
    return json(request, env, { error: "Submit the staff details as multipart form data." }, 400);
  }

  const { name, role, bio } = staffFields(form);
  if (!name || !role) {
    return json(request, env, { error: "Enter both a staff name and role." }, 400);
  }

  const photo = form.get("photo");
  const hasPhoto = photo instanceof File && photo.size > 0;
  if (hasPhoto) {
    const photoError = validStaffPhoto(photo);
    if (photoError) return json(request, env, { error: photoError }, 400);
  }

  let photoUrl = existing.photo_url;
  let newKey = null;
  if (hasPhoto) {
    const filename = safeFilename(photo.name);
    newKey = `staff/${id}-${crypto.randomUUID()}-${filename}`;
    photoUrl = `${env.R2_PUBLIC_BASE_URL.replace(/\/+$/, "")}/${newKey}`;
    try {
      await env.MEDIA.put(newKey, photo.stream(), {
        httpMetadata: {
          contentType: photo.type,
          cacheControl: "public, max-age=31536000, immutable",
        },
      });
    } catch {
      return json(request, env, { error: "The replacement photo could not be uploaded." }, 500);
    }
  }

  try {
    await env.DB.prepare(
      "UPDATE staff SET name = ?, role = ?, photo_url = ?, bio = ? WHERE id = ?",
    ).bind(name, role, photoUrl, bio, id).run();
  } catch {
    if (newKey) await env.MEDIA.delete(newKey).catch(() => {});
    return json(request, env, { error: "The staff profile could not be updated. Please retry." }, 500);
  }

  if (newKey) {
    const oldKey = staffObjectKey(existing.photo_url, env);
    if (oldKey) await env.MEDIA.delete(oldKey).catch(() => {});
  }

  return json(request, env, {
    staff: {
      id,
      name,
      role,
      photo_url: photoUrl,
      bio,
      created_at: existing.created_at,
    },
  });
}

async function deleteStaff(request, env, id) {
  const password = request.headers.get("X-Admin-Password") || "";
  if (!(await passwordMatches(password, env.ADMIN_PASSWORD))) {
    return json(request, env, { error: "Invalid admin password." }, 401);
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return json(request, env, { error: "Invalid staff ID." }, 400);
  }

  const existing = await env.DB.prepare(
    "SELECT id, photo_url FROM staff WHERE id = ?",
  ).bind(id).first();
  if (!existing) return json(request, env, { error: "Staff profile not found." }, 404);

  const key = staffObjectKey(existing.photo_url, env);
  if (!key) return json(request, env, { error: "Stored staff photo path is invalid." }, 500);

  try {
    await env.MEDIA.delete(key);
    await env.DB.prepare("DELETE FROM staff WHERE id = ?").bind(id).run();
  } catch {
    return json(request, env, { error: "The staff profile could not be deleted." }, 500);
  }

  return json(request, env, { deleted: id });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    if (origin && origin !== env.ALLOWED_ORIGIN) {
      return json(request, env, { error: "Origin is not allowed." }, 403);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(request, env),
      });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    try {
      if (request.method === "GET" && path === "/health") {
        return json(request, env, { ok: true, service: "sarangadonai-api" });
      }
      if (request.method === "GET" && path === "/gallery") {
        return await getGallery(request, env);
      }
      if (request.method === "GET" && path === "/api/media") {
        const result = await env.DB.prepare(
          "SELECT id, public_url, filename, date, year, month, day, caption, created_at FROM media ORDER BY date DESC, created_at DESC",
        ).all();
        return json(request, env, { media: (result.results || []).map(row => imageObject(request, env, row)) });
      }
      if (request.method === "POST" && path === "/api/media") {
        return await uploadMedia(request, env);
      }
      if (request.method === "GET" && path === "/api/staff") {
        return await getStaff(request, env);
      }
      if (request.method === "POST" && path === "/api/staff") {
        return await createStaff(request, env);
      }
      if (request.method === "POST" && path === "/upload") {
        return await uploadMedia(request, env);
      }

      const staffMatch = path.match(/^\/api\/staff\/([^/]+)$/);
      if (staffMatch) {
        const id = decodeURIComponent(staffMatch[1]);
        if (request.method === "PUT") return await updateStaff(request, env, id);
        if (request.method === "DELETE") return await deleteStaff(request, env, id);
      }

      const mediaMatch = path.match(/^\/(?:api\/)?media\/([^/]+)$/);
      if (mediaMatch) {
        const id = decodeURIComponent(mediaMatch[1]);
        if (request.method === "PUT") return await updateMedia(request, env, id);
        if (request.method === "DELETE") return await deleteMedia(request, env, id);
      }

      const managementResponse = await handleManagementRequest(request, env, path, url);
      if (managementResponse) return managementResponse;

      return json(request, env, { error: "Route not found." }, 404);
    } catch {
      return json(request, env, { error: "The request could not be completed." }, 500);
    }
  },
};
