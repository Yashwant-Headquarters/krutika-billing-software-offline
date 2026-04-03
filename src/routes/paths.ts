// ----------------------------------------------------------------------

function path(root: string, subLink: string) {
  return `${root}${subLink}`;
}

const ROOTS_APP = "/app";
const ROOTS_DASHBOARD = "";

// ----------------------------------------------------------------------

export const PATH_DASHBOARD = {
  root: ROOTS_DASHBOARD,
  app: path(ROOTS_APP, "/app"),
  invoiceList: path(ROOTS_DASHBOARD, "/invoice-list"),
  newInvoice: path(ROOTS_DASHBOARD, "/new-invoice"),
  preview: path(ROOTS_DASHBOARD, "/preview/:invoiceId/:isPrint"),
  edit: path(ROOTS_DASHBOARD, "/update-invoice/:editId"),
  customer: path(ROOTS_DASHBOARD, "/customer"),
  dashboard: path(ROOTS_DASHBOARD, "/dashboard"),
};
