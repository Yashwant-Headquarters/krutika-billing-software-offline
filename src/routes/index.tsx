import { useRoutes } from "react-router-dom";

import Layout from "../layouts/layout";
import Home from "../pages/home";
import { PATH_DASHBOARD } from "./paths";
import NewInvoice from "../pages/addInvoice";
import Customers from "../pages/customer";
import InvoicePreview from "../pages/preview";

// ----------------------------------------------------------------------

export function Router() {
  return useRoutes([
    {
      path: "/",
      element: <Layout />,
      children: [
        { path: "/", element: <Home /> },
        { path: PATH_DASHBOARD.home, element: <Home /> },
        { path: PATH_DASHBOARD.newInvoice, element: <NewInvoice /> },
        { path: PATH_DASHBOARD.customer, element: <Customers /> },
        { path: PATH_DASHBOARD.preview, element: <InvoicePreview /> },
      ],
    },
  ]);
}
