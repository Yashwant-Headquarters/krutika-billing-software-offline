import { useEffect, useRef, useState } from "react";
import {
  TextField,
  Button,
  Stack,
  Typography,
  Card,
  IconButton,
  Divider,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import { APP_SHOP } from "../constant/shop";
import Autocomplete from "@mui/material/Autocomplete";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";
import { MenuItem } from "@mui/material";
import { PATH_DASHBOARD } from "../routes/paths";
import { useNavigate, useSearchParams } from "react-router-dom";

type Item = {
  item_name: string;
  quantity: number;
  price: number;
};

const MAX_INVOICE_ITEMS = 15;

const getIndiaDate = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(new Date());

const generateInvoiceNumber = () => {
  const now = new Date();

  const indiaTime = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }),
  );

  const year = indiaTime.getFullYear();
  const month = String(indiaTime.getMonth() + 1).padStart(2, "0");
  const day = String(indiaTime.getDate()).padStart(2, "0");
  const hours = String(indiaTime.getHours()).padStart(2, "0");
  const minutes = String(indiaTime.getMinutes()).padStart(2, "0");
  const seconds = String(indiaTime.getSeconds()).padStart(2, "0");

  return `INV-${year}${month}${day}-${hours}${minutes}${seconds}`;
};

export default function NewInvoice() {
  const navigate = useNavigate();
  const [invoiceNumber, setInvoiceNumber] = useState(generateInvoiceNumber());
  const [customerOptions, setCustomerOptions] = useState<any[]>([]);
  const [itemOptions, setItemOptions] = useState<any[]>([]);
  const customerRef = useRef<HTMLInputElement | null>(null);
  const [openSnackbar, setOpenSnackbar] = useState(false);

  const toMoney = (num: number) => Number(num.toFixed(2));

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [status, setStatus] = useState("PAID");
  const [paidAmount, setPaidAmount] = useState(0);

  const [date, setDate] = useState(getIndiaDate());

  const [customGst, setCustomGst] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [customerGST, setCustomerGST] = useState("");

  const [items, setItems] = useState<Item[]>([
    { item_name: "", quantity: 1, price: 0 },
  ]);

  const [params] = useSearchParams();
  const editId = params.get("edit");

  useEffect(() => {
    if (editId) {
      loadInvoice(editId);
    }
  }, [editId]);

  //
  // Load Function
  //

  const loadInvoice = async (id: string) => {
    const res = await window.electron.invoke("get-invoice-details", Number(id));

    const { invoice, items } = res;

    setInvoiceNumber(invoice.invoice_number);
    setCustomerName(invoice.customer_name);
    setCustomerPhone(invoice.customer_phone);
    setCustomerAddress(invoice.customer_address);
    setDate(invoice.date);
    setCustomGst(invoice.custom_gst);
    setDiscount(invoice.discount);
    setStatus(invoice.status);
    setPaidAmount(Number(invoice.paid_amount || 0));
    setCustomerGST(invoice.customer_gstin || "");

    setItems(
      items.map((i: any) => ({
        item_name: i.item_name,
        quantity: i.quantity,
        price: i.price,
      })),
    );
  };

  /* =========================
     CALCULATIONS
  ========================= */
  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.price,
    0,
  );

  // ✅ Discount cannot exceed subtotal
  const safeDiscount = Math.min(discount, subtotal);

  // ✅ Taxable value (REAL GST BASE)
  const taxableAmount = subtotal - safeDiscount;

  // ✅ GST on taxable value
  const gstAmount = toMoney((taxableAmount * customGst) / 100);

  // ✅ Final total
  const finalTotal = toMoney(taxableAmount + gstAmount);

  /* =========================
     VALIDATION
  ========================= */

  const isFormValid =
    customerName?.trim() !== "" &&
    customerPhone?.trim() !== "" &&
    items.length > 0 &&
    items.length <= MAX_INVOICE_ITEMS &&
    items.every(
      (item) =>
        item.item_name.trim() !== "" && item.quantity > 0 && item.price > 0,
    );

  const handleCloseSnackbar = () => {
    setOpenSnackbar(false);
  };

  /* =========================
     ITEM HANDLERS
  ========================= */

  const handleItemChange = (
    index: number,
    field: keyof Item,
    value: string,
  ) => {
    const updated = [...items];
    if (field === "item_name") {
      updated[index][field] = value as any;
    } else {
      updated[index][field] = Number(value) as any;
    }
    setItems(updated);
  };

  const addItem = () => {
    if (items.length >= MAX_INVOICE_ITEMS) return;
    setItems([...items, { item_name: "", quantity: 1, price: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  /* =========================
     CLEAR FUNCTION
  ========================= */

  const handleClear = () => (
    setInvoiceNumber(generateInvoiceNumber()),
    setCustomerName(""),
    setCustomerPhone(""),
    setCustomerAddress(""),
    setItems([{ item_name: "", quantity: 1, price: 0 }]),
    setCustomGst(0),
    setDiscount(0),
    setCustomerOptions([]),
    setItemOptions([]),
    setPaidAmount(0)
  );

  /* =========================
     SAVE FUNCTION
  ========================= */

  const handleSave = async () => {
    if (!isFormValid) return;

    const payload = {
      invoice_number: invoiceNumber,
      shop_name: APP_SHOP.name,
      shop_phone: APP_SHOP.phoneNumber,
      shop_address: APP_SHOP.address,
      customer: {
        name: customerName,
        phone: customerPhone,
        address: customerAddress,
        gstin: customerGST || null,
      },
      date,
      custom_gst: customGst,
      discount,
      paidAmount: status === "PAID" ? finalTotal : paidAmount,
      pending_amount: status == "UNPAID" ? finalTotal - paidAmount : 0,
      status,
      items,
    };

    if (editId) {
      await window.electron.invoke("update-invoice", Number(editId), payload);
      navigate(-1);
    } else {
      await window.electron.invoke("save-invoice", payload);
    }

    setOpenSnackbar(true);
    handleClear();
  };

  /* =========================
     SAVE AND PRINT FUNCTION
  ========================= */

  const handleSaveAndPrint = async () => {
    if (!isFormValid) return;

    const payload = {
      invoice_number: invoiceNumber,
      shop_name: APP_SHOP.name,
      shop_phone: APP_SHOP.phoneNumber,
      shop_address: APP_SHOP.address,
      customer: {
        name: customerName,
        phone: customerPhone,
        address: customerAddress,
        gstin: customerGST || null,
      },
      date,
      custom_gst: customGst,
      discount,
      paidAmount: status === "PAID" ? finalTotal : paidAmount,
      pending_amount: status == "UNPAID" ? finalTotal - paidAmount : 0,
      status,
      items,
    };

    const id = editId
      ? await window.electron.invoke("update-invoice", Number(editId), payload)
      : await window.electron.invoke("save-invoice", payload);

    setOpenSnackbar(true);
    handleClear();

    navigate(
      PATH_DASHBOARD.preview
        .replace(":invoiceId", String(editId || id))
        .replace(":isPrint", String(true)),
    );
  };

  const buildWhatsAppMessage = () => {
    const lines = [
      `Hello ${customerName || "Customer"},`,
      `Your invoice has been generated successfully.`,
      "",

      `Invoice No: ${invoiceNumber}`,
      `Date: ${date}`,
      `Status: ${status}`,
      "",

      `Customer: ${customerName}`,
      `Phone: ${customerPhone}`,
      `Address: ${customerAddress}`,
      "",

      `Items:`,
      ...items.map(
        (item, index) =>
          `${index + 1}. ${item.item_name} x${item.quantity} @ ₹${item.price.toFixed(
            2,
          )} = ₹${(item.quantity * item.price).toFixed(2)}`,
      ),

      "",
      `Subtotal: ₹${toMoney(subtotal).toFixed(2)}`,
      `GST (${customGst}%): ₹${toMoney(gstAmount).toFixed(2)}`,
      `Discount: ₹${toMoney(discount).toFixed(2)}`,
      `Grand Total: ₹${toMoney(finalTotal).toFixed(2)}`,

      status === "UNPAID"
        ? `Pending Amount: ₹${toMoney(finalTotal - paidAmount).toFixed(2)}`
        : "",

      "",
      `Shop: ${APP_SHOP.name}`,
      `Phone: ${APP_SHOP.phoneNumber}`,

      "",
      "Thank you for your business!",
    ];

    return lines.filter(Boolean).join("\n");
  };

  const handleSaveAndSendWhatsApp = async () => {
    if (!isFormValid) return;

    const payload = {
      invoice_number: invoiceNumber,
      shop_name: APP_SHOP.name,
      shop_phone: APP_SHOP.phoneNumber,
      shop_address: APP_SHOP.address,
      customer: {
        name: customerName,
        phone: customerPhone,
        address: customerAddress,
        gstin: customerGST || null,
      },
      date,
      custom_gst: customGst,
      discount,
      paidAmount: status === "PAID" ? finalTotal : paidAmount,
      pending_amount: status == "UNPAID" ? finalTotal - paidAmount : 0,
      status,
      items,
    };

    await (editId
      ? window.electron.invoke("update-invoice", Number(editId), payload)
      : window.electron.invoke("save-invoice", payload));

    if (!customerPhone.trim()) {
      alert("Customer phone number required for WhatsApp message.");
      return;
    }

    const phoneNumber = customerPhone.replace(/[^0-9]/g, "");
    const encoded = encodeURIComponent(buildWhatsAppMessage());
    const whatsappUrl =
      phoneNumber.length >= 8
        ? `https://wa.me/${phoneNumber}?text=${encoded}`
        : `https://web.whatsapp.com/send?text=${encoded}`;

    await window.electron.invoke("open-external", whatsappUrl);

    setOpenSnackbar(true);
    handleClear();

    if (editId) {
      navigate(-1);
    }
  };

  const handleItemSearch = async (value: string) => {
    if (value.length >= 2) {
      const result = await window.electron.invoke("search-items", value);
      setItemOptions(result);
    } else {
      setItemOptions([]);
    }
  };

  const handleCustomerSearch = async (value: string) => {
    setCustomerName(value);

    if (value.length >= 3) {
      const result = await window.electron.invoke("search-customers", value);
      setCustomerOptions(result);
    } else {
      setCustomerOptions([]);
    }
  };

  return (
    <Stack spacing={4} p={4} maxWidth={800} margin="auto">
      <Typography variant="h4" fontWeight="bold">
        {editId ? "Update Invoice" : "Create New Invoice"}
      </Typography>

      {/* Shop Info */}
      <Card sx={{ p: 3, background: "#f5f5f5" }}>
        <Stack spacing={0.5}>
          <Typography>GSTIN : {APP_SHOP.GST}</Typography>
          <Typography fontWeight="bold">{APP_SHOP.name}</Typography>
          <Typography>{APP_SHOP.phoneNumber}</Typography>
          <Typography>{APP_SHOP.address}</Typography>
        </Stack>
      </Card>

      {/* Customer Info */}
      <Card sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Autocomplete
            freeSolo
            options={customerOptions}
            value={customerName}
            getOptionLabel={(option) =>
              typeof option === "string"
                ? option
                : `${option.name} - ${option.phone} - ${option.address}`
            }
            onInputChange={(_, value, reason) => {
              if (reason === "input") {
                setCustomerName(value);
                handleCustomerSearch(value);
              }
            }}
            onChange={(_, value: any) => {
              if (typeof value === "string") {
                setCustomerName(value);
              } else if (value && typeof value !== "string") {
                setCustomerName(value.name || "");
                setCustomerPhone(value.phone || "");
                setCustomerAddress(value.address || "");
                if (value.gstin) {
                  setCustomerGST(value.gstin);
                }
              }
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Customer Name *"
                inputRef={customerRef}
                error={customerName === ""}
              />
            )}
          />

          <TextField
            label="Customer Phone *"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            error={customerPhone === ""}
          />

          <TextField
            label="Customer Address"
            value={customerAddress}
            onChange={(e) => setCustomerAddress(e.target.value)}
          />

          <TextField
            label="Customer GSTIN (Optional)"
            value={customerGST}
            onChange={(e) => setCustomerGST(e.target.value.toUpperCase())}
          />

          <TextField
            label="Invoice Number"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
          />

          <TextField
            type="date"
            label="Date"
            InputLabelProps={{ shrink: true }}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />

          <TextField
            select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            fullWidth
            sx={{
              "& .MuiSelect-select": {
                color:
                  status === "PAID"
                    ? "green"
                    : status === "UNPAID"
                      ? "red"
                      : "gray",
                fontWeight: "bold",
              },
            }}
          >
            <MenuItem value="PAID" sx={{ color: "green" }}>
              PAID
            </MenuItem>

            <MenuItem value="UNPAID" sx={{ color: "red" }}>
              UNPAID
            </MenuItem>

            <MenuItem value="CANCEL" sx={{ color: "gray" }}>
              CANCEL
            </MenuItem>
          </TextField>
        </Stack>
      </Card>

      {/* Items */}
      <Card sx={{ p: 3 }}>
        <Typography variant="h6">Items</Typography>
        <Divider sx={{ my: 2 }} />

        <Stack spacing={2}>
          {items.map((item, index) => (
            <Stack key={index} direction="row" spacing={2} alignItems="center">
              <Autocomplete
                // key={item.item_name === "" ? "empty" : "filled"}
                freeSolo
                options={itemOptions}
                value={item.item_name}
                getOptionLabel={(option) =>
                  typeof option === "string"
                    ? option
                    : `${option.name} - ₹${option.price}`
                }
                onInputChange={(_, value, reason) => {
                  if (reason === "input") {
                    handleItemChange(index, "item_name", value);
                    handleItemSearch(value);
                  }
                }}
                onChange={(_, value: any) => {
                  if (typeof value === "string") {
                    handleItemChange(index, "item_name", value);
                  } else if (value && typeof value !== "string") {
                    const updated = [...items];
                    updated[index].item_name = value.name || "";
                    if (value.price !== undefined) {
                      updated[index].price = Number(value.price) || 0;
                    }
                    setItems(updated);
                  }
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Item Name *"
                    error={item.item_name === ""}
                  />
                )}
                sx={{ flex: 3 }}
              />

              <TextField
                type="number"
                label="Qty *"
                value={item.quantity}
                onChange={(e) =>
                  handleItemChange(index, "quantity", e.target.value)
                }
                sx={{
                  flex: 1,
                  "& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button":
                    {
                      display: "none",
                    },
                  "& input[type=number]": {
                    MozAppearance: "textfield",
                  },
                }}
              />

              <TextField
                type="number"
                label="Price *"
                value={item.price}
                onChange={(e) =>
                  handleItemChange(index, "price", e.target.value)
                }
                sx={{
                  flex: 1,
                  "& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button":
                    {
                      display: "none",
                    },
                  "& input[type=number]": {
                    MozAppearance: "textfield",
                  },
                }}
              />

              <Typography
                sx={{
                  flex: 1,
                  fontWeight: "bold",
                  textAlign: "right",
                  minWidth: 80,
                }}
              >
                ₹{(item.quantity * item.price).toFixed(2)}
              </Typography>

              <IconButton color="error" onClick={() => removeItem(index)}>
                <DeleteIcon />
              </IconButton>
            </Stack>
          ))}

          <Button
            startIcon={<AddIcon />}
            onClick={addItem}
            disabled={items.length >= MAX_INVOICE_ITEMS}
          >
            Add Item
          </Button>
          <Typography variant="caption" color="text.secondary">
            {items.length}/{MAX_INVOICE_ITEMS} items
          </Typography>
        </Stack>
      </Card>

      {/* Charges & Summary */}
      <Card sx={{ p: 3 }}>
        <Stack spacing={2}>
          <TextField
            type="number"
            label="GST %"
            value={customGst}
            onChange={(e) => setCustomGst(Number(e.target.value))}
            sx={{
              "& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button":
                {
                  display: "none",
                },
              "& input[type=number]": {
                MozAppearance: "textfield",
              },
            }}
          />

          <TextField
            type="number"
            label="Discount ₹"
            value={discount}
            onChange={(e) => {
              const value = Number(e.target.value);
              const maxDiscount = subtotal;

              if (value > maxDiscount) {
                setDiscount(maxDiscount);
              } else {
                setDiscount(value);
              }
            }}
            sx={{
              "& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button":
                {
                  display: "none",
                },
              "& input[type=number]": {
                MozAppearance: "textfield",
              },
            }}
            error={discount > subtotal + gstAmount}
            helperText={
              discount > subtotal + gstAmount
                ? "Discount cannot exceed total amount"
                : ""
            }
          />
          {status === "UNPAID" && (
            <TextField
              type="number"
              label="Paid Amount - How much customer paid?"
              value={paidAmount}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (value > finalTotal) {
                  setPaidAmount(finalTotal);
                } else {
                  setPaidAmount(value);
                }
              }}
              error={paidAmount > finalTotal}
              helperText={
                paidAmount > finalTotal ? "Paid amount cannot exceed total" : ""
              }
              fullWidth
              sx={{
                "& input::-webkit-outer-spin-button, & input::-webkit-inner-spin-button":
                  {
                    display: "none",
                  },
                "& input[type=number]": {
                  MozAppearance: "textfield",
                },
              }}
            />
          )}

          <Divider />

          <Typography variant="body2">
            Subtotal: ₹{toMoney(subtotal)}
          </Typography>
          <Typography variant="body2">
            Taxable Amount: ₹{toMoney(taxableAmount)}
          </Typography>
          <Typography variant="body2">
            CGST Amount: ₹{toMoney(gstAmount / 2)}
          </Typography>
          <Typography variant="body2">
            SGST Amount: ₹{toMoney(gstAmount / 2)}
          </Typography>
          <Typography variant="body2">
            Total GST Amount: ₹{toMoney(gstAmount)}
          </Typography>
          <Typography variant="body2">
            Discount Amount: ₹{toMoney(discount)}
          </Typography>
          <Typography fontWeight="bold" fontSize={18}>
            Total: ₹{finalTotal}
          </Typography>
          {status === "UNPAID" && (
            <Typography fontWeight="bold" fontSize={18}>
              Pending: ₹{toMoney(finalTotal - paidAmount)}
            </Typography>
          )}
        </Stack>
      </Card>

      <Stack
        sx={{
          flexDirection: { xs: "column", sm: "row" },
          gap: 2,
        }}
      >
        <Button
          variant="outlined"
          size="large"
          disabled={!isFormValid}
          onClick={handleSave}
        >
          {editId ? "Update Invoice" : "Save Invoice"}
        </Button>

        <Button
          variant="contained"
          size="large"
          disabled={!isFormValid}
          onClick={handleSaveAndPrint}
        >
          {editId ? "Update & Print" : "Save & Print"}
        </Button>

        <Button
          variant="contained"
          color="success"
          size="large"
          disabled={!isFormValid}
          onClick={handleSaveAndSendWhatsApp}
          startIcon={<WhatsAppIcon />}
        >
          {editId ? "Update & WhatsApp" : "Save & WhatsApp"}
        </Button>
      </Stack>

      <Snackbar
        open={openSnackbar}
        autoHideDuration={2000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MuiAlert
          elevation={6}
          variant="filled"
          severity="success"
          onClose={handleCloseSnackbar}
        >
          Invoice Saved Successfully
        </MuiAlert>
      </Snackbar>
    </Stack>
  );
}
