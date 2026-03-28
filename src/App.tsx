import { HashRouter } from "react-router-dom";
import { Router } from "./routes";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import "./app.css";

function App() {
  return (
    <HashRouter>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <Router />
      </LocalizationProvider>
    </HashRouter>
  );
}

export default App;
