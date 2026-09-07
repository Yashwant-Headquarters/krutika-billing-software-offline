import { Outlet, useLocation } from "react-router-dom";
import { Stack, Typography, useMediaQuery, useTheme } from "@mui/material";
import { useEffect, useRef } from "react";
import { NavBar } from "../component/navBar";
import DesktopAccessDisabledIcon from "@mui/icons-material/DesktopAccessDisabled";

const Layout = () => {
  const theme = useTheme();
  const location = useLocation();
  const mainBoxRef = useRef<HTMLDivElement | null>(null);
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  useEffect(() => {
    if (mainBoxRef.current) {
      mainBoxRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [location.pathname, location.hash]);
  return isMobile ? (
    <Stack
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
      }}
    >
      <DesktopAccessDisabledIcon
        sx={{ fontSize: 80, color: theme.palette.primary.main }}
      />

      <Typography variant="h6" fontWeight={600}>
        Big Screen Required
      </Typography>

      <Typography
        variant="body2"
        color="text.secondary"
        textAlign={"center"}
        mt={2}
        px={5}
      >
        This software is not supported on small screens. Please open it on a
        laptop or desktop screen.
      </Typography>
    </Stack>
  ) : (
    <Stack
      className="mainBox"
      ref={mainBoxRef}
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        overflowY: "scroll",
        "&::-webkit-scrollbar": {
          width: "8px",
        },
        "&::-webkit-scrollbar-track": {
          backgroundColor: theme.palette.common.white,
        },
        "&::-webkit-scrollbar-thumb": {
          backgroundColor: theme.palette.primary.main,
          borderRadius: "10px",
        },
        "&::-webkit-scrollbar-thumb:hover": {
          backgroundColor: theme.palette.primary.dark,
        },
      }}
    >
      <Stack direction="row" sx={{ minHeight: "100vh" }}>
        <NavBar />
        <Stack
          sx={{
            flex: 1,
            minWidth: 0,
            backgroundColor: theme.palette.grey[100],
          }}
        >
          <Outlet />
        </Stack>
      </Stack>
    </Stack>
  );
};

export default Layout;
