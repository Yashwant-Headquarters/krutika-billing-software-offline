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
      status TEXT CHECK(status IN ('PAID','UNPAID','CANCEL')) DEFAULT 'PAID',
      invoice_number TEXT,
      shop_name TEXT,
      shop_phone TEXT,
      shop_address TEXT,
      customer_id INTEGER,
      date TEXT,
      custom_gst REAL,
      discount REAL,
      total REAL,
      pending_amount REAL DEFAULT 0,
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

function migrateDatabase() {
  try {
    db.prepare(
      `ALTER TABLE invoices ADD COLUMN status TEXT CHECK(status IN ('PAID','UNPAID','CANCEL')) DEFAULT 'PAID'`,
    ).run();
  } catch {}

  try {
    db.prepare(
      `ALTER TABLE invoices ADD COLUMN pending_amount REAL DEFAULT 0`,
    ).run();
  } catch {}

  try {
    db.prepare(`ALTER TABLE customers ADD COLUMN gstin TEXT`).run();
  } catch {}

  try {
    db.prepare(`ALTER TABLE invoices ADD COLUMN customer_name TEXT`).run();
  } catch {}

  try {
    db.prepare(`ALTER TABLE invoices ADD COLUMN customer_phone TEXT`).run();
  } catch {}

  try {
    db.prepare(`ALTER TABLE invoices ADD COLUMN customer_address TEXT`).run();
  } catch {}

  try {
    db.prepare(`ALTER TABLE invoices ADD COLUMN customer_gstin TEXT`).run();
  } catch {}
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
      .prepare(`SELECT id, name, address, gstin FROM customers WHERE phone = ?`)
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

      const gstChanged =
        normalize(customer.gstin) !== normalize(data.customer.gstin);

      if (nameChanged || addressChanged || gstChanged) {
        db.prepare(
          `
    UPDATE customers
    SET name = ?, address = ?, gstin = ?
    WHERE id = ?
  `,
        ).run(
          data.customer.name,
          data.customer.address,
          data.customer.gstin || null,
          customerId,
        );
      }
    } else {
      const result = db
        .prepare(
          `
    INSERT INTO customers (name, phone, address, gstin)
VALUES (?, ?, ?, ?)
  `,
        )
        .run(
          data.customer.name,
          data.customer.phone,
          data.customer.address,
          data.customer.gstin || null,
        );

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
       INSERT INTO invoices (
  status, pending_amount, invoice_number,
  shop_name, shop_phone, shop_address,
  customer_id,
  customer_name,
  customer_phone,
  customer_address,
  customer_gstin,
  date, custom_gst, discount, total
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        data.status || "PAID",
        data.pending_amount || 0,
        data.invoice_number,
        data.shop_name,
        data.shop_phone,
        data.shop_address,
        customerId,
        data.customer.name,
        data.customer.phone,
        data.customer.address,
        data.customer.gstin || null,
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

    return invoiceId;
  });

  return transaction();
});

/* =========================
   GET INVOICES (Pagination)
========================= */

ipcMain.handle(
  "get-invoices",
  (
    _,
    page: number,
    limit: number,
    search: string,
    date: string,
    customerId?: number,
  ) => {
    const offset = (page - 1) * limit;

    let whereClause = "1=1";
    let params: any[] = [];

    if (customerId) {
      whereClause += " AND invoices.customer_id = ?";
      params.push(customerId);
    }

    if (search && search.length >= 3) {
      whereClause += `
        AND (
          invoices.invoice_number LIKE ? 
          OR COALESCE(invoices.customer_name, customers.name) LIKE ?
        )
      `;
      params.push(`%${search}%`, `%${search}%`);
    }

    if (date) {
      whereClause += ` AND invoices.date = ?`;
      params.push(date);
    }

    const whereSQL = `WHERE ${whereClause}`;

    // Total
    const totalResult: any = db
      .prepare(
        `
        SELECT COUNT(*) as total
        FROM invoices
        LEFT JOIN customers ON invoices.customer_id = customers.id
        ${whereSQL}
      `,
      )
      .get(...params);

    const total = totalResult.total;

    // Data
    const rows = db
      .prepare(
        `
        SELECT 
          invoices.*,
          COALESCE(invoices.customer_name, customers.name) as customer_name,
          COALESCE(invoices.customer_phone, customers.phone) as customer_phone,
          COALESCE(invoices.customer_address, customers.address) as customer_address,
          COALESCE(invoices.customer_gstin, customers.gstin) as customer_gstin
        FROM invoices
        LEFT JOIN customers ON invoices.customer_id = customers.id
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
    SELECT 
      invoices.*,
      COALESCE(invoices.customer_name, customers.name) as customer_name,
      COALESCE(invoices.customer_phone, customers.phone) as customer_phone,
      COALESCE(invoices.customer_address, customers.address) as customer_address,
      COALESCE(invoices.customer_gstin, customers.gstin) as customer_gstin
    FROM invoices
    LEFT JOIN customers ON invoices.customer_id = customers.id
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

//
// GET DASHBOARD
//

ipcMain.handle("get-dashboard", () => {
  const totalRevenue =
    (
      db
        .prepare(
          `SELECT SUM(total) as total FROM invoices WHERE status != 'CANCEL'`,
        )
        .get() as {
        total: number | null;
      }
    ).total || 0;

  const totalCustomers = (
    db.prepare(`SELECT COUNT(*) as count FROM customers`).get() as {
      count: number;
    }
  ).count;

  const totalInvoices = (
    db
      .prepare(
        `SELECT COUNT(*) as count FROM invoices WHERE status != 'CANCEL'`,
      )
      .get() as {
      count: number;
    }
  ).count;

  const pending =
    (
      db
        .prepare(
          `SELECT SUM(pending_amount) as pending FROM invoices WHERE status != 'CANCEL'`,
        )
        .get() as { pending: number | null }
    ).pending || 0;

  return { totalRevenue, totalCustomers, totalInvoices, pending };
});

//
// Get char data
//

ipcMain.handle("get-chart-data", (_, filter) => {
  if (["7", "15", "30", "90"].includes(filter)) {
    return db
      .prepare(
        `
      SELECT date as label, SUM(total) as total
      FROM invoices
      WHERE date >= date('now', '-${filter} days') AND status != 'CANCEL'
      GROUP BY date
      ORDER BY date
    `,
      )
      .all();
  }

  if (filter === "month") {
    return db
      .prepare(
        `
      SELECT SUBSTR(date,1,7) as label, SUM(total) as total
      FROM invoices
      WHERE status != 'CANCEL'
      GROUP BY label
      ORDER BY label
    `,
      )
      .all();
  }

  if (filter === "year") {
    return db
      .prepare(
        `
      SELECT SUBSTR(date,1,4) as label, SUM(total) as total
      FROM invoices
      WHERE status != 'CANCEL'
      GROUP BY label
      ORDER BY label
    `,
      )
      .all();
  }
});

//
// pending-customers
//

ipcMain.handle("pending-customers", () => {
  return db
    .prepare(
      `
    SELECT customers.name, SUM(invoices.pending_amount) as pending
    FROM invoices
    JOIN customers ON invoices.customer_id = customers.id
    WHERE status != 'CANCEL'
    GROUP BY customers.id
    HAVING pending > 0
    ORDER BY pending DESC
    LIMIT 5
  `,
    )
    .all();
});

//
// get-customer-details
//

ipcMain.handle("get-customer-full-details", (_, customerId) => {
  // Summary
  const summary = db
    .prepare(
      `
      SELECT 
        SUM(total) as totalSpend,
        SUM(pending_amount) as pending
      FROM invoices
      WHERE customer_id = ? AND status != 'CANCEL'
    `,
    )
    .get(customerId);

  // All invoices
  const invoices = db
    .prepare(
      `
      SELECT id, invoice_number, date, total, status, pending_amount
      FROM invoices
      WHERE customer_id = ?
      ORDER BY date DESC
    `,
    )
    .all(customerId);

  // Most bought items
  const topItems = db
    .prepare(
      `
      SELECT item_name, SUM(quantity) as qty
      FROM invoice_items
      JOIN invoices ON invoice_items.invoice_id = invoices.id
      WHERE invoices.customer_id = ?
      GROUP BY item_name
      ORDER BY qty DESC
      LIMIT 5
    `,
    )
    .all(customerId);

  // Customer info
  const customer = db
    .prepare(`SELECT * FROM customers WHERE id = ?`)
    .get(customerId);

  return {
    customer,
    summary,
    invoices,
    topItems,
  };
});

//
// dashboard-stats
//

ipcMain.handle("dashboard-stats", () => {
  const currentMonth =
    (
      db
        .prepare(
          `
    SELECT SUM(total) as total
    FROM invoices
    WHERE date(date) >= date('now','start of month')
      AND date(date) <= date('now') AND status != 'CANCEL'
  `,
        )
        .get() as { total: number | null }
    ).total || 0;

  const lastMonth =
    (
      db
        .prepare(
          `
    SELECT SUM(total) as total
    FROM invoices
    WHERE date(date) >= date('now','start of month','-1 month')
      AND date(date) < date('now','start of month') AND status != 'CANCEL'
  `,
        )
        .get() as { total: number | null }
    ).total || 0;

  const today =
    (
      db
        .prepare(
          `
      SELECT SUM(total) as total
      FROM invoices
      WHERE date(date) = date('now') AND status != 'CANCEL'
    `,
        )
        .get() as { total: number | null }
    ).total || 0;

  const growth =
    lastMonth === 0
      ? currentMonth > 0
        ? 100
        : 0
      : ((currentMonth - lastMonth) / lastMonth) * 100;

  return {
    currentMonth,
    lastMonth,
    today,
    growth: Number(growth.toFixed(1)),
  };
});

//
// top-items
//

ipcMain.handle("top-items", () => {
  return db
    .prepare(
      `
    SELECT item_name as name, SUM(quantity) as value
    FROM invoice_items
    GROUP BY item_name
    ORDER BY value DESC
    LIMIT 5
  `,
    )
    .all();
});

//
// Update
//

ipcMain.handle("update-invoice", (_, id, data) => {
  const transaction = db.transaction(() => {
    /* =========================
       1️⃣ CUSTOMER UPDATE / INSERT
    ========================= */

    let customer: any = db
      .prepare(`SELECT id, name, address, gstin FROM customers WHERE phone = ?`)
      .get(data.customer.phone);

    let customerId: number;

    const normalize = (val: any) => (val || "").toString().trim().toLowerCase();

    if (customer) {
      customerId = customer.id;

      const nameChanged =
        normalize(customer.name) !== normalize(data.customer.name);

      const addressChanged =
        normalize(customer.address) !== normalize(data.customer.address);

      const gstChanged =
        normalize(customer.gstin) !== normalize(data.customer.gstin);

      if (nameChanged || addressChanged || gstChanged) {
        db.prepare(
          `
          UPDATE customers
          SET name = ?, address = ?, gstin = ?
          WHERE id = ?
        `,
        ).run(
          data.customer.name,
          data.customer.address,
          data.customer.gstin || null,
          customerId,
        );
      }
    } else {
      const result = db
        .prepare(
          `
        INSERT INTO customers (name, phone, address, gstin)
        VALUES (?, ?, ?, ?)
      `,
        )
        .run(
          data.customer.name,
          data.customer.phone,
          data.customer.address,
          data.customer.gstin || null,
        );

      customerId = result.lastInsertRowid as number;
    }

    /* =========================
       2️⃣ CALCULATION (FIXED GST)
    ========================= */

    let subtotal = 0;
    data.items.forEach((item: any) => {
      subtotal += item.quantity * item.price;
    });

    const safeDiscount = Math.min(data.discount, subtotal);
    const taxableAmount = subtotal - safeDiscount;
    const gstAmount = (taxableAmount * data.custom_gst) / 100;
    const finalTotal = taxableAmount + gstAmount;

    const pendingAmount =
      data.status === "UNPAID"
        ? Math.max(0, finalTotal - (data.paidAmount || 0))
        : 0;

    /* =========================
       3️⃣ UPDATE INVOICE
    ========================= */

    db.prepare(
      `
      UPDATE invoices
      SET 
        customer_name = ?,
        customer_phone = ?,
        customer_address = ?,
        customer_gstin = ?,
        status = ?, 
        custom_gst = ?, 
        discount = ?, 
        total = ?, 
        pending_amount = ?, 
        date = ?,
        customer_id = ?
      WHERE id = ?
    `,
    ).run(
      data.status,
      data.custom_gst,
      safeDiscount,
      finalTotal,
      pendingAmount,
      data.date,
      customerId,
      id,
    );

    /* =========================
       4️⃣ UPDATE ITEMS
    ========================= */

    db.prepare(`DELETE FROM invoice_items WHERE invoice_id = ?`).run(id);

    const stmt = db.prepare(`
      INSERT INTO invoice_items (invoice_id, item_name, quantity, price, total)
      VALUES (?, ?, ?, ?, ?)
    `);

    data.items.forEach((item: any) => {
      stmt.run(
        id,
        item.item_name,
        item.quantity,
        item.price,
        item.quantity * item.price,
      );
    });

    /* =========================
       5️⃣ UPDATE MASTER ITEMS
    ========================= */

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
   APP START
========================= */

app.whenReady().then(() => {
  initializeDatabase();
  migrateDatabase();
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
