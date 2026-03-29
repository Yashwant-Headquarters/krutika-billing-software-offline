import { useEffect, useState } from "react";
import PrintIcon from "@mui/icons-material/Print";
import {
  Card,
  Typography,
  Stack,
  Divider,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Button,
  Box,
} from "@mui/material";
import { useParams } from "react-router-dom";
import { APP_SHOP } from "../constant/shop";
import { numberToWords } from "../utils/numberToWord";
import { QRCodeCanvas } from "qrcode.react";
import "./preview.css";

type Invoice = any;
type Item = any;

export default function InvoicePreview() {
  const { invoiceId, isPrint } = useParams();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    loadInvoice();
  }, [invoiceId]);

  const loadInvoice = async () => {
    const res = await window.electron.invoke(
      "get-invoice-details",
      Number(invoiceId),
    );
    setInvoice(res.invoice);
    setItems(res.items);

    if (isPrint === "true") {
      setTimeout(handlePrint, 500);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!invoice) return <Typography>Loading...</Typography>;

  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.price,
    0,
  );

  const gstAmount = (subtotal * invoice.custom_gst) / 100;
  const finalTotal = subtotal + gstAmount - invoice.discount;

  return (
    <>
      {" "}
      {/* Print Button */}
      {isPrint !== "true" && (
        <Stack
          sx={{
            width: "100%",
            alignItems: "center",
            justifyContent: "center",
            my: 3,
          }}
        >
          <Button
            variant="contained"
            onClick={handlePrint}
            sx={{ mt: 2 }}
            startIcon={<PrintIcon />}
          >
            Print Invoice
          </Button>
        </Stack>
      )}
      <div id="invoice-print">
        <Card
          sx={{
            p: 4,
            width: "210mm",
            minHeight: "297mm",
            margin: "auto",
            position: "relative",
          }}
        >
          <Typography
            sx={{
              position: "absolute",
              top: 20,
              right: 20,
              border: `2px solid ${
                invoice.status === "PAID"
                  ? "green"
                  : invoice.status === "UNPAID"
                    ? "red"
                    : "gray"
              }`,
              px: 2,
              py: 0.5,
              fontWeight: "bold",
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

          <Box
            sx={{
              position: "absolute",
              top: 20,
              left: 20,
              px: 2,
              py: 0.5,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <QRCodeCanvas value={APP_SHOP.googleMapLink} size={90} />
            <Typography fontWeight={"bold"} fontSize={10}>
              Scan for Location
            </Typography>
          </Box>

          <Typography variant="h6" fontWeight="bold" textAlign={"center"}>
            <u>Bill Of Shop</u>
          </Typography>
          <Stack
            sx={{
              alignItems: "center",
              justifyContent: "center",
              mb: 3,
            }}
          >
            <Typography variant="h5" fontWeight="bold">
              {APP_SHOP.name}
            </Typography>
            <Typography variant="body2">
              <i>{APP_SHOP.address}</i>
            </Typography>
            <Stack sx={{ flexDirection: "row", gap: 1 }}>
              <Typography fontSize={14}>
                <i>Tel :</i> <u>{APP_SHOP.phoneNumber}</u>
              </Typography>
              ,
              <Typography fontSize={14}>
                <i>Email :</i> <u>{APP_SHOP.email}</u>
              </Typography>
            </Stack>
          </Stack>

          {/* Invoice Info */}
          <Stack
            direction="row"
            justifyContent="space-between"
            sx={{
              mt: 2,
              border: "1px solid black",
              p: 1,
            }}
          >
            <Typography variant="body2">
              <b>Invoice:</b> {invoice.invoice_number}
            </Typography>
            <Typography variant="body2">
              <b>Date:</b> {invoice.date}
            </Typography>
          </Stack>

          <Stack sx={{ border: "1px solid black" }}>
            <Stack
              sx={{
                flexDirection: "row",
                borderBottom: "1px solid black",
              }}
            >
              <Stack
                sx={{
                  width: "50%",
                  p: 1,
                  py: 1,
                }}
              >
                <Typography textAlign={"center"} sx={{ mb: 1 }}>
                  <b>Bill From:</b>
                </Typography>
                {/* Shop Info */}
                <Typography variant="body2">
                  <b>Shop:</b> {invoice.shop_name}
                </Typography>
                <Typography variant="body2">
                  <b>Phone:</b> {invoice.shop_phone}
                </Typography>
                <Typography variant="body2">
                  <b>Address:</b> {invoice.shop_address}
                </Typography>
              </Stack>

              <Stack
                sx={{
                  width: "50%",
                  borderLeft: "1px solid black",
                  p: 1,
                  py: 1,
                }}
              >
                <Typography textAlign={"center"} sx={{ mb: 1 }}>
                  <b>Bill To:</b>
                </Typography>
                {/* Customer Info */}
                <Typography variant="body2">
                  <b>Customer:</b> {invoice.name}
                </Typography>
                <Typography variant="body2">
                  <b>Phone:</b> {invoice.phone}
                </Typography>
                <Typography variant="body2">
                  <b>Address:</b> {invoice.address}
                </Typography>
              </Stack>
            </Stack>
            <Divider />

            {/* Items Table */}
            <Table size="small">
              <TableHead>
                <TableRow sx={{ background: "#f0f0f0" }}>
                  <TableCell>Sr.</TableCell>
                  <TableCell>
                    <b>Item</b>
                  </TableCell>
                  <TableCell>
                    <b>Qty</b>
                  </TableCell>
                  <TableCell>
                    <b>Price</b>
                  </TableCell>
                  <TableCell>
                    <b>Total</b>
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item, index) => (
                  <TableRow key={item.id}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{item.item_name}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>₹{item.price}</TableCell>
                    <TableCell>₹{item.total}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* <Stack sx={{ borderTop: "1px solid black" }}></Stack> */}

            {/* Summary */}
            <Stack
              sx={{
                width: "50%",
                alignSelf: "end",
              }}
            >
              {/* Sub Total */}
              <Stack
                sx={{
                  border: "1px solid black",
                  flexDirection: "row",
                  gap: 1,
                  p: 0.5,
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    width: "50%",
                    borderRight: "1px solid black",
                  }}
                >
                  Subtotal{" "}
                </Typography>
                <Typography variant="body2">₹{subtotal}</Typography>
              </Stack>

              {/* GST */}
              <Stack
                sx={{
                  border: "1px solid black",
                  flexDirection: "row",
                  gap: 1,
                  p: 0.5,
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    width: "50%",
                    borderRight: "1px solid black",
                  }}
                >
                  GST{" "}
                </Typography>
                <Typography variant="body2">₹{gstAmount}</Typography>
              </Stack>

              {/* Discount */}
              <Stack
                sx={{
                  border: "1px solid black",
                  flexDirection: "row",
                  gap: 1,
                  p: 0.5,
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    width: "50%",
                    borderRight: "1px solid black",
                  }}
                >
                  Discount{" "}
                </Typography>
                <Typography variant="body2">₹{invoice.discount}</Typography>
              </Stack>

              {/* Pending */}
              {invoice.status === "UNPAID" && (
                <Stack
                  sx={{
                    border: "1px solid black",
                    flexDirection: "row",
                    gap: 1,
                    p: 0.5,
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      width: "50%",
                      borderRight: "1px solid red",
                      color: "red",
                    }}
                  >
                    Pending{" "}
                  </Typography>
                  <Typography variant="body2" color="red">
                    ₹{invoice.pending_amount}
                  </Typography>
                </Stack>
              )}

              {/* Grand Total */}
              <Stack
                sx={{
                  border: "1px solid black",
                  flexDirection: "row",
                  gap: 1,
                  p: 0.5,
                }}
              >
                <Typography
                  variant="body2"
                  fontWeight="bold"
                  sx={{
                    width: "50%",
                    borderRight: "1px solid black",
                  }}
                >
                  Grand Total{" "}
                </Typography>
                <Typography fontWeight="bold" variant="body2">
                  ₹{finalTotal}
                </Typography>
              </Stack>
            </Stack>
            <Stack
              sx={{
                p: 1,
                borderTop: "1px solid black",
              }}
            >
              <Typography fontWeight="bold" variant="body2">
                Rupees : {numberToWords(finalTotal).toUpperCase()}
              </Typography>
            </Stack>
          </Stack>
          <Stack mt={1}>
            <Typography fontWeight="bold" variant="body2">
              Terms & Conditions:
            </Typography>

            {APP_SHOP.termsAndConditions.map((term, index) => (
              <Typography key={term.id} variant="body2">
                {index + 1} - {term.text}
              </Typography>
            ))}
          </Stack>

          <Divider sx={{ my: 1 }} />

          <Stack direction="row" justifyContent="flex-end" mt={4}>
            <Box sx={{ width: 260, textAlign: "center" }}>
              <Divider sx={{ borderBottomWidth: 2, mb: 1 }} />
              <Typography fontWeight="bold" variant="body2">
                {APP_SHOP.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Authorized Signature
              </Typography>
            </Box>
          </Stack>
          <Typography
            textAlign="center"
            fontStyle="italic"
            mt={2}
            variant="body2"
            color="#000000c4"
          >
            Thank you for shopping with us, Visit Again!
          </Typography>
        </Card>
      </div>
    </>
  );
}
