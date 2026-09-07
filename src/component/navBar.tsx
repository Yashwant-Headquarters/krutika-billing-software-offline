import { Box, Button, Divider, Stack, Typography } from "@mui/material";
import ReceiptIcon from "@mui/icons-material/Receipt";
import PeopleIcon from "@mui/icons-material/People";
import ContactPageIcon from "@mui/icons-material/ContactPage";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import { APP_COLOR } from "../constant/theme";
import { APP_SHOP } from "../constant/shop";
import { useNavigate } from "react-router-dom";
import { PATH_DASHBOARD } from "../routes/paths";
import DashboardIcon from "@mui/icons-material/Dashboard";
import ViewListIcon from "@mui/icons-material/ViewList";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";

const NavBar = () => {
  const navigate = useNavigate();
  const items = [
    {
      label: "Dashboard",
      icon: <DashboardIcon />,
      path: PATH_DASHBOARD.dashboard,
    },
    {
      label: "Invoices",
      icon: <ViewListIcon />,
      path: PATH_DASHBOARD.invoiceList,
    },
    {
      label: "New invoice",
      icon: <ReceiptIcon />,
      path: PATH_DASHBOARD.newInvoice,
    },
    { label: "Customers", icon: <PeopleIcon />, path: PATH_DASHBOARD.customer },
    { label: "CRM", icon: <ContactPageIcon />, path: PATH_DASHBOARD.crm },
    {
      label: "Accounting",
      icon: <AccountBalanceIcon />,
      path: PATH_DASHBOARD.accounting,
    },
  ];

  return (
    <Box
      component="aside"
      sx={{
        width: 248,
        flexShrink: 0,
        background: APP_COLOR.primaryNormal,
        color: "white",
        minHeight: "100vh",
        px: 2,
        py: 3,
      }}
    >
      <Stack spacing={3}>
        <Box sx={{ px: 1 }}>
          <Typography
            variant="overline"
            sx={{ opacity: 0.7, letterSpacing: 1.5 }}
          >
            Billing workspace
          </Typography>
          <Typography variant="h6" fontWeight={800} noWrap>
            {APP_SHOP.name}
          </Typography>
        </Box>
        <Button
          fullWidth
          variant="contained"
          startIcon={<AddCircleOutlineIcon />}
          onClick={() => navigate(PATH_DASHBOARD.newInvoice)}
          sx={{
            justifyContent: "flex-start",
            py: 1.2,
            background: "white",
            color: APP_COLOR.primaryNormal,
            "&:hover": { background: "#eef4ff" },
          }}
        >
          Create invoice
        </Button>
        <Divider sx={{ borderColor: "rgba(255,255,255,.18)" }} />
        <Stack spacing={0.5}>
          {items.map((item) => (
            <Button
              key={item.label}
              fullWidth
              startIcon={item.icon}
              onClick={() => navigate(item.path)}
              sx={{
                justifyContent: "flex-start",
                color: "rgba(255,255,255,.82)",
                px: 1.5,
                py: 1.1,
                borderRadius: 2,
                "&:hover": {
                  background: "rgba(255,255,255,.12)",
                  color: "white",
                },
              }}
            >
              {item.label}
            </Button>
          ))}
        </Stack>
      </Stack>
    </Box>
  );
};

export { NavBar };
