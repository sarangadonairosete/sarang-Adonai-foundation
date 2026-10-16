(function () {
  const config = window.RECORDS_CONFIG;
  if (!config) return;
  config.apiBase = config.apiBase || "https://sarangadonai-api.sarangadonairosete.workers.dev";

  const form = document.getElementById("record-form");
  const password = document.getElementById("password");
  const formMessage = document.getElementById("form-message");
  const listStatus = document.getElementById("list-status");
  const recordsList = document.getElementById("records-list");
  const saveButton = document.getElementById("save-button");
  const cancelButton = document.getElementById("cancel-button");
  const loadButton = document.getElementById("load-records-button");
  const filterForm = document.getElementById("filter-form");
  let editingId = null;
  let records = [];

  function showMessage(text, type) {
    formMessage.className = `message visible ${type}`;
    formMessage.textContent = text;
  }

  function setEditing(record) {
    editingId = record.id;
    const values = config.toForm ? config.toForm(record) : record;
    for (const fieldName of config.fields) {
      const field = form.elements.namedItem(fieldName);
      if (!field || field.type === "file") continue;
      if (field.type === "checkbox") field.checked = Boolean(values[fieldName]);
      else field.value = values[fieldName] ?? "";
    }
    for (const field of form.querySelectorAll('input[type="file"]')) field.value = "";
    saveButton.textContent = "Save changes";
    cancelButton.hidden = false;
    formMessage.className = "message";
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    const firstEditable = config.fields.map(name => form.elements.namedItem(name))
      .find(field => field && field.type !== "file" && field.type !== "checkbox");
    if (firstEditable) firstEditable.focus({ preventScroll: true });
  }

  function clearEditing() {
    const currentPassword = password.value;
    editingId = null;
    form.reset();
    password.value = currentPassword;
    saveButton.textContent = config.createLabel || "Add record";
    cancelButton.hidden = true;
    formMessage.className = "message";
    if (config.afterReset) config.afterReset();
  }

  function createTableRow(record) {
    const row = document.createElement("tr");
    const photoCell = document.createElement("td");
    if (record[config.imageField]) {
      const image = document.createElement("img");
      image.src = record[config.imageField];
      image.alt = `${record[config.titleField] || "Record"} photo`;
      image.loading = "lazy";
      image.onerror = () => { image.hidden = true; };
      photoCell.appendChild(image);
    }
    const nameCell = document.createElement("td");
    const name = document.createElement("div");
    name.className = "student-name";
    name.textContent = record[config.titleField] || "";
    const approval = document.createElement("span");
    approval.className = `badge ${record.public_approved ? "approved" : "pending"}`;
    approval.textContent = record.public_approved ? "Public" : "Private";
    nameCell.append(name, approval);
    row.append(photoCell, nameCell);

    for (const column of config.tableColumns || []) {
      const cell = document.createElement("td");
      const value = column.value ? column.value(record) : record[column.key];
      cell.textContent = value === undefined || value === null ? "" : String(value);
      row.appendChild(cell);
    }

    const actionsCell = document.createElement("td");
    const actions = document.createElement("div");
    actions.className = "actions";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "secondary";
    edit.textContent = "Edit";
    edit.addEventListener("click", () => setEditing(record));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "danger";
    remove.textContent = "Delete";
    remove.addEventListener("click", () => deleteRecord(record));
    actions.append(edit, remove);
    actionsCell.appendChild(actions);
    row.appendChild(actionsCell);
    return row;
  }

  function createCard(record) {
    if (config.listMode === "table") return createTableRow(record);
    const card = document.createElement("article");
    card.className = "record-card";
    const imageUrl = record[config.imageField] || "";
    if (imageUrl) {
      const image = document.createElement("img");
      image.src = imageUrl;
      image.alt = `${record[config.titleField] || "Record"} photo`;
      image.loading = "lazy";
      image.onerror = () => { image.hidden = true; };
      card.appendChild(image);
    } else {
      const spacer = document.createElement("div");
      spacer.setAttribute("aria-hidden", "true");
      card.appendChild(spacer);
    }

    const details = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = record[config.titleField] || "";
    const meta = document.createElement("div");
    meta.className = "record-meta";
    meta.textContent = config.subtitle ? config.subtitle(record) : "";
    const summary = document.createElement("p");
    summary.className = "record-summary";
    summary.textContent = config.summary ? config.summary(record) : "";
    const badge = document.createElement("span");
    badge.className = `badge ${record.public_approved ? "approved" : "pending"}`;
    badge.textContent = record.public_approved ? "Public approved" : "Private / pending";
    details.append(title, meta, summary, badge);

    const actions = document.createElement("div");
    actions.className = "actions";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "secondary";
    edit.textContent = "Edit";
    edit.addEventListener("click", () => setEditing(record));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "danger";
    remove.textContent = "Delete";
    remove.addEventListener("click", () => deleteRecord(record));
    actions.append(edit, remove);
    card.append(details, actions);
    return card;
  }

  async function loadRecords() {
    const adminPassword = password.value;
    if (!adminPassword) {
      recordsList.replaceChildren();
      listStatus.textContent = "Enter the admin password, then choose Load records.";
      return;
    }
    listStatus.textContent = "Loading…";
    try {
      const params = new URLSearchParams({ admin: "1" });
      if (filterForm) {
        for (const [key, value] of new FormData(filterForm)) {
          if (String(value).trim()) params.set(key, String(value).trim());
        }
      }
      const response = await fetch(`${config.apiBase}/api/${config.resource}?${params}`, {
        headers: { Accept: "application/json", "X-Admin-Password": adminPassword }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load records.");
      records = Array.isArray(data[config.collectionKey]) ? data[config.collectionKey] : [];
      recordsList.replaceChildren(...records.map(createCard));
      listStatus.textContent = records.length ? `${records.length} record${records.length === 1 ? "" : "s"}.` : "No records match these filters.";
    } catch (error) {
      recordsList.replaceChildren();
      listStatus.textContent = error.message || "Could not load records.";
    }
  }

  async function deleteRecord(record) {
    if (!confirm(`Delete ${record[config.titleField] || "this record"} and its stored photo?`)) return;
    if (!password.value) {
      showMessage("Enter the admin password before deleting a record.", "error");
      password.focus();
      return;
    }
    try {
      const response = await fetch(`${config.apiBase}/api/${config.resource}/${encodeURIComponent(record.id)}`, {
        method: "DELETE",
        headers: { Accept: "application/json", "X-Admin-Password": password.value }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not delete this record.");
      if (editingId === record.id) clearEditing();
      showMessage("Record deleted.", "success");
      await loadRecords();
    } catch (error) {
      showMessage(error.message || "Could not delete this record.", "error");
    }
  }

  form.addEventListener("submit", async event => {
    event.preventDefault();
    formMessage.className = "message";
    const payload = new FormData(form);
    payload.delete("password");
    if (config.serialize) config.serialize(form, payload);
    saveButton.disabled = true;
    try {
      const wasEditing = Boolean(editingId);
      const endpoint = wasEditing
        ? `${config.apiBase}/api/${config.resource}/${encodeURIComponent(editingId)}`
        : `${config.apiBase}/api/${config.resource}`;
      const response = await fetch(endpoint, {
        method: wasEditing ? "PUT" : "POST",
        headers: { Accept: "application/json", "X-Admin-Password": password.value },
        body: payload
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save this record.");
      clearEditing();
      showMessage(wasEditing ? "Changes saved." : "Record added.", "success");
      await loadRecords();
    } catch (error) {
      showMessage(error.message || "Could not save this record.", "error");
    } finally {
      saveButton.disabled = false;
    }
  });

  cancelButton.addEventListener("click", clearEditing);
  loadButton.addEventListener("click", loadRecords);
  if (filterForm) {
    filterForm.addEventListener("change", loadRecords);
    filterForm.addEventListener("submit", event => {
      event.preventDefault();
      loadRecords();
    });
  }
  if (config.onInit) config.onInit(form);
  listStatus.textContent = "Enter the admin password, then choose Load records.";
})();
