import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
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
  Typography,
} from "@mui/material";
import AddCircleIcon from "@mui/icons-material/AddCircle";

type Entry = {
  id: number;
  entry_type: string;
  amount: number;
  description: string | null;
  entry_date: string | null;
  reference: string | null;
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
    entry_date: "",
    customer_id: "",
  });

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
    if (!form.amount) return;
    await window.electron.invoke("add-accounting-entry", {
      ...form,
      amount: Number(form.amount),
      entry_date: form.entry_date || new Date().toISOString().slice(0, 10),
    });
    setForm({
      entry_type: "expense",
      amount: "",
      description: "",
      entry_date: "",
      customer_id: "",
    });
    await loadData();
  };

  return (
    <Stack spacing={3} p={4}>
      <Typography variant="h4" fontWeight="bold">
        Accounting
      </Typography>
      <Typography color="text.secondary">
        Track cash flow, expenses and customer dues from one place.
      </Typography>

      <Stack spacing={3}>
        <Card>
          <CardContent>
            <Typography variant="h6" mb={2}>
              Quick Entry
            </Typography>
            <Box
              component="form"
              onSubmit={handleSubmit}
              sx={{ display: "grid", gap: 2 }}
            >
              <TextField
                select
                label="Entry Type"
                value={form.entry_type}
                onChange={(e) =>
                  setForm({ ...form, entry_type: e.target.value })
                }
              >
                <MenuItem value="expense">Expense</MenuItem>
                <MenuItem value="income">Income</MenuItem>
                <MenuItem value="payment">Client payment</MenuItem>
              </TextField>
              {form.entry_type === "payment" && (
                <TextField
                  select
                  label="Customer"
                  value={form.customer_id}
                  onChange={(e) =>
                    setForm({ ...form, customer_id: e.target.value })
                  }
                  required
                >
                  {customers.map((customer) => (
                    <MenuItem key={customer.id} value={customer.id}>
                      {customer.name}
                      {customer.phone ? ` - ${customer.phone}` : ""}
                    </MenuItem>
                  ))}
                </TextField>
              )}
              <TextField
                label="Amount"
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                required
              />
              <TextField
                label="Description"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
              <TextField
                label="Date"
                type="date"
                value={form.entry_date}
                onChange={(e) =>
                  setForm({ ...form, entry_date: e.target.value })
                }
                InputLabelProps={{ shrink: true }}
              />
              <Button
                type="submit"
                variant="contained"
                startIcon={<AddCircleIcon />}
              >
                Save Entry
              </Button>
            </Box>
          </CardContent>
        </Card>

        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          flexWrap="wrap"
        >
          <Card sx={{ flex: 1, minWidth: 240 }}>
            <CardContent>
              <Typography color="text.secondary">Income</Typography>
              <Typography variant="h5">₹{summary.income.toFixed(2)}</Typography>
            </CardContent>
          </Card>
          <Card sx={{ flex: 1, minWidth: 240 }}>
            <CardContent>
              <Typography color="text.secondary">Client payments</Typography>
              <Typography variant="h5">
                ₹{Number(summary.payments || 0).toFixed(2)}
              </Typography>
            </CardContent>
          </Card>
          <Card sx={{ flex: 1, minWidth: 240 }}>
            <CardContent>
              <Typography color="text.secondary">Expenses</Typography>
              <Typography variant="h5">
                ₹{summary.expense.toFixed(2)}
              </Typography>
            </CardContent>
          </Card>
          <Card sx={{ flex: 1, minWidth: 240 }}>
            <CardContent>
              <Typography color="text.secondary">Receivables</Typography>
              <Typography variant="h5">
                ₹{summary.receivable.toFixed(2)}
              </Typography>
            </CardContent>
          </Card>
          <Card sx={{ flex: 1, minWidth: 240 }}>
            <CardContent>
              <Typography color="text.secondary">Net Balance</Typography>
              <Typography variant="h5">
                ₹{summary.balance.toFixed(2)}
              </Typography>
            </CardContent>
          </Card>
        </Stack>
      </Stack>

      <Card>
        <CardContent>
          <Typography variant="h6" mb={2}>
            Accounting Ledger
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Reference</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{entry.entry_date || "-"}</TableCell>
                    <TableCell>
                      {entry.entry_type === "payment"
                        ? "Client payment"
                        : entry.entry_type}
                    </TableCell>
                    <TableCell>
                      ₹{Number(entry.amount || 0).toFixed(2)}
                    </TableCell>
                    <TableCell>{entry.description || "-"}</TableCell>
                    <TableCell>{entry.reference || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Stack>
  );
}
