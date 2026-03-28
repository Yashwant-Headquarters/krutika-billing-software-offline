import { useRef, useState } from "react";
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
import { APP_SHOP } from "../constant/shop";
import Autocomplete from "@mui/material/Autocomplete";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";

type Item = {
  item_name: string;
  quantity: number;
  price: number;
};

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
  const [invoiceNumber, setInvoiceNumber] = useState(generateInvoiceNumber());
  const [customerOptions, setCustomerOptions] = useState<any[]>([]);
  const [itemOptions, setItemOptions] = useState<any[]>([]);
  const customerRef = useRef<HTMLInputElement | null>(null);
  const [openSnackbar, setOpenSnackbar] = useState(false);

  const toMoney = (num: number) => Number(num.toFixed(2));

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");

  const [date, setDate] = useState(getIndiaDate());

  const [customGst, setCustomGst] = useState(0);
  const [discount, setDiscount] = useState(0);

  const [items, setItems] = useState<Item[]>([
    { item_name: "", quantity: 1, price: 0 },
  ]);

  /* =========================
     CALCULATIONS
  ========================= */

  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.price,
    0,
  );

  const gstAmount = toMoney((subtotal * customGst) / 100);
  const finalTotal = toMoney(subtotal + gstAmount - discount);

  /* =========================
     VALIDATION
  ========================= */

  const isFormValid =
    customerName.trim() !== "" &&
    customerPhone.trim() !== "" &&
    items.length > 0 &&
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
    setItems([...items, { item_name: "", quantity: 1, price: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

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
      },
      date,
      custom_gst: customGst,
      discount,
      items,
    };

    await window.electron.invoke("save-invoice", payload);

    setOpenSnackbar(true);

    // ✅ RESET FORM
    setInvoiceNumber(generateInvoiceNumber());
    setCustomerName("");
    setCustomerPhone("");
    setCustomerAddress("");
    setItems([{ item_name: "", quantity: 1, price: 0 }]);
    setCustomGst(0);
    setDiscount(0);
    setCustomerOptions([]);
    setItemOptions([]);
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
        Create New Invoice
      </Typography>

      {/* Shop Info */}
      <Card sx={{ p: 3, background: "#f5f5f5" }}>
        <Stack spacing={0.5}>
          <Typography fontWeight="bold">{APP_SHOP.name}</Typography>
          <Typography>{APP_SHOP.phoneNumber}</Typography>
          <Typography>{APP_SHOP.address}</Typography>
        </Stack>
      </Card>

      {/* Customer Info */}
      <Card sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Autocomplete
            // key={customerName === "" ? "empty" : "filled"}
            freeSolo
            options={customerOptions}
            value={customerName}
            getOptionLabel={(option) =>
              typeof option === "string"
                ? option
                : `${option.name} - ${option.phone} - ${option.address}`
            }
            onInputChange={(_, value) => {
              setCustomerName(value);
              handleCustomerSearch(value);
            }}
            onChange={(_, value: any) => {
              if (value && typeof value !== "string") {
                setCustomerName(value.name);
                setCustomerPhone(value.phone);
                setCustomerAddress(value.address);
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
                onInputChange={(_, value) => {
                  handleItemChange(index, "item_name", value);
                  handleItemSearch(value);
                }}
                onChange={(_, value: any) => {
                  if (value && typeof value !== "string") {
                    const updated = [...items];
                    updated[index].item_name = value.name;
                    updated[index].price = value.price;
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

          <Button startIcon={<AddIcon />} onClick={addItem}>
            Add Item
          </Button>
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
            onChange={(e) => setDiscount(Number(e.target.value))}
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

          <Divider />

          <Typography>Subtotal: ₹{toMoney(subtotal)}</Typography>
          <Typography>GST: ₹{gstAmount}</Typography>
          <Typography fontWeight="bold" fontSize={18}>
            Total: ₹{finalTotal}
          </Typography>
        </Stack>
      </Card>

      <Button
        variant="contained"
        size="large"
        disabled={!isFormValid}
        onClick={handleSave}
      >
        Save Invoice
      </Button>
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
