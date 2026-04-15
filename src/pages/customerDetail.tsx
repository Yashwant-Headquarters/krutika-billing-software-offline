import { useEffect, useState } from "react";
import {
  Stack,
  Typography,
  Card,
  Divider,
  Chip,
  Button,
  Avatar,
  Box,
  TextField,
} from "@mui/material";
import { useParams } from "react-router-dom";
import InvoiceCard from "../component/card";

export default function CustomerDetail() {
  const { id } = useParams();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>(null);

  const [invoices, setInvoices] = useState<any[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);

  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const limit = 20;
  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    loadInvoices();
  }, [page, search, dateFilter]);

  const load = async () => {
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
      Number(id), // 🔥 THIS IS KEY
    );

    setInvoices(res.data);
    setTotalPages(res.totalPages);
    setTotalResults(res.total);
  };

  if (!data) return <Typography>Loading...</Typography>;

  return (
    <Stack spacing={3} p={3}>
      <Stack spacing={3} p={3}>
        {/* 🔥 TITLE */}
        <Typography
          variant="h4"
          textAlign="center"
          fontWeight="bold"
          sx={{
            background: "linear-gradient(90deg, #6366f1, #06b6d4)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Customer Profile
        </Typography>

        {/* 🧑 CUSTOMER HEADER */}
        <Card
          sx={{
            p: 3,
            borderRadius: 4,
            background:
              "linear-gradient(135deg, rgba(99,102,241,0.1), rgba(6,182,212,0.1))",
            backdropFilter: "blur(10px)",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
          }}
        >
          <Stack direction="row" spacing={3} alignItems="center">
            {/* 👤 Avatar */}
            <Avatar
              sx={{
                width: 70,
                height: 70,
                fontSize: 28,
                fontWeight: "bold",
                background: "linear-gradient(135deg, #6366f1, #06b6d4)",
              }}
            >
              {data.customer.name?.charAt(0)}
            </Avatar>

            {/* 🧾 Info */}
            <Box>
              <Typography variant="h5" fontWeight="bold">
                {data.customer.name}
              </Typography>

              <Typography color="text.secondary">
                📞 {data.customer.phone}
              </Typography>

              <Typography color="text.secondary">
                📍 {data.customer.address}
              </Typography>

              {/* 💡 Status Badge */}
              <Stack direction="row" spacing={1} mt={1}>
                <Chip label="Active Customer" color="success" size="small" />
                {data.summary.pending > 0 && (
                  <Chip
                    label={`Pending ₹${data.summary.pending}`}
                    color="warning"
                    size="small"
                  />
                )}
              </Stack>
            </Box>
          </Stack>
        </Card>
      </Stack>
      {/* 📊 STATS */}
      <Stack direction="row" spacing={2} flexWrap="wrap">
        <Card sx={{ p: 2, minWidth: 200 }}>
          <Typography>Total Spend</Typography>
          <Typography variant="h5">₹{data.summary.totalSpend || 0}</Typography>
        </Card>

        <Card sx={{ p: 2, minWidth: 200 }}>
          <Typography>Pending</Typography>
          <Typography variant="h5" color="error">
            ₹{data.summary.pending || 0}
          </Typography>
        </Card>

        <Card sx={{ p: 2, minWidth: 200 }}>
          <Typography>Total Invoices</Typography>
          <Typography variant="h5">{data.invoices.length}</Typography>
        </Card>
      </Stack>
      {/* 🛒 TOP ITEMS */}
      <Card sx={{ p: 3 }}>
        <Typography variant="h6">Most Bought Items</Typography>
        <Divider sx={{ my: 1 }} />

        <Stack direction="row" spacing={1} flexWrap="wrap">
          {data.topItems.map((item: any) => (
            <Chip
              key={item.item_name}
              label={`${item.item_name} (${item.qty})`}
              color="primary"
            />
          ))}
        </Stack>
      </Card>
      {/* 🧾 INVOICES */}
      <Card sx={{ p: 3 }}>
        <Typography variant="h6">All Invoices</Typography>

        {/* 🔍 FILTERS */}
        <Stack direction="row" spacing={2} mt={2}>
          <TextField
            label="Search"
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

        <Divider sx={{ my: 2 }} />

        {/* 📦 INVOICE CARDS */}
        <Stack direction="row" flexWrap="wrap" gap={3}>
          {invoices.map((inv) => (
            <InvoiceCard key={inv.id} invoice={inv} />
          ))}
        </Stack>

        {/* 📊 INFO */}
        <Stack spacing={1} mt={2}>
          <Typography>
            Showing {invoices.length} of {totalResults}
          </Typography>

          <Typography>
            Page {page} of {totalPages}
          </Typography>
        </Stack>

        {/* ⬅️ ➡️ PAGINATION */}
        <Stack direction="row" spacing={2} mt={2}>
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
      </Card>
    </Stack>
  );
}
