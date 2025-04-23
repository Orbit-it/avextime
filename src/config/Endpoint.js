import { Dashboard } from "@mui/icons-material";

const baseUri = "http://localhost:5000/api";
const server = "http://localhost:5000";

const Endpoint = {
    inventory: `${baseUri}/inventory`,  
    websocket: server, // WebSocket URL
    employees: `${baseUri}/employees`,
    departments: `${baseUri}/departments`,
    layoffs: `${baseUri}/layoffs`,
    holidays: `${baseUri}/holidays`,
    login: `${baseUri}/login`,
    pointage: `${baseUri}/manual-attendance`,
    weeks: `${baseUri}/weekly-attendance`,
    pointagesSummary: `${baseUri}/summary`,
    dashboard: `${baseUri}/dashboard`,
    notif: `${baseUri}/notif`,
    shift: `${baseUri}/shifts`,
    machine: `${baseUri}/machines`
};

export default { Endpoint, baseUri, server };
  
  