import { useRoutes } from "react-router-dom";

import Layout from "../layouts/layout";
import { PATH_DASHBOARD } from "./paths";
import NewInvoice from "../pages/addInvoice";
import Customers from "../pages/customer";
import InvoicePreview from "../pages/preview";
import Dashboard from "../pages/dashboard";
import InvoiceList from "../pages/home";

// ----------------------------------------------------------------------

export function Router() {
  return useRoutes([
    {
      path: "/",
      element: <Layout />,
      children: [
        { path: "/", element: <Dashboard /> },
        { path: PATH_DASHBOARD.invoiceList, element: <InvoiceList /> },
        { path: PATH_DASHBOARD.newInvoice, element: <NewInvoice /> },
        { path: PATH_DASHBOARD.customer, element: <Customers /> },
        { path: PATH_DASHBOARD.preview, element: <InvoicePreview /> },
        {
          path: "/dashboard",
          element: <Dashboard />,
        },
      ],
    },
  ]);
}
