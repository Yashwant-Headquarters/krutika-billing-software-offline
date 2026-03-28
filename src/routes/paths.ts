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
  home: path(ROOTS_DASHBOARD, "/home"),
  newInvoice: path(ROOTS_DASHBOARD, "/new-invoice"),
  preview: path(ROOTS_DASHBOARD, "/preview/:invoiceId"),
  customer: path(ROOTS_DASHBOARD, "/customer"),
};
