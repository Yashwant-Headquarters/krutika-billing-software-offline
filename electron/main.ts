import { app, BrowserWindow, dialog, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import * as XLSX from "xlsx";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db: Database.Database;
let mainWindow: BrowserWindow | null = null;
const isDev = !app.isPackaged;
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, "../dist/assets/favicon-CSEqdlLM.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.setMenu(null);
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

/* =========================
   DATABASE INITIALIZATION
========================= */

function initializeDatabase() {
  const dbPath = path.join(app.getPath("userData"), "emitra.db");
  db = new Database(dbPath);

  db.pragma("foreign_keys = ON");

  // Customers
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT
    )
  `,
  ).run();

  // Invoices
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT,
      shop_name TEXT,
      shop_phone TEXT,
      shop_address TEXT,
      customer_id INTEGER,
      date TEXT,
      custom_gst REAL,
      discount REAL,
      total REAL,
      FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
    )
  `,
  ).run();

  // Invoice Items
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER,
      item_name TEXT,
      quantity INTEGER,
      price REAL,
      total REAL,
      FOREIGN KEY(invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
    )
  `,
  ).run();

  // Master Items Table (Auto Suggest ke liye)
  db.prepare(
    `
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    price REAL
  )
`,
  ).run();
}

/* =========================
   GET CUSTOMERS (Pagination + Search)
========================= */

ipcMain.handle(
  "get-customers",
  (_, page: number, limit: number, search: string) => {
    const offset = (page - 1) * limit;

    let whereClause = "";
    let params: any[] = [];

    if (search && search.length >= 3) {
      whereClause = `
        WHERE name LIKE ? OR phone LIKE ?
      `;
      params.push(`%${search}%`, `%${search}%`);
    }

    // Total Count
    const totalResult: any = db
      .prepare(
        `
        SELECT COUNT(*) as total
        FROM customers
        ${whereClause}
      `,
      )
      .get(...params);

    const total = totalResult.total;

    // Paged Data
    const rows = db
      .prepare(
        `
        SELECT *
        FROM customers
        ${whereClause}
        ORDER BY id DESC
        LIMIT ? OFFSET ?
      `,
      )
      .all(...params, limit, offset);

    return {
      data: rows,
      total,
      totalPages: Math.ceil(total / limit),
    };
  },
);

/* =========================
   ITEM SUGGEST (AutoComplete)
========================= */

ipcMain.handle("search-items", (_, search: string) => {
  if (!search || search.length < 2) return [];

  return db
    .prepare(
      `
      SELECT id, name, price
      FROM items
      WHERE name LIKE ?
      ORDER BY name ASC
      LIMIT 10
    `,
    )
    .all(`%${search}%`);
});

/* =========================
   CUSTOMER SUGGEST (AutoComplete)
========================= */

ipcMain.handle("search-customers", (_, search: string) => {
  if (!search || search.length < 2) return [];

  const rows = db
    .prepare(
      `
      SELECT id, name, phone, address
      FROM customers
      WHERE name LIKE ? OR phone LIKE ?
      ORDER BY name ASC
      LIMIT 10
    `,
    )
    .all(`%${search}%`, `%${search}%`);

  return rows;
});

/* =========================
   SAVE INVOICE
========================= */

ipcMain.handle("save-invoice", (_, data) => {
  const transaction = db.transaction(() => {
    /* =========================
       1️⃣ CHECK IF CUSTOMER EXISTS
    ========================= */

    let customer: any = db
      .prepare(`SELECT id, name, address FROM customers WHERE phone = ?`)
      .get(data.customer.phone);

    let customerId: number;

    if (customer) {
      customerId = customer.id;

      const normalize = (val: any) =>
        (val || "").toString().trim().toLowerCase();

      const nameChanged =
        normalize(customer.name) !== normalize(data.customer.name);

      const addressChanged =
        normalize(customer.address) !== normalize(data.customer.address);

      if (nameChanged || addressChanged) {
        db.prepare(
          `
      UPDATE customers
      SET name = ?, address = ?
      WHERE id = ?
    `,
        ).run(data.customer.name, data.customer.address, customerId);
      } else {
      }
    } else {
      const result = db
        .prepare(
          `
    INSERT INTO customers (name, phone, address)
    VALUES (?, ?, ?)
  `,
        )
        .run(data.customer.name, data.customer.phone, data.customer.address);

      customerId = result.lastInsertRowid as number;
    }

    /* =========================
       2️⃣ CALCULATE TOTAL
    ========================= */

    let subtotal = 0;
    data.items.forEach((item: any) => {
      subtotal += item.quantity * item.price;
    });

    const gstAmount = (subtotal * data.custom_gst) / 100;
    const finalTotal = subtotal + gstAmount - data.discount;

    /* =========================
       3️⃣ INSERT INVOICE
    ========================= */

    const invoiceResult = db
      .prepare(
        `
        INSERT INTO invoices
        (invoice_number, shop_name, shop_phone, shop_address,
         customer_id, date, custom_gst, discount, total)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        data.invoice_number,
        data.shop_name,
        data.shop_phone,
        data.shop_address,
        customerId,
        data.date,
        data.custom_gst,
        data.discount,
        finalTotal,
      );

    const invoiceId = invoiceResult.lastInsertRowid as number;

    /* =========================
       4️⃣ INSERT ITEMS
    ========================= */

    const itemStmt = db.prepare(`
      INSERT INTO invoice_items
      (invoice_id, item_name, quantity, price, total)
      VALUES (?, ?, ?, ?, ?)
    `);

    data.items.forEach((item: any) => {
      itemStmt.run(
        invoiceId,
        item.item_name,
        item.quantity,
        item.price,
        item.quantity * item.price,
      );
    });

    // Save to master items table for autocomplete
    const masterStmt = db.prepare(`
      INSERT OR IGNORE INTO items (name, price)
      VALUES (?, ?)
    `);

    data.items.forEach((item: any) => {
      masterStmt.run(item.item_name, item.price);
    });

    return true;
  });

  return transaction();
});

/* =========================
   GET INVOICES (Pagination)
========================= */

ipcMain.handle(
  "get-invoices",
  (_, page: number, limit: number, search: string, date: string) => {
    const offset = (page - 1) * limit;

    let whereClause = "";
    let params: any[] = [];

    if (search && search.length >= 3) {
      whereClause += `
        (invoices.invoice_number LIKE ? 
         OR customers.name LIKE ?)
      `;
      params.push(`%${search}%`, `%${search}%`);
    }

    if (date) {
      if (whereClause) whereClause += " AND ";
      whereClause += `invoices.date = ?`;
      params.push(date);
    }

    const whereSQL = whereClause ? `WHERE ${whereClause}` : "";

    // Total Count
    const totalResult: any = db
      .prepare(
        `
        SELECT COUNT(*) as total
        FROM invoices
        JOIN customers ON invoices.customer_id = customers.id
        ${whereSQL}
      `,
      )
      .get(...params);

    const total = totalResult.total;

    // Paged Data
    const rows = db
      .prepare(
        `
        SELECT invoices.*, customers.name as customer_name , customers.phone as customer_phone
        FROM invoices
        JOIN customers ON invoices.customer_id = customers.id
        ${whereSQL}
        ORDER BY invoices.id DESC
        LIMIT ? OFFSET ?
      `,
      )
      .all(...params, limit, offset);

    return {
      data: rows,
      total,
      totalPages: Math.ceil(total / limit),
    };
  },
);

/* =========================
   GET FULL INVOICE DETAILS
========================= */

ipcMain.handle("get-invoice-details", (_, invoiceId: number) => {
  const invoice = db
    .prepare(
      `
    SELECT invoices.*, customers.*
    FROM invoices
    JOIN customers ON invoices.customer_id = customers.id
    WHERE invoices.id = ?
  `,
    )
    .get(invoiceId);

  const items = db
    .prepare(
      `
    SELECT * FROM invoice_items
    WHERE invoice_id = ?
  `,
    )
    .all(invoiceId);

  return { invoice, items };
});

/* =========================
   Export Customers
========================= */

ipcMain.handle("export-customers-excel", async () => {
  const customers = db
    .prepare(`SELECT name, phone, address FROM customers ORDER BY id DESC`)
    .all();

  if (!customers.length) {
    dialog.showMessageBox({
      type: "info",
      message: "No customers found to export",
    });
    return false;
  }

  const { filePath } = await dialog.showSaveDialog({
    defaultPath: "Customers.xlsx",
    filters: [{ name: "Excel", extensions: ["xlsx"] }],
  });

  if (!filePath) return false;

  const worksheet = XLSX.utils.json_to_sheet(customers);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Customers");

  const buffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  });

  fs.writeFileSync(filePath, buffer);

  return true;
});

/* =========================
   DELETE INVOICE
========================= */

ipcMain.handle("delete-invoice", (_, invoiceId: number) => {
  db.prepare(`DELETE FROM invoices WHERE id = ?`).run(invoiceId);
  return true;
});

/* =========================
   APP START
========================= */

app.whenReady().then(() => {
  initializeDatabase();
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
