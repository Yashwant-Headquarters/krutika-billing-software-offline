import { AppBar, Stack, Typography } from "@mui/material";
import Toolbar from "@mui/material/Toolbar";
import Button from "@mui/material/Button";
import ReceiptIcon from "@mui/icons-material/Receipt";
import PeopleIcon from "@mui/icons-material/People";
import { APP_COLOR } from "../constant/theme";
import { APP_SHOP } from "../constant/shop";
import { useNavigate } from "react-router-dom";
import { PATH_DASHBOARD } from "../routes/paths";
import DashboardIcon from "@mui/icons-material/Dashboard";
import ViewListIcon from "@mui/icons-material/ViewList";

const NavBar = () => {
  const navigate = useNavigate();
  return (
    <AppBar position="static" sx={{ background: APP_COLOR.primaryNormal }}>
      <Toolbar>
        {/* App Name */}
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          {APP_SHOP.name}
        </Typography>

        {/* Navigation Buttons */}

        <Stack
          sx={{
            display: "flex",
            flexDirection: "row",
            gap: 2,
          }}
        >
          <Button
            variant="contained"
            sx={{
              backgroundColor: APP_COLOR.white,
              color: APP_COLOR.primaryNormal,
            }}
            startIcon={<DashboardIcon />}
            onClick={() => navigate(PATH_DASHBOARD.dashboard)}
          >
            Dashboard
          </Button>

          <Button
            variant="contained"
            sx={{
              backgroundColor: APP_COLOR.white,
              color: APP_COLOR.primaryNormal,
            }}
            startIcon={<ViewListIcon />}
            onClick={() => navigate(PATH_DASHBOARD.invoiceList)}
          >
            Invoice List
          </Button>

          <Button
            variant="contained"
            sx={{
              backgroundColor: APP_COLOR.white,
              color: APP_COLOR.primaryNormal,
            }}
            startIcon={<ReceiptIcon />}
            onClick={() => navigate(PATH_DASHBOARD.newInvoice)}
          >
            New Invoices
          </Button>

          <Button
            variant="contained"
            sx={{
              backgroundColor: APP_COLOR.white,
              color: APP_COLOR.primaryNormal,
            }}
            onClick={() => navigate(PATH_DASHBOARD.customer)}
            startIcon={<PeopleIcon />}
          >
            Customers
          </Button>
        </Stack>
      </Toolbar>
    </AppBar>
  );
};

export { NavBar };
