import { useEffect, useState } from "react";
import {
  Button,
  Card,
  CardContent,
  Chip,
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

type Customer = {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  gstin: string | null;
};

type Followup = {
  id: number;
  note: string;
  followup_date: string | null;
  created_at: string;
};

export default function CRMPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [note, setNote] = useState("");
  const [followupDate, setFollowupDate] = useState("");

  const loadCustomers = async () => {
    const res = await window.electron.invoke("get-customers", 1, 1000, "");
    setCustomers(res?.data || []);
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const handleSelectCustomer = async (customer: Customer) => {
    setSelectedCustomer(customer);
    const res = await window.electron.invoke("get-crm-followups", customer.id);
    setFollowups(res || []);
  };

  const handleAddFollowup = async () => {
    if (!selectedCustomer || !note.trim()) return;
    await window.electron.invoke(
      "add-crm-followup",
      selectedCustomer.id,
      note,
      followupDate,
    );
    setNote("");
    setFollowupDate("");
    const res = await window.electron.invoke(
      "get-crm-followups",
      selectedCustomer.id,
    );
    setFollowups(res || []);
  };

  return (
    <Stack spacing={3} p={4}>
      <Typography variant="h4" fontWeight="bold">
        CRM
      </Typography>
      <Typography color="text.secondary">
        Track customer relationships and follow-up notes for better sales
        conversations.
      </Typography>

      <Stack spacing={3}>
        <Card>
          <CardContent>
            <Typography variant="h6" mb={2}>
              Customers
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Phone</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {customers.map((customer) => (
                    <TableRow
                      key={customer.id}
                      hover
                      selected={selectedCustomer?.id === customer.id}
                      onClick={() => handleSelectCustomer(customer)}
                      sx={{ cursor: "pointer" }}
                    >
                      <TableCell>
                        <Typography fontWeight={600}>
                          {customer.name}
                        </Typography>
                      </TableCell>
                      <TableCell>{customer.phone || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            {selectedCustomer ? (
              <>
                <Typography variant="h6" mb={1}>
                  {selectedCustomer.name}
                </Typography>
                <Stack direction="row" spacing={1} mb={2} flexWrap="wrap">
                  <Chip label={selectedCustomer.phone || "No phone"} />
                  <Chip label={selectedCustomer.gstin || "No GSTIN"} />
                </Stack>
                <Typography variant="body2" color="text.secondary" mb={2}>
                  {selectedCustomer.address || "No address available"}
                </Typography>

                <Stack spacing={2} mb={3}>
                  <TextField
                    label="Follow-up note"
                    multiline
                    minRows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <TextField
                    label="Follow-up date"
                    type="date"
                    value={followupDate}
                    onChange={(e) => setFollowupDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                  <Button
                    variant="contained"
                    startIcon={<AddCircleIcon />}
                    onClick={handleAddFollowup}
                  >
                    Save Follow-up
                  </Button>
                </Stack>

                <Typography variant="subtitle1" fontWeight={600} mb={1}>
                  Follow-up History
                </Typography>
                {followups.length === 0 ? (
                  <Typography color="text.secondary">
                    No follow-ups yet.
                  </Typography>
                ) : (
                  <Stack spacing={1}>
                    {followups.map((item) => (
                      <Paper key={item.id} variant="outlined" sx={{ p: 2 }}>
                        <Typography>{item.note}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Date: {item.followup_date || "-"} • Added:{" "}
                          {item.created_at}
                        </Typography>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </>
            ) : (
              <Typography color="text.secondary">
                Select a customer to view CRM details.
              </Typography>
            )}
          </CardContent>
        </Card>
      </Stack>
    </Stack>
  );
}
