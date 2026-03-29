import { useEffect, useState } from "react";
import { Stack, Typography, Button, TextField, Divider } from "@mui/material";
import InvoiceCard from "../component/card";

type Invoice = {
  id: number;
  invoice_number: string;
  shop_name: string;
  customer_name: string;
  date: string;
  total: number;
  custom_gst: number;
  discount: number;
  status: string;
  pending_amount: number;
};

export default function InvoiceList() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);

  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  const limit = 54;

  const loadInvoices = async () => {
    const result = await window.electron.invoke(
      "get-invoices",
      page,
      limit,
      search,
      dateFilter,
    );

    setInvoices(result.data);
    setTotalPages(result.totalPages);
    setTotalResults(result.total);
  };

  useEffect(() => {
    loadInvoices();
  }, [page, search, dateFilter]);

  const handleDelete = async (id: number) => {
    await window.electron.invoke("delete-invoice", id);
    loadInvoices();
  };

  return (
    <Stack spacing={3} p={3}>
      <Typography variant="h4">Invoice List</Typography>

      {/* 🔍 Filters */}
      <Stack direction="row" spacing={2}>
        <TextField
          label="Search (min 3 chars)"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
        />

        <TextField
          type="date"
          label="Filter by Date"
          InputLabelProps={{ shrink: true }}
          value={dateFilter}
          onChange={(e) => {
            setPage(1);
            setDateFilter(e.target.value);
          }}
        />
      </Stack>

      <Divider />

      {/* 📦 Cards */}
      <Stack
        direction="row"
        flexWrap="wrap"
        gap={3}
        sx={{
          justifyContent: "center",
        }}
      >
        {invoices.map((inv) => (
          <InvoiceCard key={inv.id} invoice={inv} onDelete={handleDelete} />
        ))}
      </Stack>

      {/* 📊 Pagination Info */}
      <Stack spacing={1}>
        <Typography>
          Showing {invoices.length} of {totalResults} results
        </Typography>

        <Typography>
          Page {page} of {totalPages}
        </Typography>
      </Stack>

      {/* ⬅️ ➡️ Buttons */}
      <Stack direction="row" spacing={2}>
        <Button
          variant="outlined"
          disabled={page === 1}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous
        </Button>

        <Button
          variant="contained"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </Stack>
    </Stack>
  );
}
