import { useEffect, useState } from "react";
import {
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import PaymentIcon from "@mui/icons-material/Payment";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";

type Entry = {
  id: number;
  entry_type: string;
  amount: number;
  description: string | null;
  entry_date: string | null;
  reference: string | null;
  customer_id?: number | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  invoice_id?: number | null;
};

type Summary = {
  income: number;
  payments?: number;
  expense: number;
  receivable: number;
  balance: number;
};

export default function AccountingPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [customers, setCustomers] = useState<
    { id: number; name: string; phone: string | null }[]
  >([]);
  const [summary, setSummary] = useState<Summary>({
    income: 0,
    expense: 0,
    receivable: 0,
    balance: 0,
  });

  const [form, setForm] = useState({
    entry_type: "expense",
    amount: "",
    description: "",
    entry_date: new Date().toISOString().slice(0, 10),
    customer_id: "",
  });

  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

  // Edit / Delete State
  const [editEntry, setEditEntry] = useState<any | null>(null);
  const [deleteEntryId, setDeleteEntryId] = useState<number | null>(null);

  const customerLabel = (c: { name: string; phone: string | null } | null) =>
    c ? `${c.name}${c.phone ? ` (${c.phone})` : ""}` : "";

  const findCustomer = (id: any) =>
    customers.find((c) => String(c.id) === String(id)) || null;

  const getEntryMeta = (entry: Entry) => {
    switch (entry.entry_type) {
      case "payment":
        return { label: "Client Payment", color: "success" as const };
      case "income":
        return {
          label: entry.invoice_id ? "Invoice Payment" : "Income",
          color: "success" as const,
        };
      case "receivable":
        return { label: "Receivable", color: "warning" as const };
      case "expense":
        return { label: "Expense", color: "error" as const };
      default:
        return { label: entry.entry_type, color: "default" as const };
    }
  };

  const loadData = async () => {
    const [entryRes, summaryRes, customerRes] = await Promise.all([
      window.electron.invoke("get-accounting-entries"),
      window.electron.invoke("get-accounting-summary"),
      window.electron.invoke("get-customers", 1, 1000, ""),
    ]);
    setEntries(entryRes || []);
    setSummary(
      summaryRes || { income: 0, expense: 0, receivable: 0, balance: 0 },
    );
    setCustomers(customerRes?.data || []);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) return;
    if (form.entry_type === "payment" && !form.customer_id) return;

    await window.electron.invoke("add-accounting-entry", {
      ...form,
      amount: Number(form.amount),
      entry_date: form.entry_date || new Date().toISOString().slice(0, 10),
    });

    setForm({
      entry_type: "expense",
      amount: "",
      description: "",
      entry_date: new Date().toISOString().slice(0, 10),
      customer_id: "",
    });

    await loadData();
  };

  const handleUpdateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editEntry || !editEntry.amount || Number(editEntry.amount) <= 0)
      return;

    await window.electron.invoke("update-accounting-entry", editEntry.id, {
      entry_type: editEntry.entry_type,
      amount: Number(editEntry.amount),
      description: editEntry.description,
      entry_date: editEntry.entry_date,
      customer_id: editEntry.customer_id ? Number(editEntry.customer_id) : null,
      reference: editEntry.reference,
    });

    setEditEntry(null);
    await loadData();
  };

  const handleDeleteEntry = async () => {
    if (!deleteEntryId) return;
    await window.electron.invoke("delete-accounting-entry", deleteEntryId);
    setDeleteEntryId(null);
    await loadData();
  };

  const filteredEntries = entries.filter((entry) => {
    const matchesType = filterType === "all" || entry.entry_type === filterType;
    const searchLower = search.toLowerCase().trim();
    const matchesSearch =
      !searchLower ||
      (entry.description || "").toLowerCase().includes(searchLower) ||
      (entry.reference || "").toLowerCase().includes(searchLower) ||
      (entry.customer_name || "").toLowerCase().includes(searchLower) ||
      String(entry.amount || "").includes(searchLower);

    return matchesType && matchesSearch;
  });

  return (
    <Stack spacing={3} p={4}>
      {/* Page Header */}
      <Box>
        <Typography variant="h4" fontWeight="bold">
          Accounting & Cash Flow
        </Typography>
        <Typography color="text.secondary">
          Track revenue, client payments, daily expenses and customer
          receivables.
        </Typography>
      </Box>

      {/* 📊 SUMMARY CARDS */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        flexWrap="wrap"
      >
        <Card sx={{ flex: 1, minWidth: 200, borderRadius: 2 }}>
          <CardContent sx={{ py: 2.5 }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <ArrowUpwardIcon color="success" />
              <Typography color="text.secondary" variant="body2">
                Total Revenue / Income
              </Typography>
            </Stack>
            <Typography variant="h5" fontWeight="bold" mt={1}>
              ₹
              {Number(summary.income || 0).toLocaleString("en-IN", {
                minimumFractionDigits: 2,
              })}
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1, minWidth: 200, borderRadius: 2 }}>
          <CardContent sx={{ py: 2.5 }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <PaymentIcon color="primary" />
              <Typography color="text.secondary" variant="body2">
                Client Payments Received
              </Typography>
            </Stack>
            <Typography
              variant="h5"
              fontWeight="bold"
              color="primary.main"
              mt={1}
            >
              ₹
              {Number(summary.payments || 0).toLocaleString("en-IN", {
                minimumFractionDigits: 2,
              })}
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1, minWidth: 200, borderRadius: 2 }}>
          <CardContent sx={{ py: 2.5 }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <ArrowDownwardIcon color="error" />
              <Typography color="text.secondary" variant="body2">
                Total Expenses
              </Typography>
            </Stack>
            <Typography
              variant="h5"
              fontWeight="bold"
              color="error.main"
              mt={1}
            >
              ₹
              {Number(summary.expense || 0).toLocaleString("en-IN", {
                minimumFractionDigits: 2,
              })}
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1, minWidth: 200, borderRadius: 2 }}>
          <CardContent sx={{ py: 2.5 }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <HourglassEmptyIcon color="warning" />
              <Typography color="text.secondary" variant="body2">
                Receivable Dues
              </Typography>
            </Stack>
            <Typography
              variant="h5"
              fontWeight="bold"
              color="warning.main"
              mt={1}
            >
              ₹
              {Number(summary.receivable || 0).toLocaleString("en-IN", {
                minimumFractionDigits: 2,
              })}
            </Typography>
          </CardContent>
        </Card>

        <Card
          sx={{
            flex: 1,
            minWidth: 200,
            borderRadius: 2,
            background:
              "linear-gradient(135deg, rgba(99,102,241,0.1), rgba(6,182,212,0.1))",
            border: "1px solid rgba(99,102,241,0.2)",
          }}
        >
          <CardContent sx={{ py: 2.5 }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <AccountBalanceWalletIcon color="primary" />
              <Typography color="text.secondary" variant="body2">
                Net Cash Balance
              </Typography>
            </Stack>
            <Typography
              variant="h5"
              fontWeight="bold"
              color={summary.balance >= 0 ? "success.main" : "error.main"}
              mt={1}
            >
              ₹
              {Number(summary.balance || 0).toLocaleString("en-IN", {
                minimumFractionDigits: 2,
              })}
            </Typography>
          </CardContent>
        </Card>
      </Stack>

      {/* ✍️ QUICK ENTRY FORM */}
      <Card sx={{ borderRadius: 2 }}>
        <CardContent>
          <Typography variant="h6" fontWeight="bold" mb={2}>
            Quick New Entry
          </Typography>
          <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "1fr 1fr",
                md:
                  form.entry_type === "payment"
                    ? "1fr 1.5fr 1fr 1.5fr 1fr auto"
                    : "1fr 1fr 1.5fr 1fr auto",
              },
              gap: 2,
              alignItems: "center",
            }}
          >
            <TextField
              select
              size="small"
              label="Entry Type"
              value={form.entry_type}
              onChange={(e) => setForm({ ...form, entry_type: e.target.value })}
            >
              <MenuItem value="expense">Expense</MenuItem>
              <MenuItem value="income">General Income</MenuItem>
              <MenuItem value="payment">Client Payment (Khata)</MenuItem>
            </TextField>

            {form.entry_type === "payment" && (
              <Autocomplete
                size="small"
                options={customers}
                value={findCustomer(form.customer_id)}
                onChange={(_, option) =>
                  setForm({
                    ...form,
                    customer_id: option ? String(option.id) : "",
                  })
                }
                getOptionLabel={customerLabel}
                isOptionEqualToValue={(option, value) =>
                  option.id === value?.id
                }
                sx={{ minWidth: 220 }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Customer *"
                    placeholder="Search customer..."
                  />
                )}
              />
            )}

            <TextField
              size="small"
              label="Amount (₹) *"
              type="number"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              required
            />

            <TextField
              size="small"
              label="Description / Purpose"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="e.g. Shop electricity / Customer payment"
            />

            <TextField
              size="small"
              label="Date"
              type="date"
              value={form.entry_date}
              onChange={(e) => setForm({ ...form, entry_date: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />

            <Button
              type="submit"
              variant="contained"
              color="primary"
              startIcon={<AddCircleIcon />}
              sx={{ height: 40, textTransform: "none", fontWeight: "bold" }}
            >
              Save Entry
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* 📖 ACCOUNTING LEDGER TABLE */}
      <Card sx={{ borderRadius: 2 }}>
        <CardContent>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", sm: "center" }}
            spacing={2}
            mb={2.5}
          >
            <Typography variant="h6" fontWeight="bold">
              Accounting Ledger ({filteredEntries.length})
            </Typography>

            {/* Filter and Search */}
            <Stack direction="row" spacing={1.5}>
              <TextField
                select
                size="small"
                label="Filter Type"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                sx={{ minWidth: 150 }}
              >
                <MenuItem value="all">All Entries</MenuItem>
                <MenuItem value="payment">Client Payments</MenuItem>
                <MenuItem value="income">General Income</MenuItem>
                <MenuItem value="expense">Expenses</MenuItem>
              </TextField>

              <TextField
                size="small"
                label="Search Ledger"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search note, customer..."
              />
            </Stack>
          </Stack>

          <TableContainer
            component={Paper}
            variant="outlined"
            sx={{ borderRadius: 2 }}
          >
            <Table size="small">
              <TableHead sx={{ backgroundColor: "#f8fafc" }}>
                <TableRow>
                  <TableCell>
                    <b>Date</b>
                  </TableCell>
                  <TableCell>
                    <b>Type</b>
                  </TableCell>
                  <TableCell>
                    <b>Client / Customer</b>
                  </TableCell>
                  <TableCell>
                    <b>Amount (₹)</b>
                  </TableCell>
                  <TableCell>
                    <b>Description</b>
                  </TableCell>
                  <TableCell>
                    <b>Reference / Link</b>
                  </TableCell>
                  <TableCell align="center">
                    <b>Actions</b>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                      <Typography color="text.secondary">
                        No accounting records found.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEntries.map((entry) => {
                    const meta = getEntryMeta(entry);
                    // Rows auto-created from an invoice must be edited from the
                    // invoice screen, not here. Client payments stay editable.
                    const invoiceManaged =
                      !!entry.invoice_id &&
                      (entry.entry_type === "income" ||
                        entry.entry_type === "receivable");
                    return (
                      <TableRow key={entry.id} hover>
                        <TableCell>{entry.entry_date || "-"}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={meta.label}
                            color={meta.color}
                            variant="outlined"
                            sx={{ fontWeight: "bold", fontSize: 11 }}
                          />
                        </TableCell>
                        <TableCell>
                          {entry.customer_name ? (
                            <Typography fontWeight="bold" fontSize={13}>
                              {entry.customer_name}
                            </Typography>
                          ) : (
                            <Typography color="text.secondary" fontSize={13}>
                              -
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell
                          sx={{
                            fontWeight: "bold",
                            color:
                              entry.entry_type === "expense"
                                ? "error.main"
                                : entry.entry_type === "receivable"
                                  ? "warning.main"
                                  : "success.main",
                          }}
                        >
                          ₹
                          {Number(entry.amount || 0).toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell>{entry.description || "-"}</TableCell>
                        <TableCell>
                          {entry.reference ? (
                            <Chip
                              label={entry.reference}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: 11 }}
                            />
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell align="center">
                          <Stack
                            direction="row"
                            spacing={0.5}
                            justifyContent="center"
                          >
                            {invoiceManaged ? (
                              <Tooltip title="Created from an invoice — edit it from the invoice screen">
                                <span>
                                  <IconButton
                                    size="small"
                                    color="info"
                                    disabled
                                  >
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            ) : (
                              <Tooltip title="Edit Entry">
                                <IconButton
                                  size="small"
                                  color="info"
                                  onClick={() =>
                                    setEditEntry({
                                      id: entry.id,
                                      entry_type: entry.entry_type,
                                      amount: String(entry.amount || ""),
                                      description: entry.description || "",
                                      entry_date:
                                        entry.entry_date ||
                                        new Date().toISOString().slice(0, 10),
                                      customer_id: entry.customer_id || "",
                                      reference: entry.reference || "",
                                    })
                                  }
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}

                            <Tooltip title="Delete Entry">
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => setDeleteEntryId(entry.id)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* 📌 EDIT ENTRY DIALOG */}
      <Dialog
        open={!!editEntry}
        onClose={() => setEditEntry(null)}
        maxWidth="xs"
        fullWidth
      >
        {editEntry && (
          <Box component="form" onSubmit={handleUpdateEntry}>
            <DialogTitle fontWeight="bold">Edit Accounting Entry</DialogTitle>
            <DialogContent>
              <Stack spacing={2} mt={1}>
                <TextField
                  select
                  label="Type"
                  value={editEntry.entry_type}
                  onChange={(e) =>
                    setEditEntry({ ...editEntry, entry_type: e.target.value })
                  }
                  fullWidth
                >
                  <MenuItem value="expense">Expense</MenuItem>
                  <MenuItem value="income">General Income</MenuItem>
                  <MenuItem value="payment">Client Payment</MenuItem>
                </TextField>

                {editEntry.entry_type === "payment" && (
                  <Autocomplete
                    options={customers}
                    value={findCustomer(editEntry.customer_id)}
                    onChange={(_, option) =>
                      setEditEntry({
                        ...editEntry,
                        customer_id: option ? option.id : "",
                      })
                    }
                    getOptionLabel={customerLabel}
                    isOptionEqualToValue={(option, value) =>
                      option.id === value?.id
                    }
                    fullWidth
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Customer"
                        placeholder="Search customer..."
                      />
                    )}
                  />
                )}

                <TextField
                  label="Amount (₹) *"
                  type="number"
                  value={editEntry.amount}
                  onChange={(e) =>
                    setEditEntry({ ...editEntry, amount: e.target.value })
                  }
                  fullWidth
                  required
                />

                <TextField
                  label="Date"
                  type="date"
                  value={editEntry.entry_date}
                  onChange={(e) =>
                    setEditEntry({ ...editEntry, entry_date: e.target.value })
                  }
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />

                <TextField
                  label="Description"
                  value={editEntry.description}
                  onChange={(e) =>
                    setEditEntry({ ...editEntry, description: e.target.value })
                  }
                  fullWidth
                />

                <TextField
                  label="Reference / Note"
                  value={editEntry.reference}
                  onChange={(e) =>
                    setEditEntry({ ...editEntry, reference: e.target.value })
                  }
                  fullWidth
                />
              </Stack>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
              <Button onClick={() => setEditEntry(null)}>Cancel</Button>
              <Button type="submit" variant="contained">
                Update
              </Button>
            </DialogActions>
          </Box>
        )}
      </Dialog>

      {/* 📌 DELETE ENTRY CONFIRMATION DIALOG */}
      <Dialog open={!!deleteEntryId} onClose={() => setDeleteEntryId(null)}>
        <DialogTitle fontWeight="bold">Delete Accounting Entry?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this accounting record? If this was
            a client payment, any pending invoice dues will be restored.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteEntryId(null)}>Cancel</Button>
          <Button onClick={handleDeleteEntry} variant="contained" color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
