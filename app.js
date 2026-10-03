"use strict";

/* ---------- Configuration ---------- */

const APP_ID = "kids-expense";
const BACKUP_VERSION = 1;
const DB_NAME = "kids-expense-db";
const STORE_NAME = "state";

const MAX_RECORDS = 50000;
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_CENTS = 100000000000; // 1,000,000,000 บาทต่อรายการ
const PAGE_SIZE = 50;

const CATEGORIES = [
  {
    id: "tkd",
    name: "เทควันโด",
    amount: "Event TKD",
    detail: "Detail for TKD course"
  },
  {
    id: "gym",
    name: "ยิมนาสติก",
    amount: "Event Gym",
    detail: "Detail for Gym course"
  },
  {
    id: "arts",
    name: "ศิลปะ",
    amount: "Event Arts.",
    detail: "Detail for Arts course"
  },
  {
    id: "swim",
    name: "ว่ายน้ำ",
    amount: "Event Swim",
    detail: "Detail for Swim course"
  },
  {
    id: "math",
    name: "คณิตศาสตร์ MH",
    amount: "Event Math MH",
    detail: "Detail for MH course"
  },
  {
    id: "english-online",
    name: "ภาษาอังกฤษออนไลน์",
    amount: "Event EngOnline.",
    detail: "Detail for EngOnline course"
  },
  {
    id: "dance",
    name: "เต้น",
    amount: "Event Dance.",
    detail: "Detail for Dance course"
  },
  {
    id: "music",
    name: "ดนตรี",
    amount: "Event Music.",
    detail: "Detail for Music course"
  },
  {
    id: "school",
    name: "โรงเรียนจินดาพงศ์",
    amount: "Event Jindapong School.",
    detail: "Detail for Jindapong School"
  },
  {
    id: "english-corner",
    name: "English Corner",
    amount: "Event English Conner.",
    detail: "Detail for  English Conner"
  },
  {
    id: "special",
    name: "กิจกรรมพิเศษ",
    amount: "Event Special.",
    detail: "Detail for Event Special."
  }
];

const CATEGORY_MAP = new Map(CATEGORIES.map(c => [c.id, c]));

const $ = id => document.getElementById(id);
const moneyFormatter = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  minimumFractionDigits: 2
});

let db;
let records = [];
let page = 1;
let editing = null;
let pendingImport = null;
let toastTimer;
let installPrompt = null;

const channel = "BroadcastChannel" in window
  ? new BroadcastChannel("kids-expense-changes")
  : null;

/* ---------- Helpers ---------- */

function money(cents) {
  return moneyFormatter.format(cents / 100);
}

function total(items) {
  return items.reduce((sum, item) => sum + item.amountCents, 0);
}

function today() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function notify(message, error = false) {
  clearTimeout(toastTimer);

  const element = $("toast");
  element.textContent = message;
  element.classList.toggle("error", error);
  element.hidden = false;

  toastTimer = setTimeout(() => {
    element.hidden = true;
  }, error ? 9000 : 4500);
}

function handleError(error) {
  console.error(error);
  notify(error.message || "เกิดข้อผิดพลาด กรุณาลองใหม่", true);
}

function on(id, event, handler) {
  $(id).addEventListener(event, e => {
    Promise.resolve()
      .then(() => handler(e))
      .catch(handleError);
  });
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function normalizeHeader(value) {
  return String(value).replace(/^\uFEFF/, "")
    .trim().replace(/\s+/g, " ");
}

function requireText(value, label, maxLength = 10000) {
  if (typeof value !== "string" || value.length > maxLength) {
    throw new Error(`${label} ไม่ถูกต้องหรือยาวเกิน ${maxLength} ตัวอักษร`);
  }
  return value;
}

function validDate(value) {
  if (typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  if (year < 1900 || year > 2200) return false;

  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

function displayDate(value) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${Number(year) + 543}`;
}

function displayMonth(value) {
  const [year, month] = value.split("-");
  return `${month}/${Number(year) + 543}`;
}

function parseMoney(value) {
  // ยอมรับ 1,234.50, ฿1234.50, THB 1234.50 และตัวเลขธรรมดา
  let text = String(value).trim()
    .replace(/^(?:THB|฿)\s*/i, "")
    .replace(/\s*(?:บาท|THB)$/i, "")
    .trim();

  const plain = /^\d+(?:\.\d{1,2})?$/;
  const grouped = /^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/;

  if (!plain.test(text) && !grouped.test(text)) {
    throw new Error(`จำนวนเงินไม่ถูกต้อง: ${String(value).slice(0, 60)}`);
  }

  text = text.replace(/,/g, "");
  const [whole, fraction = ""] = text.split(".");
  const cents = Number(whole) * 100 +
    Number(fraction.padEnd(2, "0"));

  if (!Number.isSafeInteger(cents) ||
      cents < 0 || cents > MAX_CENTS) {
    throw new Error("จำนวนเงินต้องอยู่ระหว่าง 0 ถึง 1,000,000,000 บาท");
  }

  return cents;
}

function parseLegacyDate(value, order) {
  const raw = String(value ?? "").trim();
  let year, month, day;

  // รองรับ YYYY-MM-DD และ timestamp ที่ขึ้นต้นด้วย ISO date
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s]|$)/);

  if (iso) {
    [, year, month, day] = iso.map(Number);
  } else {
    const local = raw.match(
      /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[T\s]|$)/
    );

    if (!local) {
      throw new Error(
        `อ่านวันที่ไม่ได้: ${raw.slice(0, 60)} — ใช้ปี 4 หลัก`
      );
    }

    const first = Number(local[1]);
    const second = Number(local[2]);
    year = Number(local[3]);

    day = order === "DMY" ? first : second;
    month = order === "DMY" ? second : first;
  }

  // รองรับปี พ.ศ. แบบ 4 หลัก
  if (year >= 2400) year -= 543;

  const result = `${year}-${String(month).padStart(2, "0")}` +
    `-${String(day).padStart(2, "0")}`;

  if (!validDate(result)) {
    throw new Error(`วันที่ไม่ถูกต้อง: ${raw.slice(0, 60)}`);
  }

  return result;
}

function validateRecord(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("รูปแบบรายการไม่ถูกต้อง");
  }

  const id = requireText(input.id, "รหัสรายการ", 200).trim();
  if (!id) throw new Error("รายการไม่มีรหัส");

  if (!validDate(input.date)) {
    throw new Error(`วันที่รายการ ${id} ไม่ถูกต้อง`);
  }

  if (!CATEGORY_MAP.has(input.category)) {
    throw new Error(`ไม่รู้จักหมวดกิจกรรม: ${input.category}`);
  }

  if (!Number.isSafeInteger(input.amountCents) ||
      input.amountCents < 0 || input.amountCents > MAX_CENTS) {
    throw new Error(`ยอดเงินรายการ ${id} ไม่ถูกต้อง`);
  }

  const output = {
    id,
    date: input.date,
    category: input.category,
    amountCents: input.amountCents,
    note: requireText(input.note ?? "", "รายละเอียด"),
    createdAt: requireText(input.createdAt, "วันที่สร้าง", 100),
    updatedAt: requireText(input.updatedAt, "วันที่แก้ไข", 100)
  };

  if (!Number.isFinite(Date.parse(output.createdAt)) ||
      !Number.isFinite(Date.parse(output.updatedAt))) {
    throw new Error("วันที่สร้างหรือวันที่แก้ไขไม่ถูกต้อง");
  }

  if (input.sourceKey !== undefined) {
    output.sourceKey = requireText(input.sourceKey, "รหัสที่มา", 200);
    if (!output.sourceKey) throw new Error("รหัสที่มาต้องไม่ว่าง");
  }

  if (input.sourceTimestamp !== undefined) {
    output.sourceTimestamp = requireText(
      input.sourceTimestamp, "ประทับเวลาเดิม", 200
    );
  }

  return output;
}

/* ---------- IndexedDB ----------
   เก็บ ledger เป็น snapshot เดียว
   ทุกการแก้ไขใช้ readwrite transaction อ่านค่าล่าสุดก่อนเขียน
   จึงไม่เขียนทับข้อมูลทั้งชุดจาก state เก่าของอีกแท็บ
-------------------------------- */

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("เบราว์เซอร์นี้ไม่รองรับ IndexedDB"));
      return;
    }

    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };

    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      resolve(database);
    };

    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      notify("กรุณาปิดแท็บเก่าของแอป แล้วเปิดใหม่", true);
    };
  });
}

function readRecords() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get("ledger");

    transaction.oncomplete = () => {
      resolve(request.result?.records ?? []);
    };

    transaction.onabort = () => {
      reject(transaction.error || new Error("อ่านข้อมูลไม่สำเร็จ"));
    };
  });
}

function mutateRecords(mutator) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get("ledger");

    let result;
    let nextRecords;
    let localError;

    request.onsuccess = () => {
      try {
        const current = request.result?.records ?? [];
        result = mutator(current);
        nextRecords = result.records;

        if (nextRecords.length > MAX_RECORDS) {
          throw new Error(`รองรับสูงสุด ${MAX_RECORDS.toLocaleString()} รายการ`);
        }

        store.put({
          schemaVersion: BACKUP_VERSION,
          records: nextRecords
        }, "ledger");
      } catch (error) {
        localError = error;
        transaction.abort();
      }
    };

    transaction.oncomplete = () => {
      records = nextRecords;
      channel?.postMessage("changed");
      resolve(result);
    };

    transaction.onabort = () => {
      reject(localError || transaction.error ||
        new Error("บันทึกไม่สำเร็จ อาจมีพื้นที่เก็บข้อมูลไม่เพียงพอ"));
    };
  });
}

/* ---------- Rendering ---------- */

function fillCategoryOptions() {
  for (const category of CATEGORIES) {
    $("expenseCategory").add(new Option(category.name, category.id));
  }

  $("filterCategory").add(new Option("ทุกกิจกรรม", ""));

  for (const category of CATEGORIES) {
    $("filterCategory").add(new Option(category.name, category.id));
  }
}

function filteredRecords() {
  const month = $("filterMonth").value;
  const category = $("filterCategory").value;
  const search = $("filterSearch").value.trim().toLocaleLowerCase("th");

  return records.filter(record => {
    const name = CATEGORY_MAP.get(record.category).name;

    return (!month || record.date.startsWith(month)) &&
      (!category || record.category === category) &&
      (!search ||
        `${name} ${record.note}`.toLocaleLowerCase("th").includes(search));
  }).sort((a, b) =>
    b.date.localeCompare(a.date) ||
    b.createdAt.localeCompare(a.createdAt) ||
    a.id.localeCompare(b.id)
  );
}

function renderChart(targetId, entries) {
  const container = $(targetId);
  container.replaceChildren();

  if (!entries.length) {
    container.append(element("p", "empty", "ยังไม่มีข้อมูล"));
    return;
  }

  const maxValue = Math.max(1, ...entries.map(entry => entry[1]));

  for (const [label, value] of entries) {
    const row = element("div");
    const heading = element("div", "bar-label");
    heading.append(
      element("span", "", label),
      element("strong", "", money(value))
    );

    const track = element("div", "bar-track");
    const fill = element("div", "bar-fill");
    fill.style.width = `${(value / maxValue) * 100}%`;
    track.setAttribute("aria-hidden", "true");
    track.append(fill);

    row.append(heading, track);
    container.append(row);
  }
}

function render() {
  const filtered = filteredRecords();

  $("allTotal").textContent = money(total(records));
  $("filteredTotal").textContent = money(total(filtered));
  $("filteredCount").textContent = filtered.length.toLocaleString("th-TH");

  const categories = new Map();
  const months = new Map();

  for (const record of filtered) {
    categories.set(
      record.category,
      (categories.get(record.category) || 0) + record.amountCents
    );

    const month = record.date.slice(0, 7);
    months.set(month, (months.get(month) || 0) + record.amountCents);
  }

  renderChart(
    "categoryChart",
    [...categories.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id, cents]) => [CATEGORY_MAP.get(id).name, cents])
  );

  renderChart(
    "monthChart",
    [...months.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, cents]) => [displayMonth(month), cents])
  );

  const maxPage = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  page = Math.max(1, Math.min(page, maxPage));

  $("pageLabel").textContent = `หน้า ${page} / ${maxPage}`;
  $("previousPage").disabled = page === 1;
  $("nextPage").disabled = page === maxPage;

  const list = $("expenseList");
  list.replaceChildren();

  const visible = filtered.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  if (!visible.length) {
    list.append(element("p", "empty", "ไม่พบรายการตามตัวกรอง"));
    return;
  }

  for (const record of visible) {
    const article = element("article", "expense-item");
    const detail = element("div");

    detail.append(
      element("div", "expense-title",
        CATEGORY_MAP.get(record.category).name),
      element("div", "expense-meta", displayDate(record.date))
    );

    if (record.note) {
      detail.append(element("p", "expense-note", record.note));
    }

    if (record.sourceTimestamp) {
      detail.append(element(
        "p",
        "muted",
        `นำเข้าจากประทับเวลา: ${record.sourceTimestamp}`
      ));
    }

    const side = element("div");
    side.append(element("div", "expense-amount", money(record.amountCents)));

    const controls = element("div", "expense-controls");

    const editButton = element("button", "secondary small", "แก้ไข");
    editButton.dataset.action = "edit";
    editButton.dataset.id = record.id;

    const deleteButton = element("button", "danger small", "ลบ");
    deleteButton.dataset.action = "delete";
    deleteButton.dataset.id = record.id;

    controls.append(editButton, deleteButton);
    side.append(controls);
    article.append(detail, side);
    list.append(article);
  }
}

/* ---------- Add / Edit / Delete ---------- */

function resetForm() {
  editing = null;
  $("expenseForm").reset();
  $("expenseDate").value = today();
  $("formTitle").textContent = "เพิ่มค่าใช้จ่าย";
  $("cancelEdit").hidden = true;
}

function editRecord(id) {
  const record = records.find(item => item.id === id);
  if (!record) throw new Error("ไม่พบรายการนี้");

  editing = {
    id: record.id,
    updatedAt: record.updatedAt
  };

  $("expenseDate").value = record.date;
  $("expenseCategory").value = record.category;
  $("expenseAmount").value = (record.amountCents / 100).toFixed(2);
  $("expenseNote").value = record.note;
  $("formTitle").textContent = "แก้ไขค่าใช้จ่าย";
  $("cancelEdit").hidden = false;

  $("expenseForm").scrollIntoView({ behavior: "smooth", block: "center" });
  $("expenseDate").focus({ preventScroll: true });
}

async function saveExpense(event) {
  event.preventDefault();

  const draft = {
    date: $("expenseDate").value,
    category: $("expenseCategory").value,
    amountCents: parseMoney($("expenseAmount").value),
    note: $("expenseNote").value.trim()
  };

  const editSnapshot = editing ? { ...editing } : null;
  const newId = crypto.randomUUID();

  await mutateRecords(current => {
    const now = new Date().toISOString();

    if (editSnapshot) {
      const index = current.findIndex(item => item.id === editSnapshot.id);

      if (index < 0) {
        throw new Error("รายการนี้ถูกลบแล้ว กรุณายกเลิกการแก้ไข");
      }

      if (current[index].updatedAt !== editSnapshot.updatedAt) {
        throw new Error(
          "รายการถูกแก้ไขจากอีกแท็บ กรุณายกเลิกแล้วเปิดรายการใหม่"
        );
      }

      const old = current[index];

      const updated = validateRecord({
        ...old,
        ...draft,
        // รับประกัน revision timestamp เปลี่ยนแม้แก้ไขในมิลลิวินาทีเดียวกัน
        updatedAt: new Date(
          Math.max(Date.now(), Date.parse(old.updatedAt) + 1)
        ).toISOString()
      });

      const next = current.slice();
      next[index] = updated;
      return { records: next };
    }

    const added = validateRecord({
      id: newId,
      ...draft,
      createdAt: now,
      updatedAt: now
    });

    return { records: [...current, added] };
  });

  resetForm();
  render();
  notify("บันทึกค่าใช้จ่ายแล้ว");
}

async function deleteRecord(id) {
  const snapshot = records.find(item => item.id === id);
  if (!snapshot) return;

  if (!confirm(
    `ลบรายการ ${CATEGORY_MAP.get(snapshot.category).name} ` +
    `${money(snapshot.amountCents)} หรือไม่?`
  )) return;

  await mutateRecords(current => {
    const latest = current.find(item => item.id === id);

    if (latest && latest.updatedAt !== snapshot.updatedAt) {
      throw new Error("รายการถูกแก้ไขจากอีกแท็บ กรุณาตรวจสอบใหม่");
    }

    return { records: current.filter(item => item.id !== id) };
  });

  if (editing?.id === id) resetForm();
  render();
  notify("ลบรายการแล้ว");
}

/* ---------- CSV Parser ----------
   รองรับ UTF-8 BOM, comma, quoted fields,
   escaped quotes และ newline ภายใน quoted field
---------------------------------- */

function parseCSV(text) {
  text = text.replace(/^\uFEFF/, "");

  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  let afterQuote = false;

  function endField() {
    row.push(field);
    field = "";
    afterQuote = false;
  }

  function endRow() {
    endField();
    if (row.some(cell => cell.trim() !== "")) rows.push(row);
    row = [];
  }

  for (let index = 0; index < text.length; index++) {
    const char = text[index];

    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index++;
        } else {
          quoted = false;
          afterQuote = true;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (afterQuote && char !== "," && char !== "\r" && char !== "\n") {
      if (char === " " || char === "\t") continue;
      throw new Error("CSV มีอักขระผิดตำแหน่งหลังเครื่องหมายคำพูด");
    }

    if (char === '"') {
      if (field !== "" || afterQuote) {
        throw new Error("CSV มีเครื่องหมายคำพูดผิดรูปแบบ");
      }
      quoted = true;
    } else if (char === ",") {
      endField();
    } else if (char === "\r" || char === "\n") {
      if (char === "\r" && text[index + 1] === "\n") index++;
      endRow();
    } else {
      field += char;
    }
  }

  if (quoted) throw new Error("CSV ปิดเครื่องหมายคำพูดไม่ครบ");

  if (field !== "" || row.length || afterQuote) endRow();
  if (rows.length < 2) throw new Error("CSV ไม่มีแถวข้อมูล");

  const headers = rows.shift().map(normalizeHeader);

  if (headers.some(header => !header) ||
      new Set(headers).size !== headers.length) {
    throw new Error("CSV มีหัวคอลัมน์ว่างหรือซ้ำ");
  }

  return rows.map((cells, index) => {
    if (cells.length !== headers.length) {
      throw new Error(`CSV แถวข้อมูล ${index + 1} มีจำนวนคอลัมน์ไม่ครบ`);
    }

    const output = Object.create(null);
    headers.forEach((header, column) => {
      output[header] = cells[column];
    });
    return output;
  });
}

/* ---------- Migration ---------- */

async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(hash))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

function normalizeLegacyRow(row) {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    throw new Error("แถวข้อมูลเดิมต้องเป็น JSON object");
  }

  const normalized = Object.create(null);

  for (const [key, value] of Object.entries(row)) {
    const header = normalizeHeader(key);

    if (Object.hasOwn(normalized, header)) {
      throw new Error(`พบหัวคอลัมน์ซ้ำ: ${header}`);
    }

    normalized[header] = value;
  }

  return normalized;
}

async function migrateLegacyRows(rows, dateOrder) {
  if (!Array.isArray(rows) || !rows.length) {
    throw new Error("ไม่มีแถวข้อมูลสำหรับนำเข้า");
  }

  if (rows.length > MAX_RECORDS) {
    throw new Error("ไฟล์มีจำนวนแถวมากเกินกำหนด");
  }

  const output = [];
  const occurrences = new Map();
  const now = new Date().toISOString();

  for (let index = 0; index < rows.length; index++) {
    try {
      const row = normalizeLegacyRow(rows[index]);

      if (!Object.hasOwn(row, "ประทับเวลา")) {
        throw new Error('ไม่พบคอลัมน์ "ประทับเวลา"');
      }

      if (!CATEGORIES.some(category =>
        Object.hasOwn(row, normalizeHeader(category.amount))
      )) {
        throw new Error("ไม่พบคอลัมน์ Event ของ Google Sheet เดิม");
      }

      let parsedDate = null;
      const sourceTimestamp = String(row["ประทับเวลา"] ?? "").trim();

      for (const category of CATEGORIES) {
        const rawAmount = row[normalizeHeader(category.amount)];
        const note = String(
          row[normalizeHeader(category.detail)] ?? ""
        ).trim();

        const amountIsBlank = rawAmount === null ||
          rawAmount === undefined ||
          String(rawAmount).trim() === "";

        if (amountIsBlank) {
          if (note) {
            throw new Error(
              `${category.name} มีรายละเอียดแต่ไม่มีจำนวนเงิน ` +
              "กรุณาระบุยอด หรือใส่ 0 หากต้องการเก็บเฉพาะบันทึก"
            );
          }
          continue;
        }

        if (!parsedDate) {
          parsedDate = parseLegacyDate(sourceTimestamp, dateOrder);
        }

        const amountCents = parseMoney(rawAmount);

        // เพิ่มลำดับ occurrence เพื่อไม่ทิ้งแถวเหมือนกันภายในไฟล์เดียว
        const fingerprint = JSON.stringify([
          sourceTimestamp,
          parsedDate,
          category.id,
          amountCents,
          note
        ]);

        const occurrence = (occurrences.get(fingerprint) || 0) + 1;
        occurrences.set(fingerprint, occurrence);

        const sourceKey = "sheet-v1-" + await sha256(
          JSON.stringify([fingerprint, occurrence])
        );

        output.push(validateRecord({
          id: `legacy-${sourceKey}`,
          date: parsedDate,
          category: category.id,
          amountCents,
          note,
          createdAt: now,
          updatedAt: now,
          sourceKey,
          sourceTimestamp
        }));

        if (output.length > MAX_RECORDS) {
          throw new Error("จำนวนรายการหลังแยกกิจกรรมมากเกินกำหนด");
        }
      }
    } catch (error) {
      throw new Error(`แถวข้อมูล ${index + 1}: ${error.message}`);
    }
  }

  if (!output.length) {
    throw new Error("ไม่พบกิจกรรมที่มีจำนวนเงิน");
  }

  return output;
}

function validateRecordArray(input) {
  if (!Array.isArray(input) || input.length > MAX_RECORDS) {
    throw new Error("รายการใน JSON ไม่ถูกต้องหรือมีจำนวนมากเกินกำหนด");
  }

  const validated = input.map(validateRecord);
  const ids = new Set();
  const sources = new Set();

  for (const record of validated) {
    if (ids.has(record.id)) {
      throw new Error("JSON มีรหัสรายการซ้ำ");
    }
    ids.add(record.id);

    if (record.sourceKey) {
      if (sources.has(record.sourceKey)) {
        throw new Error("JSON มีรหัสที่มาซ้ำ");
      }
      sources.add(record.sourceKey);
    }
  }

  return validated;
}

function mergePlan(current, incoming, replace) {
  const base = replace ? [] : current.slice();
  const ids = new Set(base.map(record => record.id));
  const sources = new Set(
    base.filter(record => record.sourceKey).map(record => record.sourceKey)
  );

  let added = 0;
  let skipped = 0;

  for (const record of incoming) {
    if (ids.has(record.id) ||
        (record.sourceKey && sources.has(record.sourceKey))) {
      skipped++;
      continue;
    }

    base.push(record);
    ids.add(record.id);
    if (record.sourceKey) sources.add(record.sourceKey);
    added++;
  }

  if (base.length > MAX_RECORDS) {
    throw new Error("จำนวนรายการรวมมากเกินกำหนด");
  }

  return { records: base, added, skipped };
}

function cancelImport() {
  pendingImport = null;
  $("importPreview").hidden = true;
}

async function prepareImport() {
  cancelImport();

  const file = $("importFile").files[0];
  if (!file) throw new Error("กรุณาเลือกไฟล์ CSV หรือ JSON");

  if (file.size > MAX_FILE_BYTES) {
    throw new Error("ไฟล์ต้องมีขนาดไม่เกิน 15 MB");
  }

  const mode = $("importMode").value;
  const dateOrder = $("dateOrder").value;
  const button = $("prepareImport");
  button.disabled = true;

  try {
    const text = (await file.text()).replace(/^\uFEFF/, "");
    let incoming;
    let isBackup = false;
    let isLegacy = false;

    if (/\.csv$/i.test(file.name)) {
      incoming = await migrateLegacyRows(parseCSV(text), dateOrder);
      isLegacy = true;
    } else if (/\.json$/i.test(file.name)) {
      let parsed;

      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error("ไฟล์ JSON ไม่ถูกต้อง");
      }

      if (parsed && !Array.isArray(parsed) && parsed.app === APP_ID) {
        if (parsed.schemaVersion !== BACKUP_VERSION) {
          throw new Error("ไม่รองรับเวอร์ชันไฟล์สำรองนี้");
        }

        incoming = validateRecordArray(parsed.records);
        isBackup = true;
      } else if (Array.isArray(parsed)) {
        if (parsed.length &&
            parsed[0] &&
            typeof parsed[0] === "object" &&
            Object.hasOwn(parsed[0], "amountCents")) {
          incoming = validateRecordArray(parsed);
        } else {
          incoming = await migrateLegacyRows(parsed, dateOrder);
          isLegacy = true;
        }
      } else {
        throw new Error(
          "JSON ต้องเป็นไฟล์สำรองของแอป หรือ array ของแถวข้อมูล"
        );
      }
    } else {
      throw new Error("รองรับเฉพาะไฟล์ .csv และ .json ไม่รองรับ .xlsx");
    }

    if (mode === "replace" && !isBackup) {
      throw new Error(
        "แทนที่ทั้งหมดได้เฉพาะไฟล์สำรอง JSON ของแอป เพื่อป้องกันข้อมูลสูญหาย"
      );
    }

    const current = await readRecords();
    const plan = mergePlan(current, incoming, mode === "replace");
    const dates = incoming.map(record => record.date).sort();

    const dateRange = dates.length
      ? `${displayDate(dates[0])} ถึง ${displayDate(dates[dates.length - 1])}`
      : "ไม่มีรายการ";

    $("previewSummary").textContent =
      `อ่านได้ ${incoming.length.toLocaleString()} รายการ ` +
      `รวม ${money(total(incoming))} • วันที่ ${dateRange} • ` +
      `${mode === "replace" ? "แทนที่ด้วย" : "เพิ่ม"} ${plan.added} รายการ ` +
      `• ข้ามซ้ำ ${plan.skipped} รายการ`;

    $("previewExplanation").textContent =
      (isLegacy
        ? "วันที่ใช้ประทับเวลาจากฟอร์ม ไม่ได้ตีความวันที่ในรายละเอียดคอร์ส " +
          "ตรวจสอบวัน/เดือนให้ถูกต้องก่อนยืนยัน "
        : "") +
      (mode === "replace"
        ? `ข้อมูลปัจจุบัน ${current.length} รายการจะถูกแทนที่ทั้งหมด ` +
          "ควรสำรอง JSON ก่อนดำเนินการ"
        : "หากรหัสรายการหรือรหัสที่มาซ้ำ จะคงรายการในเครื่องไว้ " +
          "ไม่เขียนทับรายการที่คุณแก้ไขแล้ว");

    pendingImport = { incoming, mode };
    $("importPreview").hidden = false;
  } finally {
    button.disabled = false;
  }
}

async function confirmImport() {
  if (!pendingImport) throw new Error("กรุณาตรวจสอบไฟล์ก่อน");

  const pending = pendingImport;

  if (pending.mode === "replace" &&
      !confirm("ยืนยันแทนที่ข้อมูลทั้งหมด? การทำงานนี้ย้อนกลับไม่ได้หากไม่มีไฟล์สำรอง")) {
    return;
  }

  $("confirmImport").disabled = true;

  try {
    // คำนวณซ้ำจากข้อมูลล่าสุดภายใน transaction ก่อนเขียนจริง
    const result = await mutateRecords(current =>
      mergePlan(current, pending.incoming, pending.mode === "replace")
    );

    cancelImport();
    $("importFile").value = "";
    resetForm();
    page = 1;
    render();

    notify(
      `นำเข้าแล้ว ${result.added} รายการ ข้ามข้อมูลซ้ำ ${result.skipped} รายการ`
    );
  } finally {
    $("confirmImport").disabled = false;
  }
}

/* ---------- Backup and Report Export ---------- */

function download(content, mime, filename) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

async function exportJSON() {
  const current = await readRecords();

  const backup = {
    app: APP_ID,
    schemaVersion: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    currency: "THB",
    records: current
  };

  download(
    JSON.stringify(backup, null, 2),
    "application/json;charset=utf-8",
    `kids-expense-backup-${today()}.json`
  );

  notify("สร้างไฟล์สำรองแล้ว กรุณาตรวจสอบไฟล์ในรายการดาวน์โหลด");
}

function csvCell(value) {
  let text = String(value ?? "");

  // ป้องกัน spreadsheet formula injection ในคอลัมน์ข้อความ
  if (/^[\s\uFEFF]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) {
    text = "'" + text;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

async function exportCSV() {
  records = await readRecords();
  render();

  const filtered = filteredRecords();
  if (!filtered.length) throw new Error("ไม่มีรายการสำหรับส่งออก");

  const rows = [
    [
      "วันที่จ่าย",
      "หมวดกิจกรรม",
      "จำนวนเงิน (บาท)",
      "รายละเอียด",
      "ประทับเวลาเดิม",
      "รหัสรายการ"
    ],
    ...filtered.map(record => [
      record.date,
      CATEGORY_MAP.get(record.category).name,
      (record.amountCents / 100).toFixed(2),
      record.note,
      record.sourceTimestamp || "",
      record.id
    ])
  ];

  const csv = "\uFEFF" +
    rows.map(row => row.map(csvCell).join(",")).join("\r\n");

  download(
    csv,
    "text/csv;charset=utf-8",
    `kids-expense-report-${today()}.csv`
  );

  notify(`ส่งออกรายงาน ${filtered.length} รายการแล้ว`);
}

/* ---------- Storage ---------- */

async function requestPersistence() {
  if (!navigator.storage?.persist) {
    $("storageStatus").textContent =
      "เบราว์เซอร์นี้ไม่มี API ขอเก็บข้อมูลถาวร กรุณาสำรอง JSON";
    return;
  }

  const granted = await navigator.storage.persist();

  $("storageStatus").textContent = granted
    ? "ได้รับสิทธิ์เก็บข้อมูลถาวรแล้ว แต่การล้างข้อมูลเว็บไซต์ยังลบข้อมูลได้"
    : "เบราว์เซอร์ยังไม่อนุมัติ แอปยังใช้งานได้ ควรสำรอง JSON เป็นประจำ";
}

/* ---------- PWA ---------- */

function updateNetworkStatus() {
  $("networkStatus").textContent =
    navigator.onLine ? "ออนไลน์" : "ออฟไลน์";
}

window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  installPrompt = event;
  $("installButton").hidden = false;
});

window.addEventListener("appinstalled", () => {
  installPrompt = null;
  $("installButton").hidden = true;
});

async function installApp() {
  if (!installPrompt) return;
  await installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  $("installButton").hidden = true;
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    $("offlineStatus").textContent =
      "เบราว์เซอร์นี้ไม่รองรับ Service Worker จึงยังเปิดแอปออฟไลน์ไม่ได้";
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register("./sw.js");

    function showWaiting() {
      if (registration.waiting) {
        $("offlineStatus").textContent =
          "มีแอปเวอร์ชันใหม่ กรุณาปิดทุกแท็บและหน้าต่างแอป แล้วเปิดใหม่";
      }
    }

    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      if (!worker) return;

      worker.addEventListener("statechange", () => {
        if (worker.state === "installed") showWaiting();
      });
    });

    await navigator.serviceWorker.ready;

    $("offlineStatus").textContent =
      "พร้อมใช้ออฟไลน์ — บันทึก วิเคราะห์ และสำรองข้อมูลได้";
    showWaiting();
  } catch (error) {
    console.error(error);
    $("offlineStatus").textContent =
      "ยังเตรียมออฟไลน์ไม่สำเร็จ ตรวจสอบ HTTPS และไฟล์ทั้งหมด แล้วเปิดใหม่";
  }
}

/* ---------- Initialize ---------- */

async function refreshFromDatabase() {
  if (!db) return;
  records = await readRecords();
  render();
}

async function main() {
  if (!window.isSecureContext) {
    throw new Error("กรุณาเปิดผ่าน HTTPS หรือ localhost ไม่ใช่การดับเบิลคลิกไฟล์");
  }

  fillCategoryOptions();
  resetForm();

  db = await openDatabase();
  records = await readRecords();
  render();

  on("expenseForm", "submit", saveExpense);
  on("cancelEdit", "click", resetForm);

  on("expenseList", "click", async event => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    if (button.dataset.action === "edit") {
      editRecord(button.dataset.id);
    } else {
      await deleteRecord(button.dataset.id);
    }
  });

  for (const id of ["filterMonth", "filterCategory", "filterSearch"]) {
    on(id, "input", () => {
      page = 1;
      render();
    });
  }

  on("clearFilters", "click", () => {
    $("filterMonth").value = "";
    $("filterCategory").value = "";
    $("filterSearch").value = "";
    page = 1;
    render();
  });

  on("previousPage", "click", () => {
    page--;
    render();
  });

  on("nextPage", "click", () => {
    page++;
    render();
  });

  on("exportJson", "click", exportJSON);
  on("exportCsv", "click", exportCSV);
  on("persistStorage", "click", requestPersistence);
  on("prepareImport", "click", prepareImport);
  on("confirmImport", "click", confirmImport);
  on("cancelImport", "click", cancelImport);
  on("installButton", "click", installApp);

  for (const id of ["importFile", "dateOrder", "importMode"]) {
    on(id, "change", cancelImport);
  }

  window.addEventListener("online", updateNetworkStatus);
  window.addEventListener("offline", updateNetworkStatus);
  updateNetworkStatus();

  channel?.addEventListener("message", () => {
    refreshFromDatabase().catch(handleError);
  });

  window.addEventListener("focus", () => {
    refreshFromDatabase().catch(handleError);
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshFromDatabase().catch(handleError);
  });

  await registerServiceWorker();
}

main().catch(error => {
  $("offlineStatus").textContent =
    "เริ่มต้นแอปไม่สำเร็จ กรุณาตรวจสอบเบราว์เซอร์และพื้นที่จัดเก็บ";
  handleError(error);
});