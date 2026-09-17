import { useEffect, useState } from "react";
import {
  Stack,
  Typography,
  Card,
  CardContent,
  Divider,
  Chip,
  Button,
  Avatar,
  Box,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from "@mui/material";
import { useParams, useNavigate } from "react-router-dom";
import VisibilityIcon from "@mui/icons-material/Visibility";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import PaymentIcon from "@mui/icons-material/Payment";
import ReceiptIcon from "@mui/icons-material/Receipt";
import { PATH_DASHBOARD } from "../routes/paths";

// Reusable table styling: cells never wrap, so the table scrolls horizontally
const ledgerTableSx = {
  borderRadius: 2,
  border: "1px solid #e6ebf1",
  overflowX: "auto" as const,
  "&::-webkit-scrollbar": { width: "9px", height: "9px" },
  "&::-webkit-scrollbar-track": { backgroundColor: "#f1f5f9" },
  "&::-webkit-scrollbar-thumb": {
    backgroundColor: "#c4ccd8",
    borderRadius: "10px",
    border: "2px solid #f1f5f9",
  },
  "&::-webkit-scrollbar-thumb:hover": { backgroundColor: "#94a3b8" },
  "& .MuiTableCell-root": { whiteSpace: "nowrap" as const },
};

const ledgerHeadSx = {
  "& .MuiTableCell-root": {
    backgroundColor: "#f1f5f9",
    fontWeight: 700,
    color: "#334155",
    whiteSpace: "nowrap" as const,
    borderBottom: "1px solid #e2e8f0",
  },
};

// created_at is stored by SQLite as UTC -> show clock time in local timezone
const formatTime = (value?: string | null) => {
  if (!value) return "";
  const iso = value.includes("T") ? value : value.replace(" ", "T") + "Z";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const limit = 15;

  // Dialog States
  const [openAddPayment, setOpenAddPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    description: "",
    entry_date: new Date().toISOString().slice(0, 10),
  });

  const [editPayment, setEditPayment] = useState<any | null>(null);
  const [deletePaymentId, setDeletePaymentId] = useState<number | null>(null);
  const [deleteInvoiceId, setDeleteInvoiceId] = useState<number | null>(null);

  useEffect(() => {
    loadCustomerData();
  }, [id]);

  useEffect(() => {
    loadInvoices();
  }, [id, page, search, dateFilter]);

  const loadCustomerData = async () => {
    const res = await window.electron.invoke(
      "get-customer-full-details",
      Number(id),
    );
    setData(res);
  };

  const loadInvoices = async () => {
    const res = await window.electron.invoke(
      "get-invoices",
      page,
      limit,
      search,
      dateFilter,
      Number(id),
    );
    setInvoices(res?.data || []);
    setTotalPages(res?.totalPages || 1);
    setTotalResults(res?.total || 0);
  };

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentForm.amount || Number(paymentForm.amount) <= 0) return;

    await window.electron.invoke("add-accounting-entry", {
      entry_type: "payment",
      amount: Number(paymentForm.amount),
      description: paymentForm.description || "Client payment received",
      entry_date:
        paymentForm.entry_date || new Date().toISOString().slice(0, 10),
      customer_id: Number(id),
    });

    setPaymentForm({
      amount: "",
      description: "",
      entry_date: new Date().toISOString().slice(0, 10),
    });
    setOpenAddPayment(false);

    await Promise.all([loadCustomerData(), loadInvoices()]);
  };

  const handleUpdatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPayment || !editPayment.amount || Number(editPayment.amount) <= 0)
      return;

    await window.electron.invoke("update-accounting-entry", editPayment.id, {
      entry_type: "payment",
      amount: Number(editPayment.amount),
      description: editPayment.description,
      entry_date: editPayment.entry_date,
      customer_id: Number(id),
      reference: editPayment.reference,
    });

    setEditPayment(null);
    await Promise.all([loadCustomerData(), loadInvoices()]);
  };

  const handleDeletePayment = async () => {
    if (!deletePaymentId) return;
    await window.electron.invoke(
      "delete-accounting-entry",
      Number(deletePaymentId),
    );
    setDeletePaymentId(null);
    await Promise.all([loadCustomerData(), loadInvoices()]);
  };

  const handleDeleteInvoice = async () => {
    if (!deleteInvoiceId) return;
    await window.electron.invoke("delete-invoice", Number(deleteInvoiceId));
    setDeleteInvoiceId(null);
    await Promise.all([loadCustomerData(), loadInvoices()]);
  };

  if (!data || !data.customer) {
    return (
      <Box p={4} textAlign="center">
        <Typography>Loading customer profile...</Typography>
      </Box>
    );
  }

  const { customer, summary, payments = [], topItems = [] } = data;

  return (
    <Stack spacing={3} p={3}>
      {/* 🧑 CUSTOMER HEADER */}
      <Card
        sx={{
          p: 3,
          borderRadius: 3,
          background:
            "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(6,182,212,0.08))",
          boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
          border: "1px solid rgba(99,102,241,0.2)",
        }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={3}
          alignItems={{ xs: "flex-start", sm: "center" }}
          justifyContent="space-between"
        >
          <Stack direction="row" spacing={2.5} alignItems="center">
            <Avatar
              sx={{
                width: 68,
                height: 68,
                fontSize: 26,
                fontWeight: "bold",
                background: "linear-gradient(135deg, #6366f1, #06b6d4)",
              }}
            >
              {customer.name?.charAt(0)?.toUpperCase()}
            </Avatar>

            <Box>
              <Typography variant="h5" fontWeight="bold">
                {customer.name}
              </Typography>

              <Typography color="text.secondary" fontSize={14}>
                📞 {customer.phone || "No phone provided"}
              </Typography>

              {customer.address && (
                <Typography color="text.secondary" fontSize={14}>
                  📍 {customer.address}
                </Typography>
              )}

              {customer.gstin && (
                <Typography color="text.secondary" fontSize={14}>
                  🏢 GSTIN: <b>{customer.gstin}</b>
                </Typography>
              )}

              <Stack
                direction="row"
                spacing={1}
                mt={1}
                flexWrap="wrap"
                gap={0.5}
              >
                <Chip label="Active Client" color="success" size="small" />
                {summary.pending > 0 ? (
                  <Chip
                    label={`Pending Dues: ₹${Number(summary.pending).toFixed(2)}`}
                    color="error"
                    size="small"
                    sx={{ fontWeight: "bold" }}
                  />
                ) : (
                  <Chip
                    label="No Pending Dues"
                    color="primary"
                    variant="outlined"
                    size="small"
                  />
                )}
                {summary.advance > 0 && (
                  <Chip
                    label={`Advance Balance: ₹${Number(summary.advance).toFixed(2)}`}
                    color="success"
                    size="small"
                    sx={{ fontWeight: "bold" }}
                  />
                )}
              </Stack>
            </Box>
          </Stack>

          <Button
            variant="contained"
            color="primary"
            size="large"
            startIcon={<PaymentIcon />}
            onClick={() => setOpenAddPayment(true)}
            sx={{ fontWeight: "bold", textTransform: "none", borderRadius: 2 }}
          >
            + Record Payment
          </Button>
        </Stack>
      </Card>

      {/* 📊 SUMMARY STATS */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        flexWrap="wrap"
      >
        <Card sx={{ flex: 1, minWidth: 160, borderRadius: 2 }}>
          <CardContent sx={{ py: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Total Spend
            </Typography>
            <Typography variant="h5" fontWeight="bold">
              ₹
              {Number(summary.totalSpend || 0).toLocaleString("en-IN", {
                minimumFractionDigits: 2,
              })}
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1, minWidth: 160, borderRadius: 2 }}>
          <CardContent sx={{ py: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Pending Dues
            </Typography>
            <Typography
              variant="h5"
              fontWeight="bold"
              color={summary.pending > 0 ? "error.main" : "text.primary"}
            >
              ₹
              {Number(summary.pending || 0).toLocaleString("en-IN", {
                minimumFractionDigits: 2,
              })}
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1, minWidth: 160, borderRadius: 2 }}>
          <CardContent sx={{ py: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Advance Balance
            </Typography>
            <Typography
              variant="h5"
              fontWeight="bold"
              color={summary.advance > 0 ? "success.main" : "text.primary"}
            >
              ₹
              {Number(summary.advance || 0).toLocaleString("en-IN", {
                minimumFractionDigits: 2,
              })}
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1, minWidth: 160, borderRadius: 2 }}>
          <CardContent sx={{ py: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Total Invoices
            </Typography>
            <Typography variant="h5" fontWeight="bold">
              {data.invoices?.length || 0}
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ flex: 1, minWidth: 160, borderRadius: 2 }}>
          <CardContent sx={{ py: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Payment Records
            </Typography>
            <Typography variant="h5" fontWeight="bold">
              {payments.length}
            </Typography>
          </CardContent>
        </Card>
      </Stack>

      {/* 🛒 MOST BOUGHT ITEMS */}
      {topItems.length > 0 && (
        <Card sx={{ p: 2.5, borderRadius: 2 }}>
          <Typography variant="subtitle1" fontWeight="bold">
            Most Bought Items
          </Typography>
          <Divider sx={{ my: 1.5 }} />
          <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
            {topItems.map((item: any) => (
              <Chip
                key={item.item_name}
                label={`${item.item_name} (${item.qty} qty)`}
                color="info"
                variant="outlined"
              />
            ))}
          </Stack>
        </Card>
      )}

      {/* 🧾 INVOICES TABLE LIST */}
      <Card sx={{ p: 3, borderRadius: 2 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          spacing={2}
          mb={2}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <ReceiptIcon color="primary" />
            <Typography variant="h6" fontWeight="bold">
              Invoices List
            </Typography>
          </Stack>

          {/* Search & Filters */}
          <Stack direction="row" spacing={1.5}>
            <TextField
              size="small"
              label="Search Invoice #"
              value={search}
              onChange={(e) => {
                setPage(1);
                setSearch(e.target.value);
              }}
            />
            <TextField
              size="small"
              type="date"
              label="Date"
              InputLabelProps={{ shrink: true }}
              value={dateFilter}
              onChange={(e) => {
                setPage(1);
                setDateFilter(e.target.value);
              }}
            />
          </Stack>
        </Stack>

        <TableContainer component={Paper} variant="outlined" sx={ledgerTableSx}>
          <Table size="small">
            <TableHead sx={ledgerHeadSx}>
              <TableRow>
                <TableCell>
                  <b># Invoice</b>
                </TableCell>
                <TableCell>
                  <b>Date</b>
                </TableCell>
                <TableCell>
                  <b>Total Amount</b>
                </TableCell>
                <TableCell>
                  <b>Pending</b>
                </TableCell>
                <TableCell>
                  <b>Status</b>
                </TableCell>
                <TableCell align="center">
                  <b>Actions</b>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                    <Typography color="text.secondary">
                      No invoices found for this customer.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((inv) => (
                  <TableRow key={inv.id} hover>
                    <TableCell sx={{ fontWeight: "bold" }}>
                      #{inv.invoice_number}
                    </TableCell>
                    <TableCell>{inv.date}</TableCell>
                    <TableCell>
                      ₹
                      {Number(inv.total || 0).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell>
                      {Number(inv.pending_amount || 0) > 0 ? (
                        <Typography
                          color="error"
                          fontWeight="bold"
                          fontSize={13}
                        >
                          ₹{Number(inv.pending_amount).toFixed(2)}
                        </Typography>
                      ) : (
                        <Typography color="text.secondary" fontSize={13}>
                          ₹0.00
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={inv.status}
                        color={
                          inv.status === "PAID"
                            ? "success"
                            : inv.status === "UNPAID"
                              ? "error"
                              : "default"
                        }
                        sx={{ fontWeight: "bold", fontSize: 11 }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Stack
                        direction="row"
                        spacing={1}
                        justifyContent="center"
                      >
                        <Tooltip title="View Invoice">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() =>
                              navigate(
                                PATH_DASHBOARD.preview
                                  .replace(":invoiceId", String(inv.id))
                                  .replace(":isPrint", "false"),
                              )
                            }
                          >
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Edit Invoice">
                          <IconButton
                            size="small"
                            color="info"
                            onClick={() =>
                              navigate(
                                PATH_DASHBOARD.newInvoice + `?edit=${inv.id}`,
                              )
                            }
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Delete Invoice">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setDeleteInvoiceId(inv.id)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          mt={2}
        >
          <Typography fontSize={13} color="text.secondary">
            Showing {invoices.length} of {totalResults} invoices
          </Typography>

          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="outlined"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Typography alignSelf="center" fontSize={13}>
              Page {page} of {totalPages || 1}
            </Typography>
            <Button
              size="small"
              variant="contained"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </Stack>
        </Stack>
      </Card>

      {/* 💰 CLIENT PAYMENTS HISTORY */}
      <Card sx={{ p: 3, borderRadius: 2 }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          mb={2}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <PaymentIcon color="success" />
            <Typography variant="h6" fontWeight="bold">
              Client Payment Records
            </Typography>
          </Stack>

          <Button
            size="small"
            variant="outlined"
            color="success"
            startIcon={<AddCircleIcon />}
            onClick={() => setOpenAddPayment(true)}
            sx={{ fontWeight: "bold", textTransform: "none" }}
          >
            + Add Payment
          </Button>
        </Stack>

        <TableContainer component={Paper} variant="outlined" sx={ledgerTableSx}>
          <Table size="small">
            <TableHead sx={ledgerHeadSx}>
              <TableRow>
                <TableCell>
                  <b>Date</b>
                </TableCell>
                <TableCell>
                  <b>Amount Paid</b>
                </TableCell>
                <TableCell>
                  <b>Applied For / Ref</b>
                </TableCell>
                <TableCell>
                  <b>Description</b>
                </TableCell>
                <TableCell align="center">
                  <b>Actions</b>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                    <Typography color="text.secondary">
                      No payment records found for this client.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((pm: any) => (
                  <TableRow key={pm.id} hover>
                    <TableCell>
                      <Typography fontSize={13}>
                        {pm.entry_date || "-"}
                      </Typography>
                      {pm.created_at && (
                        <Typography fontSize={11} color="text.secondary">
                          {formatTime(pm.created_at)}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell
                      sx={{ color: "success.main", fontWeight: "bold" }}
                    >
                      ₹
                      {Number(pm.amount || 0).toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell>
                      {pm.invoice_number ? (
                        <Chip
                          label={`Invoice #${pm.invoice_number}`}
                          size="small"
                          color="primary"
                          variant="outlined"
                          sx={{ fontSize: 11 }}
                        />
                      ) : (
                        <Chip
                          label={pm.reference || "Advance Payment"}
                          size="small"
                          color="success"
                          variant="outlined"
                          sx={{ fontSize: 11 }}
                        />
                      )}
                    </TableCell>
                    <TableCell>{pm.description || "-"}</TableCell>
                    <TableCell align="center">
                      <Stack
                        direction="row"
                        spacing={1}
                        justifyContent="center"
                      >
                        <Tooltip title="Edit Payment">
                          <IconButton
                            size="small"
                            color="info"
                            onClick={() =>
                              setEditPayment({
                                id: pm.id,
                                amount: String(pm.amount || ""),
                                description: pm.description || "",
                                entry_date:
                                  pm.entry_date ||
                                  new Date().toISOString().slice(0, 10),
                                reference: pm.reference || "",
                              })
                            }
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Delete Payment">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setDeletePaymentId(pm.id)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* 📌 DIALOG: RECORD NEW PAYMENT */}
      <Dialog
        open={openAddPayment}
        onClose={() => setOpenAddPayment(false)}
        maxWidth="xs"
        fullWidth
      >
        <Box component="form" onSubmit={handleCreatePayment}>
          <DialogTitle fontWeight="bold">Record Client Payment</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ mb: 2 }}>
              Enter payment received from <b>{customer.name}</b>. It will clear
              pending dues or record as advance if extra.
            </DialogContentText>
            <Stack spacing={2} mt={1}>
              <TextField
                label="Amount (₹) *"
                type="number"
                fullWidth
                value={paymentForm.amount}
                onChange={(e) =>
                  setPaymentForm({ ...paymentForm, amount: e.target.value })
                }
                required
                autoFocus
              />
              <TextField
                label="Date"
                type="date"
                fullWidth
                value={paymentForm.entry_date}
                onChange={(e) =>
                  setPaymentForm({ ...paymentForm, entry_date: e.target.value })
                }
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Description / Note"
                fullWidth
                value={paymentForm.description}
                onChange={(e) =>
                  setPaymentForm({
                    ...paymentForm,
                    description: e.target.value,
                  })
                }
                placeholder="e.g. Cash payment / GPay / Part payment"
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={() => setOpenAddPayment(false)}>Cancel</Button>
            <Button type="submit" variant="contained" color="success">
              Save Payment
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* 📌 DIALOG: EDIT PAYMENT */}
      <Dialog
        open={!!editPayment}
        onClose={() => setEditPayment(null)}
        maxWidth="xs"
        fullWidth
      >
        {editPayment && (
          <Box component="form" onSubmit={handleUpdatePayment}>
            <DialogTitle fontWeight="bold">Edit Payment Entry</DialogTitle>
            <DialogContent>
              <Stack spacing={2} mt={1}>
                <TextField
                  label="Amount (₹) *"
                  type="number"
                  fullWidth
                  value={editPayment.amount}
                  onChange={(e) =>
                    setEditPayment({ ...editPayment, amount: e.target.value })
                  }
                  required
                />
                <TextField
                  label="Date"
                  type="date"
                  fullWidth
                  value={editPayment.entry_date}
                  onChange={(e) =>
                    setEditPayment({
                      ...editPayment,
                      entry_date: e.target.value,
                    })
                  }
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  label="Description"
                  fullWidth
                  value={editPayment.description}
                  onChange={(e) =>
                    setEditPayment({
                      ...editPayment,
                      description: e.target.value,
                    })
                  }
                />
              </Stack>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
              <Button onClick={() => setEditPayment(null)}>Cancel</Button>
              <Button type="submit" variant="contained">
                Update
              </Button>
            </DialogActions>
          </Box>
        )}
      </Dialog>

      {/* 📌 DIALOG: DELETE PAYMENT CONFIRMATION */}
      <Dialog open={!!deletePaymentId} onClose={() => setDeletePaymentId(null)}>
        <DialogTitle fontWeight="bold">Delete Payment Record?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this payment record? If this payment
            was applied to an invoice, the pending dues will be restored.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeletePaymentId(null)}>Cancel</Button>
          <Button
            onClick={handleDeletePayment}
            variant="contained"
            color="error"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* 📌 DIALOG: DELETE INVOICE CONFIRMATION */}
      <Dialog open={!!deleteInvoiceId} onClose={() => setDeleteInvoiceId(null)}>
        <DialogTitle fontWeight="bold">Delete Invoice?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this invoice? This will remove the
            invoice and restore any product inventory.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteInvoiceId(null)}>Cancel</Button>
          <Button
            onClick={handleDeleteInvoice}
            variant="contained"
            color="error"
          >
            Delete Invoice
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
