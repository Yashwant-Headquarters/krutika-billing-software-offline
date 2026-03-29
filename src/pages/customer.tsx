import { useEffect, useState } from "react";
import {
  Stack,
  Typography,
  TextField,
  Button,
  Card,
  Divider,
} from "@mui/material";
import IosShareIcon from "@mui/icons-material/IosShare";

type Customer = {
  id: number;
  name: string;
  phone: string;
  address: string;
};

export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [search, setSearch] = useState("");

  const limit = 50;

  const [openId, setOpenId] = useState<number | null>(null);
  const [details, setDetails] = useState<any>({});

  const handleOpen = async (id: number) => {
    if (openId === id) {
      setOpenId(null);
      return;
    }

    const res = await window.electron.invoke("get-customer-details", id);

    setDetails((prev: any) => ({
      ...prev,
      [id]: res,
    }));

    setOpenId(id);
  };

  const loadCustomers = async () => {
    const result = await window.electron.invoke(
      "get-customers",
      page,
      limit,
      search,
    );

    setCustomers(result.data);
    setTotalPages(result.totalPages);
    setTotalResults(result.total);
  };

  useEffect(() => {
    loadCustomers();
  }, [page, search]);

  return (
    <Stack spacing={3} p={3}>
      <Stack
        sx={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "space-between",
        }}
      >
        <Typography variant="h4">Customers List</Typography>
        <Button
          variant="contained"
          startIcon={<IosShareIcon />}
          onClick={async () =>
            await window.electron.invoke("export-customers-excel")
          }
        >
          Export
        </Button>
      </Stack>

      {/* 🔍 Search */}
      <TextField
        label="Search by Name or Phone (min 3 chars)"
        value={search}
        onChange={(e) => {
          setPage(1);
          setSearch(e.target.value);
        }}
        sx={{ maxWidth: 400 }}
      />

      <Divider />

      {/* 📦 Customer Cards */}
      <Stack spacing={2}>
        {customers.map((cust) => (
          <Card
            key={cust.id}
            sx={{ p: 2, cursor: "pointer" }}
            onClick={() => handleOpen(cust.id)}
          >
            {/* Basic Info */}
            <Typography fontWeight="bold">{cust.name}</Typography>
            <Typography>{cust.phone}</Typography>
            <Typography variant="body2" color="text.secondary">
              {cust.address}
            </Typography>

            {/* Expand Section */}
            {openId === cust.id && details[cust.id] && (
              <Stack mt={2} spacing={1}>
                <Divider />

                <Typography>
                  💰 Total Spend: ₹{details[cust.id].totalSpend}
                </Typography>

                <Typography color="error">
                  ⚠ Pending: ₹{details[cust.id].pending}
                </Typography>

                <Typography fontWeight="bold">Last Transactions:</Typography>

                {details[cust.id].lastTransactions.map((tx: any) => (
                  <Typography key={tx.invoice_number}>
                    {tx.invoice_number} | ₹{tx.total} | {tx.status}
                  </Typography>
                ))}
              </Stack>
            )}
          </Card>
        ))}
      </Stack>

      {/* 📊 Info */}
      <Stack spacing={1}>
        <Typography>
          Showing {customers.length} of {totalResults} customers
        </Typography>

        <Typography>
          Page {page} of {totalPages}
        </Typography>
      </Stack>

      {/* ⬅️ ➡️ Pagination */}
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
