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

type Invoice = {
  id: number;
  invoice_number: string;
  shop_name: string;
  customer_name: string;
  date: string;
  total: number;
  custom_gst: number;
  discount: number;
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
        p: 2,
        width: 350,
        borderRadius: 3,
        boxShadow: 3,
        transition: "0.2s",
        "&:hover": { boxShadow: 6 },
      }}
    >
      <Stack spacing={1.5}>
        {/* Top Row */}
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="h6">#{invoice.invoice_number}</Typography>

          <Typography color="primary" fontWeight="bold">
            ₹{invoice.total}
          </Typography>
        </Stack>

        <Divider />

        {/* Shop */}
        <Typography>
          <b>Shop:</b> {invoice.shop_name}
        </Typography>

        {/* Customer */}
        <Typography>
          <b>Customer:</b> {invoice.customer_name}
        </Typography>

        {/* GST + Discount */}
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="body2" color="text.secondary">
            GST: {invoice.custom_gst}%
          </Typography>

          <Typography variant="body2" color="text.secondary">
            Discount: ₹{invoice.discount}
          </Typography>
        </Stack>

        {/* Date */}
        <Typography variant="body2" color="text.secondary">
          Date: {invoice.date}
        </Typography>

        {/* Buttons */}
        <Stack direction="row" spacing={2} mt={1}>
          <Button
            fullWidth
            variant="contained"
            startIcon={<VisibilityIcon />}
            onClick={() =>
              navigate(
                PATH_DASHBOARD.preview.replace(
                  ":invoiceId",
                  String(invoice.id),
                ),
              )
            }
          >
            Preview
          </Button>

          <Button
            fullWidth
            variant="outlined"
            color="error"
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
