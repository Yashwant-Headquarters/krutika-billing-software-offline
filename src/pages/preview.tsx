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
  const halfGST = invoice.custom_gst / 2;

  const cgstAmount = gstAmount / 2;
  const sgstAmount = gstAmount / 2;

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

          <Typography
            variant="h6"
            fontSize={12}
            textAlign={"center"}
            fontWeight={"bold"}
          >
            GSTIN : {APP_SHOP.GST}
          </Typography>

          <Typography variant="h6" fontWeight="bold" textAlign={"center"}>
            <u>Invoice</u>
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
            <Typography variant="body2">
              <i>{APP_SHOP.city}</i>
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
                  <b>Invoice From:</b>
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
                  <b>Invoice To:</b>
                </Typography>
                {/* Customer Info */}
                <Typography variant="body2">
                  <b>Customer:</b> {invoice.customer_name}
                </Typography>
                <Typography variant="body2">
                  <b>Phone:</b> {invoice.customer_phone}
                </Typography>
                <Typography variant="body2">
                  <b>Address:</b> {invoice.customer_address}
                </Typography>
                {invoice.customer_gstin && (
                  <Typography variant="body2">
                    <b>GSTIN:</b> {invoice.customer_gstin}
                  </Typography>
                )}
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

            <Stack flexDirection={"row"}>
              <Stack
                sx={{
                  width: "50%",
                  p: 2,
                  justifyContent: "space-around",
                }}
              >
                <Typography fontSize={16} fontWeight={"bold"}>
                  Bank Details
                </Typography>
                <Typography variant="body2">
                  <b>Name of A/C :</b> {APP_SHOP.bank.accountName}
                </Typography>
                <Typography variant="body2">
                  <b>Acount No. :</b> {APP_SHOP.bank.accountNumber}
                </Typography>
                <Typography variant="body2">
                  <b>IFSC Code :</b> {APP_SHOP.bank.ifscCode}
                </Typography>
              </Stack>
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
                    p: 0.1,
                    pl: 0.5,
                  }}
                >
                  <Typography
                    variant="body2"
                    fontSize={12}
                    sx={{
                      width: "50%",
                      borderRight: "1px solid black",
                    }}
                  >
                    Subtotal{" "}
                  </Typography>
                  <Typography variant="body2" fontSize={12}>
                    ₹{subtotal}
                  </Typography>
                </Stack>

                {/* Discount */}
                <Stack
                  sx={{
                    border: "1px solid black",
                    flexDirection: "row",
                    gap: 1,
                    p: 0.1,
                    pl: 0.5,
                  }}
                >
                  <Typography
                    variant="body2"
                    fontSize={12}
                    sx={{
                      width: "50%",
                      borderRight: "1px solid black",
                    }}
                  >
                    Discount{" "}
                  </Typography>
                  <Typography variant="body2" fontSize={12}>
                    ₹{invoice.discount}
                  </Typography>
                </Stack>

                {/* Taxable Amount */}
                <Stack
                  sx={{
                    border: "1px solid black",
                    flexDirection: "row",
                    gap: 1,
                    p: 0.1,
                    pl: 0.5,
                  }}
                >
                  <Typography
                    variant="body2"
                    fontSize={12}
                    sx={{
                      width: "50%",
                      borderRight: "1px solid black",
                    }}
                  >
                    Taxable Amount{" "}
                  </Typography>
                  <Typography variant="body2" fontSize={12}>
                    ₹{subtotal - invoice.discount}
                  </Typography>
                </Stack>

                {/* CGST */}
                <Stack
                  sx={{
                    border: "1px solid black",
                    flexDirection: "row",
                    gap: 1,
                    p: 0.1,
                    pl: 0.5,
                  }}
                >
                  <Typography
                    variant="body2"
                    fontSize={12}
                    sx={{
                      width: "50%",
                      borderRight: "1px solid black",
                    }}
                  >
                    CGST ({halfGST}%)
                  </Typography>
                  <Typography variant="body2" fontSize={12}>
                    ₹{cgstAmount}
                  </Typography>
                </Stack>

                {/* SGST */}
                <Stack
                  sx={{
                    border: "1px solid black",
                    flexDirection: "row",
                    gap: 1,
                    p: 0.1,
                    pl: 0.5,
                  }}
                >
                  <Typography
                    variant="body2"
                    fontSize={12}
                    sx={{
                      width: "50%",
                      borderRight: "1px solid black",
                    }}
                  >
                    SGST ({halfGST}%)
                  </Typography>
                  <Typography variant="body2" fontSize={12}>
                    ₹{sgstAmount}
                  </Typography>
                </Stack>
                {/* TOTAL GST */}
                <Stack
                  sx={{
                    border: "1px solid black",
                    flexDirection: "row",
                    gap: 1,
                    p: 0.1,
                    pl: 0.5,
                    background: "#f9f9f9",
                  }}
                >
                  <Typography
                    variant="body2"
                    fontWeight="bold"
                    fontSize={12}
                    sx={{
                      width: "50%",
                      borderRight: "1px solid black",
                    }}
                  >
                    Total GST ({invoice.custom_gst}%)
                  </Typography>
                  <Typography variant="body2" fontWeight="bold" fontSize={12}>
                    ₹{gstAmount}
                  </Typography>
                </Stack>

                {/* Pending */}
                {invoice.status === "UNPAID" && (
                  <Stack
                    sx={{
                      border: "1px solid black",
                      flexDirection: "row",
                      gap: 1,
                      p: 0.1,
                      pl: 0.5,
                    }}
                  >
                    <Typography
                      variant="body2"
                      fontSize={12}
                      sx={{
                        width: "50%",
                        borderRight: "1px solid red",
                        color: "red",
                      }}
                    >
                      Pending{" "}
                    </Typography>
                    <Typography variant="body2" color="red" fontSize={12}>
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
                    p: 0.2,
                  }}
                >
                  <Typography
                    variant="body2"
                    fontWeight="bold"
                    fontSize={12}
                    sx={{
                      width: "50%",
                      borderRight: "1px solid black",
                    }}
                  >
                    Grand Total{" "}
                  </Typography>
                  <Typography fontWeight="bold" variant="body2" fontSize={12}>
                    ₹{finalTotal}
                  </Typography>
                </Stack>
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
