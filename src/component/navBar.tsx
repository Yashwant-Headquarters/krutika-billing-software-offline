import { Box, Button, Divider, Stack, Typography } from "@mui/material";
import ReceiptIcon from "@mui/icons-material/Receipt";
import PeopleIcon from "@mui/icons-material/People";
import ContactPageIcon from "@mui/icons-material/ContactPage";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import DashboardIcon from "@mui/icons-material/Dashboard";
import ViewListIcon from "@mui/icons-material/ViewList";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import { APP_COLOR } from "../constant/theme";
import { APP_SHOP } from "../constant/shop";
import { useLocation, useNavigate } from "react-router-dom";
import { PATH_DASHBOARD } from "../routes/paths";

const NavBar = () => {
  const navigate = useNavigate();
  const location = useLocation();

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

  const isActive = (path: string) =>
    location.pathname === path ||
    (path !== "/" && location.pathname.startsWith(path));

  return (
    <Box
      component="aside"
      sx={{
        width: 248,
        flexShrink: 0,
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: `linear-gradient(180deg, ${APP_COLOR.primaryNormal} 0%, #1256a0 100%)`,
        color: "white",
        px: 2,
        py: 3,
        overflowY: "auto",
        overflowX: "hidden",
        "&::-webkit-scrollbar": {
          width: "6px",
        },
        "&::-webkit-scrollbar-thumb": {
          backgroundColor: "rgba(255,255,255,.25)",
          borderRadius: "10px",
        },
      }}
    >
      <Stack spacing={3} sx={{ flex: 1 }}>
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
            textTransform: "none",
            fontWeight: 700,
            background: "white",
            color: APP_COLOR.primaryNormal,
            boxShadow: "0 6px 18px rgba(0,0,0,.18)",
            "&:hover": { background: "#eef4ff" },
          }}
        >
          Create invoice
        </Button>

        <Divider sx={{ borderColor: "rgba(255,255,255,.18)" }} />

        <Stack spacing={0.5}>
          {items.map((item) => {
            const active = isActive(item.path);
            return (
              <Button
                key={item.label}
                fullWidth
                startIcon={item.icon}
                onClick={() => navigate(item.path)}
                sx={{
                  justifyContent: "flex-start",
                  color: active ? "white" : "rgba(255,255,255,.82)",
                  px: 1.5,
                  py: 1.1,
                  borderRadius: 2,
                  fontWeight: active ? 700 : 500,
                  background: active ? "rgba(255,255,255,.18)" : "transparent",
                  borderLeft: active
                    ? "3px solid #fff"
                    : "3px solid transparent",
                  transition: "all .2s ease",
                  "&:hover": {
                    background: "rgba(255,255,255,.12)",
                    color: "white",
                  },
                }}
              >
                {item.label}
              </Button>
            );
          })}
        </Stack>
      </Stack>

      <Box sx={{ px: 1, pt: 3 }}>
        <Typography variant="caption" sx={{ opacity: 0.6 }}>
          {APP_SHOP.name} • Offline
        </Typography>
      </Box>
    </Box>
  );
};

export { NavBar };
