import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
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
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";

type Product = {
  id: number;
  name: string;
  category: string | null;
  stock_qty: number;
  cost_price: number;
  sale_price: number;
  description: string | null;
};

type StockMovement = {
  id: number;
  movement_type: string;
  quantity: number;
  note: string | null;
  reference_type: string | null;
  created_at: string;
};

const defaultForm = {
  name: "",
  category: "",
  stock_qty: "0",
  cost_price: "0",
  sale_price: "0",
  description: "",
};

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState(defaultForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);

  const loadProducts = async () => {
    const res = await window.electron.invoke("get-products");
    setProducts(res || []);
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;

    if (editingId) {
      await window.electron.invoke("update-product", editingId, {
        ...form,
        stock_qty: Number(form.stock_qty),
        cost_price: Number(form.cost_price),
        sale_price: Number(form.sale_price),
      });
    } else {
      await window.electron.invoke("add-product", {
        ...form,
        stock_qty: Number(form.stock_qty),
        cost_price: Number(form.cost_price),
        sale_price: Number(form.sale_price),
      });
    }

    setForm(defaultForm);
    setEditingId(null);
    await loadProducts();
  };

  const handleEdit = (product: Product) => {
    setEditingId(product.id);
    setForm({
      name: product.name,
      category: product.category || "",
      stock_qty: String(product.stock_qty || 0),
      cost_price: String(product.cost_price || 0),
      sale_price: String(product.sale_price || 0),
      description: product.description || "",
    });
  };

  const handleDelete = async (id: number) => {
    await window.electron.invoke("delete-product", id);
    await loadProducts();
  };

  const handleViewMovements = async (product: Product) => {
    setSelectedProduct(product);
    const res = await window.electron.invoke("get-stock-movements", product.id);
    setMovements(res || []);
  };

  return (
    <Stack spacing={3} p={4}>
      <Typography variant="h4" fontWeight="bold">
        Inventory
      </Typography>
      <Typography color="text.secondary">
        Manage products, stock levels, and stock movement history.
      </Typography>

      <Stack spacing={3}>
        <Card>
          <CardContent>
            <Typography variant="h6" mb={2}>
              {editingId ? "Edit Product" : "Add Product"}
            </Typography>
            <Box
              component="form"
              onSubmit={handleSubmit}
              sx={{ display: "grid", gap: 2 }}
            >
              <TextField
                label="Product Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <TextField
                label="Category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
              <TextField
                label="Stock Qty"
                type="number"
                value={form.stock_qty}
                onChange={(e) =>
                  setForm({ ...form, stock_qty: e.target.value })
                }
              />
              <TextField
                label="Cost Price"
                type="number"
                value={form.cost_price}
                onChange={(e) =>
                  setForm({ ...form, cost_price: e.target.value })
                }
              />
              <TextField
                label="Sale Price"
                type="number"
                value={form.sale_price}
                onChange={(e) =>
                  setForm({ ...form, sale_price: e.target.value })
                }
              />
              <TextField
                label="Description"
                multiline
                minRows={3}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
              <Button
                type="submit"
                variant="contained"
                startIcon={<AddCircleIcon />}
              >
                {editingId ? "Update Product" : "Save Product"}
              </Button>
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" mb={2}>
              Products
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Stock</TableCell>
                    <TableCell>Sale Price</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id} hover>
                      <TableCell>
                        <Typography fontWeight={600}>{product.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {product.description || "No description"}
                        </Typography>
                      </TableCell>
                      <TableCell>{product.category || "-"}</TableCell>
                      <TableCell>
                        <Chip
                          label={product.stock_qty}
                          color={product.stock_qty > 0 ? "success" : "error"}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        ₹{Number(product.sale_price || 0).toFixed(2)}
                      </TableCell>
                      <TableCell align="right">
                        <Stack
                          direction="row"
                          spacing={1}
                          justifyContent="flex-end"
                        >
                          <Button
                            size="small"
                            startIcon={<EditIcon />}
                            onClick={() => handleEdit(product)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            startIcon={<DeleteIcon />}
                            onClick={() => handleDelete(product.id)}
                          >
                            Delete
                          </Button>
                          <Button
                            size="small"
                            onClick={() => handleViewMovements(product)}
                          >
                            History
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Stack>

      {selectedProduct && (
        <Card>
          <CardContent>
            <Typography variant="h6" mb={2}>
              Stock History - {selectedProduct.name}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            {movements.length === 0 ? (
              <Typography color="text.secondary">
                No stock movements yet.
              </Typography>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Qty</TableCell>
                      <TableCell>Note</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {movements.map((movement) => (
                      <TableRow key={movement.id}>
                        <TableCell>{movement.created_at}</TableCell>
                        <TableCell>{movement.movement_type}</TableCell>
                        <TableCell>{movement.quantity}</TableCell>
                        <TableCell>{movement.note || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}
