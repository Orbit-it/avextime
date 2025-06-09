import { Dashboard } from "@mui/icons-material";

const baseUri = "http://192.168.100.170:5050/api";
const server = "http://192.168.100.170:5050";

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
    machine: `${baseUri}/machines`,
    attendance: `${baseUri}/attendances`,
};

export default { Endpoint, baseUri, server };
  
  