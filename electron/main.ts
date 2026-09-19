import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
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

  // Inventory tables
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      category TEXT,
      stock_qty REAL DEFAULT 0,
      cost_price REAL DEFAULT 0,
      sale_price REAL DEFAULT 0,
      description TEXT
    )
  `,
  ).run();

  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      movement_type TEXT NOT NULL,
      quantity REAL NOT NULL,
      reference_type TEXT,
      reference_id INTEGER,
      note TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
    )
  `,
  ).run();

  // CRM tables
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS crm_followups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      note TEXT NOT NULL,
      followup_date TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
    )
  `,
  ).run();

  // Accounting tables
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS accounting_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_type TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT,
      entry_date TEXT,
      customer_id INTEGER,
      invoice_id INTEGER,
      reference TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE SET NULL
    )
  `,
  ).run();
}

function migrateDatabase() {
  try {
    db.prepare(
      `ALTER TABLE invoices ADD COLUMN status TEXT CHECK(status IN ('PAID','UNPAID','CANCEL')) DEFAULT 'PAID'`,
    ).run();
  } catch { }

  try {
    db.prepare(
      `ALTER TABLE invoices ADD COLUMN pending_amount REAL DEFAULT 0`,
    ).run();
  } catch { }

  try {
    db.prepare(`ALTER TABLE customers ADD COLUMN gstin TEXT`).run();
  } catch { }

  try {
    db.prepare(`ALTER TABLE invoices ADD COLUMN customer_name TEXT`).run();
  } catch { }

  try {
    db.prepare(`ALTER TABLE invoices ADD COLUMN customer_phone TEXT`).run();
  } catch { }

  try {
    db.prepare(`ALTER TABLE invoices ADD COLUMN customer_address TEXT`).run();
  } catch { }

  try {
    db.prepare(`ALTER TABLE invoices ADD COLUMN customer_gstin TEXT`).run();
  } catch { }

  // Auto-recovery for any invoices that lost item details
  try {
    const recoverableFromMovements = db
      .prepare(
        `
        SELECT sm.reference_id as invoice_id, p.name as item_name, sm.quantity, p.sale_price as price
        FROM stock_movements sm
        JOIN products p ON sm.product_id = p.id
        WHERE sm.reference_type = 'invoice'
          AND sm.reference_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM invoice_items ii WHERE ii.invoice_id = sm.reference_id)
      `,
      )
      .all();

    if (recoverableFromMovements.length > 0) {
      const insertStmt = db.prepare(`
        INSERT INTO invoice_items (invoice_id, item_name, quantity, price, total)
        VALUES (?, ?, ?, ?, ?)
      `);
      recoverableFromMovements.forEach((row: any) => {
        const qty = Number(row.quantity || 1);
        const price = Number(row.price || 0);
        insertStmt.run(row.invoice_id, row.item_name, qty, price, qty * price);
      });
    }

    const emptyInvoices = db
      .prepare(
        `
        SELECT id, total, discount, custom_gst
        FROM invoices
        WHERE NOT EXISTS (SELECT 1 FROM invoice_items ii WHERE ii.invoice_id = invoices.id)
      `,
      )
      .all();

    if (emptyInvoices.length > 0) {
      const fallbackStmt = db.prepare(`
        INSERT INTO invoice_items (invoice_id, item_name, quantity, price, total)
        VALUES (?, ?, ?, ?, ?)
      `);
      emptyInvoices.forEach((inv: any) => {
        const gstRate = Number(inv.custom_gst || 0);
        const total = Number(inv.total || 0);
        const discount = Number(inv.discount || 0);
        const taxable = gstRate > 0 ? total / (1 + gstRate / 100) : total;
        const subtotal = Number((taxable + discount).toFixed(2));

        fallbackStmt.run(
          inv.id,
          "General Bill Items / Services",
          1,
          subtotal || total || 0,
          subtotal || total || 0,
        );
      });
    }
  } catch (err) {
    console.error("Auto recovery error:", err);
  }
}
function applyStockDelta(
  productName: string,
  quantityDelta: number,
  referenceType: string,
  referenceId: number | null,
  note: string,
) {
  if (!productName) return;

  const product = db
    .prepare(`SELECT id, stock_qty FROM products WHERE name = ?`)
    .get(productName);

  if (!product) return;

  const nextStock = Number(product.stock_qty) - Number(quantityDelta);
  db.prepare(`UPDATE products SET stock_qty = ? WHERE id = ?`).run(
    nextStock,
    product.id,
  );

  db.prepare(
    `
    INSERT INTO stock_movements (
      product_id, movement_type, quantity, reference_type, reference_id, note, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `,
  ).run(
    product.id,
    quantityDelta > 0 ? "sale" : "stock_return",
    Math.abs(Number(quantityDelta)),
    referenceType,
    referenceId,
    note,
  );
}

function createAccountingEntry(
  entryType: string,
  amount: number,
  description: string,
  entryDate: string,
  customerId: number | null,
  invoiceId: number | null,
  reference: string,
) {
  db.prepare(
    `
    INSERT INTO accounting_entries (
      entry_type, amount, description, entry_date, customer_id, invoice_id, reference, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `,
  ).run(entryType, amount, description, entryDate, customerId, invoiceId, reference);
}

/* =========================
   APPLY EXISTING CUSTOMER ADVANCE TO AN INVOICE
   When a new bill is created as UNPAID/pending, any advance the
   customer already had (payment entries not linked to an invoice)
   is automatically adjusted against the new pending amount.
   Returns the remaining (net) pending amount.
========================= */

function applyAdvanceToInvoice(
  customerId: number | null,
  invoiceId: number,
  pending: number,
): number {
  let remaining = Number((Number(pending) || 0).toFixed(2));

  if (!customerId || remaining <= 0) return Math.max(0, remaining);

  const advanceEntries = db
    .prepare(
      `
      SELECT id, amount
      FROM accounting_entries
      WHERE customer_id = ? AND entry_type = 'payment' AND invoice_id IS NULL
      ORDER BY entry_date ASC, id ASC
    `,
    )
    .all(customerId) as { id: number; amount: number }[];

  for (const adv of advanceEntries) {
    if (remaining <= 0) break;

    const available = Number(adv.amount || 0);
    if (available <= 0) continue;

    const applied = Math.min(remaining, available);

    if (applied >= available - 0.001) {
      // Whole advance consumed -> link it to this invoice
      db.prepare(
        `UPDATE accounting_entries SET invoice_id = ? WHERE id = ?`,
      ).run(invoiceId, adv.id);
    } else {
      // Partial consumption -> shrink the advance row and carve out a linked payment
      db.prepare(`UPDATE accounting_entries SET amount = ? WHERE id = ?`).run(
        Number((available - applied).toFixed(2)),
        adv.id,
      );
      db.prepare(
        `INSERT INTO accounting_entries (entry_type, amount, description, entry_date, customer_id, invoice_id, reference, created_at)
         VALUES ('payment', ?, ?, date('now'), ?, ?, ?, datetime('now'))`,
      ).run(
        Number(applied.toFixed(2)),
        `Adjusted against invoice`,
        customerId,
        invoiceId,
        `Advance adjusted for invoice ${invoiceId}`,
      );
    }

    remaining = Number((remaining - applied).toFixed(2));
  }

  return Math.max(0, Number(remaining.toFixed(2)));
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

ipcMain.handle("get-products", () => {
  return db
    .prepare(
      `
      SELECT *
      FROM products
      ORDER BY name ASC
    `,
    )
    .all();
});

ipcMain.handle("add-product", (_, data) => {
  const result = db
    .prepare(
      `
      INSERT INTO products (name, category, stock_qty, cost_price, sale_price, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    )
    .run(
      data.name,
      data.category || null,
      Number(data.stock_qty || 0),
      Number(data.cost_price || 0),
      Number(data.sale_price || 0),
      data.description || null,
    );

  return result.lastInsertRowid;
});

ipcMain.handle("update-product", (_, id, data) => {
  db.prepare(
    `
    UPDATE products
    SET name = ?, category = ?, stock_qty = ?, cost_price = ?, sale_price = ?, description = ?
    WHERE id = ?
  `,
  ).run(
    data.name,
    data.category || null,
    Number(data.stock_qty || 0),
    Number(data.cost_price || 0),
    Number(data.sale_price || 0),
    data.description || null,
    id,
  );
  return true;
});

ipcMain.handle("delete-product", (_, id) => {
  db.prepare(`DELETE FROM products WHERE id = ?`).run(id);
  return true;
});

ipcMain.handle("get-stock-movements", (_, productId) => {
  return db
    .prepare(
      `
      SELECT *
      FROM stock_movements
      WHERE product_id = ?
      ORDER BY id DESC
    `,
    )
    .all(productId);
});

ipcMain.handle("get-crm-followups", (_, customerId) => {
  return db
    .prepare(
      `
      SELECT *
      FROM crm_followups
      WHERE customer_id = ?
      ORDER BY followup_date ASC, id DESC
    `,
    )
    .all(customerId);
});

ipcMain.handle("add-crm-followup", (_, customerId, note, followupDate) => {
  db.prepare(
    `
    INSERT INTO crm_followups (customer_id, note, followup_date, created_at)
    VALUES (?, ?, ?, datetime('now'))
  `,
  ).run(customerId, note, followupDate || null);
  return true;
});

ipcMain.handle("get-accounting-entries", () => {
  return db
    .prepare(
      `
      SELECT 
        accounting_entries.*,
        customers.name as customer_name,
        customers.phone as customer_phone
      FROM accounting_entries
      LEFT JOIN customers ON accounting_entries.customer_id = customers.id
      ORDER BY accounting_entries.entry_date DESC, accounting_entries.id DESC
    `,
    )
    .all();
});

ipcMain.handle("add-accounting-entry", (_, data) => {
  const amount = Number(data.amount || 0);
  if (amount <= 0) throw new Error("Amount must be greater than zero");

  const transaction = db.transaction(() => {
    if (data.entry_type === "payment") {
      if (!data.customer_id) throw new Error("Customer is required for a payment");

      let remaining = amount;
      const invoices = db.prepare(`
        SELECT id, pending_amount
        FROM invoices
        WHERE customer_id = ? AND status != 'CANCEL' AND pending_amount > 0
        ORDER BY date ASC, id ASC
      `).all(data.customer_id) as { id: number; pending_amount: number }[];

      for (const invoice of invoices) {
        if (remaining <= 0) break;
        const applied = Math.min(remaining, Number(invoice.pending_amount));
        db.prepare(`UPDATE invoices SET pending_amount = MAX(0, pending_amount - ?) WHERE id = ?`).run(applied, invoice.id);
        db.prepare(`
          INSERT INTO accounting_entries (entry_type, amount, description, entry_date, customer_id, invoice_id, reference, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `).run(
          "payment",
          applied,
          data.description || "Customer payment received",
          data.entry_date || new Date().toISOString().slice(0, 10),
          data.customer_id,
          invoice.id,
          data.reference || `Payment for invoice ${invoice.id}`,
        );
        remaining -= applied;
      }

      if (remaining > 0) {
        db.prepare(`
          INSERT INTO accounting_entries (entry_type, amount, description, entry_date, customer_id, invoice_id, reference, created_at)
          VALUES (?, ?, ?, ?, ?, NULL, ?, datetime('now'))
        `).run(
          "payment",
          remaining,
          data.description || "Customer advance received",
          data.entry_date || new Date().toISOString().slice(0, 10),
          data.customer_id,
          data.reference || "Customer advance",
        );
      }
      return true;
    }

    db.prepare(
      `INSERT INTO accounting_entries (entry_type, amount, description, entry_date, customer_id, invoice_id, reference, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    ).run(
      data.entry_type,
      amount,
      data.description || null,
      data.entry_date || new Date().toISOString().slice(0, 10),
      data.customer_id || null,
      data.invoice_id || null,
      data.reference || null,
    );
    return true;
  });

  return transaction();
});

ipcMain.handle("update-accounting-entry", (_, id: number, data: any) => {
  const amount = Number(data.amount || 0);
  if (amount <= 0) throw new Error("Amount must be greater than zero");

  const transaction = db.transaction(() => {
    const existing = db
      .prepare(`SELECT * FROM accounting_entries WHERE id = ?`)
      .get(id) as any;

    if (!existing) throw new Error("Accounting entry not found");

    const newType = data.entry_type || existing.entry_type;

    /* =========================
       PAYMENT ROWS drive invoice pending + advance.
       Editing one must rebuild the allocation (same FIFO logic as creation)
       so any surplus beyond pending dues correctly becomes customer advance.
    ========================= */
    if (existing.entry_type === "payment" || newType === "payment") {
      // 1️⃣ Revert this row's original effect on the invoice it reduced
      if (existing.entry_type === "payment" && existing.invoice_id) {
        db.prepare(
          `UPDATE invoices SET pending_amount = MIN(total, pending_amount + ?) WHERE id = ?`,
        ).run(Number(existing.amount || 0), existing.invoice_id);
      }

      // 2️⃣ Remove the old row (it will be re-created from the allocation below)
      db.prepare(`DELETE FROM accounting_entries WHERE id = ?`).run(id);

      // 3️⃣ Re-apply the new amount
      if (newType === "payment") {
        const customerId = data.customer_id || existing.customer_id;
        if (!customerId) throw new Error("Customer is required for a payment");

        let remaining = amount;
        const invoices = db
          .prepare(
            `SELECT id, pending_amount FROM invoices
             WHERE customer_id = ? AND status != 'CANCEL' AND pending_amount > 0
             ORDER BY date ASC, id ASC`,
          )
          .all(customerId) as { id: number; pending_amount: number }[];

        for (const invoice of invoices) {
          if (remaining <= 0) break;
          const applied = Math.min(remaining, Number(invoice.pending_amount));
          if (applied <= 0) continue;
          db.prepare(
            `UPDATE invoices SET pending_amount = MAX(0, pending_amount - ?) WHERE id = ?`,
          ).run(applied, invoice.id);
          db.prepare(
            `INSERT INTO accounting_entries (entry_type, amount, description, entry_date, customer_id, invoice_id, reference, created_at)
             VALUES ('payment', ?, ?, ?, ?, ?, ?, datetime('now'))`,
          ).run(
            applied,
            data.description || "Customer payment received",
            data.entry_date || existing.entry_date,
            customerId,
            invoice.id,
            data.reference || `Payment for invoice ${invoice.id}`,
          );
          remaining = Number((remaining - applied).toFixed(2));
        }

        if (remaining > 0) {
          db.prepare(
            `INSERT INTO accounting_entries (entry_type, amount, description, entry_date, customer_id, invoice_id, reference, created_at)
             VALUES ('payment', ?, ?, ?, ?, NULL, ?, datetime('now'))`,
          ).run(
            remaining,
            data.description || "Customer advance received",
            data.entry_date || existing.entry_date,
            customerId,
            data.reference || "Customer advance",
          );
        }
      } else {
        // Converted from a payment to a normal income/expense entry
        db.prepare(
          `INSERT INTO accounting_entries (entry_type, amount, description, entry_date, customer_id, invoice_id, reference, created_at)
           VALUES (?, ?, ?, ?, ?, NULL, ?, datetime('now'))`,
        ).run(
          newType,
          amount,
          data.description || null,
          data.entry_date || existing.entry_date,
          data.customer_id || existing.customer_id || null,
          data.reference || null,
        );
      }

      return true;
    }

    /* =========================
       NON-PAYMENT rows: simple in-place update
    ========================= */
    db.prepare(
      `
      UPDATE accounting_entries
      SET 
        entry_type = ?,
        amount = ?,
        description = ?,
        entry_date = ?,
        customer_id = ?,
        reference = ?
      WHERE id = ?
    `,
    ).run(
      newType,
      amount,
      data.description || null,
      data.entry_date || existing.entry_date,
      data.customer_id || existing.customer_id || null,
      data.reference || null,
      id,
    );

    return true;
  });

  return transaction();
});

ipcMain.handle("delete-accounting-entry", (_, id: number) => {
  const transaction = db.transaction(() => {
    const existing = db
      .prepare(`SELECT * FROM accounting_entries WHERE id = ?`)
      .get(id) as any;

    if (!existing) return true;

    if (existing.entry_type === "payment" && existing.invoice_id) {
      db.prepare(
        `UPDATE invoices SET pending_amount = MIN(total, pending_amount + ?) WHERE id = ?`,
      ).run(Number(existing.amount || 0), existing.invoice_id);
    }

    db.prepare(`DELETE FROM accounting_entries WHERE id = ?`).run(id);
    return true;
  });

  return transaction();
});

ipcMain.handle("get-accounting-summary", () => {
  const income = db
    .prepare(`SELECT COALESCE(SUM(amount),0) as total FROM accounting_entries WHERE entry_type = 'income'`)
    .get() as { total: number };
  const payments = db
    .prepare(`SELECT COALESCE(SUM(amount),0) as total FROM accounting_entries WHERE entry_type = 'payment'`)
    .get() as { total: number };
  const expense = db
    .prepare(`SELECT COALESCE(SUM(amount),0) as total FROM accounting_entries WHERE entry_type = 'expense'`)
    .get() as { total: number };
  const receivable = db
    .prepare(`SELECT COALESCE(SUM(pending_amount),0) as total FROM invoices WHERE status != 'CANCEL'`)
    .get() as { total: number };

  return {
    income: Number(income.total || 0) + Number(payments.total || 0),
    payments: Number(payments.total || 0),
    expense: Number(expense.total || 0),
    receivable: Number(receivable.total || 0),
    balance: Number(income.total || 0) + Number(payments.total || 0) - Number(expense.total || 0),
  };
});

function syncInvoiceInventory(invoiceId: number, items: any[]) {
  const previousMovements = db
    .prepare(
      `SELECT product_id, quantity FROM stock_movements WHERE reference_type = 'invoice' AND reference_id = ?`,
    )
    .all(invoiceId);

  previousMovements.forEach((movement: any) => {
    if (movement.product_id) {
      const qty = Number(movement.quantity || 0);
      db.prepare(`UPDATE products SET stock_qty = stock_qty + ? WHERE id = ?`).run(
        qty,
        movement.product_id,
      );
    }
  });

  db.prepare(
    `DELETE FROM stock_movements WHERE reference_type = 'invoice' AND reference_id = ?`,
  ).run(invoiceId);

  items.forEach((item: any) => {
    const product = db
      .prepare(`SELECT id FROM products WHERE name = ?`)
      .get(item.item_name);

    if (product) {
      const qty = Number(item.quantity || 0);
      db.prepare(`UPDATE products SET stock_qty = stock_qty - ? WHERE id = ?`).run(
        qty,
        (product as any).id,
      );
      db.prepare(
        `
        INSERT INTO stock_movements (product_id, movement_type, quantity, reference_type, reference_id, note, created_at)
        VALUES (?, 'sale', ?, 'invoice', ?, ?, datetime('now'))
      `,
      ).run((product as any).id, qty, invoiceId, `Invoice ${invoiceId}`);
    }
  });
}

function syncInvoiceAccounting(
  invoiceId: number,
  total: number,
  pendingAmount: number,
  paidAmount: number,
  description: string,
  customerId: number | null,
) {
  db.prepare(`DELETE FROM accounting_entries WHERE invoice_id = ? AND entry_type IN ('income', 'receivable')`).run(invoiceId);

  const actualPaid = Number(paidAmount || 0);
  const actualPending = Number(pendingAmount || 0);

  if (actualPaid > 0) {
    db.prepare(
      `
      INSERT INTO accounting_entries (entry_type, amount, description, entry_date, customer_id, invoice_id, reference, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `,
    ).run(
      "income",
      actualPaid,
      `${description} - received payment`,
      new Date().toISOString().slice(0, 10),
      customerId,
      invoiceId,
      `Invoice ${invoiceId}`,
    );
  }

  if (actualPending > 0) {
    db.prepare(
      `
      INSERT INTO accounting_entries (entry_type, amount, description, entry_date, customer_id, invoice_id, reference, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `,
    ).run(
      "receivable",
      actualPending,
      `${description} - pending amount`,
      new Date().toISOString().slice(0, 10),
      customerId,
      invoiceId,
      `Receivable ${invoiceId}`,
    );
  }
}

/* =========================
   SAVE INVOICE
========================= */

ipcMain.handle("save-invoice", (_, data) => {
  const transaction = db.transaction(() => {
    if (!Array.isArray(data.items) || data.items.length === 0 || data.items.length > 15) {
      throw new Error("An invoice must contain between 1 and 15 items");
    }

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
      const quantity = Math.max(0, Number(item.quantity) || 0);
      const price = Math.max(0, Number(item.price) || 0);
      subtotal += quantity * price;
    });

    const discount = Math.min(Math.max(0, Number(data.discount) || 0), subtotal);
    const taxableAmount = subtotal - discount;
    const gstAmount = (taxableAmount * Math.max(0, Number(data.custom_gst) || 0)) / 100;
    const finalTotal = Number((taxableAmount + gstAmount).toFixed(2));
    const invoiceStatus = data.status || "PAID";
    const paidAmount = invoiceStatus === "PAID"
      ? finalTotal
      : Math.min(Math.max(0, Number(data.paidAmount) || 0), finalTotal);
    const pendingAmount = invoiceStatus === "UNPAID"
      ? Number((finalTotal - paidAmount).toFixed(2))
      : 0;

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
        invoiceStatus,
        pendingAmount,
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
        discount,
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

    syncInvoiceInventory(invoiceId, data.items);

    // Adjust any pre-existing customer advance against the new pending amount
    let effectivePending = pendingAmount;
    if (invoiceStatus !== "CANCEL" && pendingAmount > 0) {
      effectivePending = applyAdvanceToInvoice(
        customerId,
        invoiceId,
        pendingAmount,
      );
      db.prepare(`UPDATE invoices SET pending_amount = ? WHERE id = ?`).run(
        effectivePending,
        invoiceId,
      );
    }

    syncInvoiceAccounting(
      invoiceId,
      finalTotal,
      effectivePending,
      paidAmount,
      `Invoice ${data.invoice_number}`,
      customerId,
    );

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

  if (invoice) {
    (invoice as any).paid_amount = Math.max(0, Number((invoice as any).total || 0) - Number((invoice as any).pending_amount || 0));
  }

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

ipcMain.handle("open-external", (_, url: string) => {
  if (!url) return false;
  shell.openExternal(url);
  return true;
});

ipcMain.handle("save-invoice-pdf", async (_, invoiceNumber: string) => {
  if (!mainWindow) return false;

  const { filePath } = await dialog.showSaveDialog({
    defaultPath: `${invoiceNumber || "Invoice"}.pdf`,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });

  if (!filePath) return false;

  const pdfData = await mainWindow.webContents.printToPDF({
    printBackground: true,
    pageSize: { width: 210000, height: 297000 },
  });

  fs.writeFileSync(filePath, pdfData);
  return true;
});

ipcMain.handle("export-pending-invoices", async () => {
  const rows = db
    .prepare(
      `
      SELECT
        invoices.invoice_number,
        invoices.date,
        invoices.status,
        invoices.total,
        invoices.pending_amount,
        COALESCE(invoices.customer_name, customers.name) as customer_name,
        COALESCE(invoices.customer_phone, customers.phone) as customer_phone,
        COALESCE(invoices.customer_address, customers.address) as customer_address
      FROM invoices
      LEFT JOIN customers ON invoices.customer_id = customers.id
      WHERE invoices.pending_amount > 0 AND invoices.status != 'CANCEL'
      ORDER BY invoices.pending_amount DESC
    `,
    )
    .all();

  if (!rows.length) {
    dialog.showMessageBox({
      type: "info",
      message: "No pending invoices found to export",
    });
    return false;
  }

  const { filePath } = await dialog.showSaveDialog({
    defaultPath: "PendingInvoices.xlsx",
    filters: [{ name: "Excel", extensions: ["xlsx"] }],
  });

  if (!filePath) return false;

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Pending Invoices");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  fs.writeFileSync(filePath, buffer);

  return true;
});

/* =========================
   DELETE INVOICE
========================= */

ipcMain.handle("delete-invoice", (_, invoiceId: number) => {
  const transaction = db.transaction(() => {
    const previousMovements = db
      .prepare(
        `SELECT product_id, quantity FROM stock_movements WHERE reference_type = 'invoice' AND reference_id = ?`,
      )
      .all(invoiceId);

    previousMovements.forEach((movement: any) => {
      if (movement.product_id) {
        const qty = Number(movement.quantity || 0);
        db.prepare(
          `UPDATE products SET stock_qty = stock_qty + ? WHERE id = ?`,
        ).run(qty, movement.product_id);
      }
    });

    db.prepare(
      `DELETE FROM stock_movements WHERE reference_type = 'invoice' AND reference_id = ?`,
    ).run(invoiceId);
    db.prepare(`DELETE FROM accounting_entries WHERE invoice_id = ?`).run(
      invoiceId,
    );
    db.prepare(`DELETE FROM invoices WHERE id = ?`).run(invoiceId);
  });
  transaction();
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

  const accounting = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN entry_type IN ('income', 'payment') THEN amount ELSE 0 END), 0) as income,
      COALESCE(SUM(CASE WHEN entry_type = 'payment' THEN amount ELSE 0 END), 0) as payments,
      COALESCE(SUM(CASE WHEN entry_type = 'expense' THEN amount ELSE 0 END), 0) as expense
    FROM accounting_entries
  `).get() as { income: number; payments: number; expense: number };

  return { totalRevenue, totalCustomers, totalInvoices, pending, ...accounting };
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

  // Client payments
  const payments = db
    .prepare(
      `
      SELECT 
        accounting_entries.*,
        invoices.invoice_number
      FROM accounting_entries
      LEFT JOIN invoices ON accounting_entries.invoice_id = invoices.id
      WHERE accounting_entries.customer_id = ?
      ORDER BY accounting_entries.entry_date DESC, accounting_entries.id DESC
    `,
    )
    .all(customerId);

  const advanceTotal = db
    .prepare(
      `
      SELECT COALESCE(SUM(amount), 0) as total
      FROM accounting_entries
      WHERE customer_id = ? AND entry_type = 'payment' AND invoice_id IS NULL
    `,
    )
    .get(customerId) as any;

  const safeSummary = {
    totalSpend: Number((summary as any)?.totalSpend || 0),
    pending: Number((summary as any)?.pending || 0),
    advance: Number(advanceTotal?.total || 0),
  };

  return {
    customer,
    summary: safeSummary,
    invoices,
    payments,
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
    if (!Array.isArray(data.items) || data.items.length === 0 || data.items.length > 15) {
      throw new Error("An invoice must contain between 1 and 15 items");
    }

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

    const safeDiscount = Math.min(Math.max(0, Number(data.discount) || 0), subtotal);
    const taxableAmount = subtotal - safeDiscount;
    const gstAmount = (taxableAmount * Math.max(0, Number(data.custom_gst) || 0)) / 100;
    const finalTotal = Number((taxableAmount + gstAmount).toFixed(2));

    const pendingAmount =
      data.status === "UNPAID"
        ? Math.max(0, finalTotal - Number(data.paidAmount || 0))
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
      data.customer.name,
      data.customer.phone,
      data.customer.address,
      data.customer.gstin || null,
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

    syncInvoiceInventory(id, data.items);
    syncInvoiceAccounting(
      id,
      finalTotal,
      pendingAmount,
      data.status === "PAID" ? (data.paidAmount || finalTotal) : (data.paidAmount || 0),
      `Invoice ${data.invoice_number || id}`,
      customerId,
    );

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

    return id;
  });

  return transaction();
});

/* =========================
   DATABASE AUTO-BACKUP SYSTEM (IST 1PM - 3PM)
========================= */

function getISTDateInfo() {
  const now = new Date();
  const istString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const istDate = new Date(istString);
  const year = istDate.getFullYear();
  const month = String(istDate.getMonth() + 1).padStart(2, "0");
  const day = String(istDate.getDate()).padStart(2, "0");
  const hours = istDate.getHours();
  const minutes = istDate.getMinutes();
  return {
    dateStr: `${year}-${month}-${day}`,
    hours,
    minutes,
    fullDate: istDate,
  };
}

async function performDatabaseBackup(customLabel?: string) {
  try {
    if (!db) return null;

    const backupDir = path.join(app.getPath("userData"), "backups");
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const { dateStr } = getISTDateInfo();
    const label = customLabel ? `_${customLabel}` : "";
    const backupFileName = `emitra_backup_${dateStr}${label}.db`;
    const backupFilePath = path.join(backupDir, backupFileName);

    await db.backup(backupFilePath);
    console.log(`[Backup] SQLite database backup created successfully: ${backupFilePath}`);

    cleanupOldBackups(backupDir, 30);
    return backupFilePath;
  } catch (err) {
    console.error("[Backup Error]: Failed to create database backup", err);
    return null;
  }
}

function cleanupOldBackups(backupDir: string, maxBackups = 30) {
  try {
    const files = fs
      .readdirSync(backupDir)
      .filter((file) => file.startsWith("emitra_backup_") && file.endsWith(".db"))
      .map((file) => ({
        name: file,
        path: path.join(backupDir, file),
        time: fs.statSync(path.join(backupDir, file)).mtimeMs,
      }))
      .sort((a, b) => b.time - a.time);

    if (files.length > maxBackups) {
      const toDelete = files.slice(maxBackups);
      for (const item of toDelete) {
        fs.unlinkSync(item.path);
        console.log(`[Backup] Removed old backup: ${item.name}`);
      }
    }
  } catch (e) {
    console.error("[Backup Cleanup Error]:", e);
  }
}

function checkAndRunDailyBackup() {
  const { dateStr, hours } = getISTDateInfo();
  const backupDir = path.join(app.getPath("userData"), "backups");
  const todayBackupPath = path.join(backupDir, `emitra_backup_${dateStr}.db`);

  // Target window: 1:00 PM to 7:00 PM IST (13:00 to 19:00)
  const isInTimeWindow = hours >= 13 && hours < 19;

  if (isInTimeWindow && !fs.existsSync(todayBackupPath)) {
    console.log(`[Backup] Triggering scheduled 1PM-3PM IST backup for ${dateStr}...`);
    performDatabaseBackup();
  }
}

function startAutoBackupScheduler() {
  // Check once immediately after startup
  checkAndRunDailyBackup();

  // Run periodic check every 2 hours
  setInterval(() => {
    checkAndRunDailyBackup();
  }, 2 * 60 * 60 * 1000);
}

ipcMain.handle("create-manual-backup", async () => {
  const now = new Date();
  const timeStr = `${now.getHours()}_${now.getMinutes()}_${now.getSeconds()}`;
  const filePath = await performDatabaseBackup(`manual_${timeStr}`);
  return { success: !!filePath, filePath };
});

ipcMain.handle("export-database-backup", async () => {
  if (!db || !mainWindow) return false;

  const { dateStr } = getISTDateInfo();
  const { filePath } = await dialog.showSaveDialog({
    title: "Save Complete Database Backup",
    defaultPath: `emitra_backup_${dateStr}.db`,
    filters: [{ name: "SQLite Database", extensions: ["db", "sqlite"] }],
  });

  if (!filePath) return false;

  await db.backup(filePath);
  return true;
});

ipcMain.handle("get-backups-info", () => {
  try {
    const backupDir = path.join(app.getPath("userData"), "backups");
    if (!fs.existsSync(backupDir)) {
      return { backupDir, backups: [] };
    }

    const files = fs
      .readdirSync(backupDir)
      .filter((f) => f.endsWith(".db"))
      .map((f) => {
        const fullPath = path.join(backupDir, f);
        const stat = fs.statSync(fullPath);
        return {
          name: f,
          path: fullPath,
          size: stat.size,
          createdAt: stat.mtime,
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return { backupDir, backups: files };
  } catch (err) {
    return { backupDir: "", backups: [] };
  }
});

/* =========================
   APP START
========================= */

app.whenReady().then(() => {
  initializeDatabase();
  migrateDatabase();
  startAutoBackupScheduler();
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
