import { Card, Typography, Stack, Button, Divider } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { useNavigate } from "react-router-dom";
import { PATH_DASHBOARD } from "../routes/paths";
import VisibilityIcon from "@mui/icons-material/Visibility";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from "@mui/material";
import { useState } from "react";
import EditIcon from "@mui/icons-material/Edit";

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

type Props = {
  invoice: Invoice;
  onDelete: (id: number) => void;
};

export default function InvoiceCard({ invoice, onDelete }: Props) {
  const navigate = useNavigate();

  const [openDelete, setOpenDelete] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  return (
    <Card
      sx={{
        p: 2.5,
        width: 360,
        borderRadius: 4,
        boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
        transition: "0.3s",
        border: "1px solid #eee",
        "&:hover": {
          transform: "translateY(-5px)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
        },
      }}
    >
      <Stack spacing={2}>
        {/* Header */}
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Typography fontWeight="bold">#{invoice.invoice_number}</Typography>

          <Typography fontWeight="bold" fontSize={18} color="primary">
            ₹{(invoice.total ?? 0).toLocaleString("en-IN")}
          </Typography>
        </Stack>

        {/* Status Badge */}
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Typography
            sx={{
              px: 2,
              py: 0.5,
              borderRadius: 2,
              fontSize: 12,
              fontWeight: "bold",
              backgroundColor:
                invoice.status === "PAID"
                  ? "#e8f5e9"
                  : invoice.status === "UNPAID"
                    ? "#ffebee"
                    : "#eeeeee",
              color:
                invoice.status === "PAID"
                  ? "green"
                  : invoice.status === "UNPAID"
                    ? "red"
                    : "gray",
            }}
          >
            {invoice.status}
          </Typography>

          {invoice.status === "UNPAID" && (
            <Typography fontSize={13} color="error">
              ₹{invoice.pending_amount} Pending
            </Typography>
          )}
        </Stack>

        <Divider />

        {/* Info */}
        <Stack spacing={0.5}>
          <Typography fontSize={14}>
            <b>Customer:</b> {invoice.customer_name}
          </Typography>

          <Typography fontSize={14}>
            <b>Shop:</b> {invoice.shop_name}
          </Typography>

          <Typography fontSize={13} color="text.secondary">
            📅 {invoice.date}
          </Typography>
        </Stack>

        {/* Extra */}
        <Stack direction="row" justifyContent="space-between">
          <Typography fontSize={12} color="text.secondary">
            GST: {invoice.custom_gst}%
          </Typography>

          <Typography fontSize={12} color="text.secondary">
            Discount: ₹{invoice.discount}
          </Typography>
        </Stack>

        {/* Buttons */}
        <Stack direction="row" spacing={1.5} mt={1}>
          <Button
            fullWidth
            variant="contained"
            sx={{
              borderRadius: 2,
              textTransform: "none",
              fontWeight: "bold",
            }}
            startIcon={<VisibilityIcon />}
            onClick={() =>
              navigate(
                PATH_DASHBOARD.preview
                  .replace(":invoiceId", String(invoice.id))
                  .replace(":isPrint", String(false)),
              )
            }
          >
            View
          </Button>

          <Button
            fullWidth
            variant="outlined"
            sx={{
              borderRadius: 2,
              textTransform: "none",
            }}
            startIcon={<EditIcon />}
            onClick={() =>
              navigate(PATH_DASHBOARD.newInvoice + `?edit=${invoice.id}`)
            }
          >
            Edit
          </Button>

          <Button
            fullWidth
            variant="outlined"
            color="error"
            sx={{
              borderRadius: 2,
              textTransform: "none",
            }}
            startIcon={<DeleteIcon />}
            onClick={() => {
              setSelectedId(invoice.id);
              setOpenDelete(true);
            }}
          >
            Delete
          </Button>
        </Stack>
      </Stack>
      <Dialog open={openDelete} onClose={() => setOpenDelete(false)}>
        <DialogTitle> Delete Invoice #{invoice.invoice_number}?</DialogTitle>

        <DialogContent>
          <DialogContentText>
            This action cannot be undone. Are you sure you want to delete this
            invoice?
          </DialogContentText>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setOpenDelete(false)}>Cancel</Button>

          <Button
            color="error"
            variant="contained"
            onClick={() => {
              if (selectedId !== null) {
                onDelete(selectedId);
              }
              setOpenDelete(false);
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
