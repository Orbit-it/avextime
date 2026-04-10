import React, { useState } from 'react';
import { Box, CssBaseline, Drawer, List, Card, CardContent, Grid, Toolbar, TextField, Button, Typography, IconButton } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';

import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import fr from 'date-fns/locale/fr';
import 'react-big-calendar/lib/css/react-big-calendar.css';

import EmployeeAttendanceStats from '../components/Stats';
import EmployeeList from '../components/EmployeesList';
import DepartmentComponent from '../components/Departments';
import Planning from '../components/Planning';
import CalendarView from '../components/CalendarView';
import EmployeeLayoffComponent from '../components/Layoff.tsx';
import ToolLossComponent from '../components/Perte.tsx';
import ManualAttendance from '../components/ManualAttendance';

// Icônes
import PeopleIcon from '@mui/icons-material/People';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import ScheduleIcon from '@mui/icons-material/Schedule';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import CrisisAlertIcon from '@mui/icons-material/CrisisAlert';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import SickIcon from '@mui/icons-material/Sick';
import AssignmentIcon from '@mui/icons-material/Assignment';
import DepartmentIcon from '@mui/icons-material/LocalPostOffice';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import FlakyIcon from '@mui/icons-material/Flaky';
import TroubleshootIcon from '@mui/icons-material/Troubleshoot';

const drawerWidth = 150;

const GestionRh = () => {
  const [selectedMenuItem, setSelectedMenuItem] = useState('Le Personnel');
  const [holidays, setHolidays] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [holidayDescription, setHolidayDescription] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(true); // État pour afficher/masquer le drawer

  const toggleDrawer = () => {
    setDrawerOpen(!drawerOpen);
  };

  const addHoliday = () => {
    if (selectedDate && holidayDescription) {
      const newHoliday = {
        title: holidayDescription,
        start: selectedDate,
        end: selectedDate,
        allDay: true,
      };
      setHolidays([...holidays, newHoliday]);
      setSelectedDate(null);
      setHolidayDescription('');
    }
  };

  const renderSelectedComponent = () => {
    switch (selectedMenuItem) {
      case 'Indisponibilités':
        return <EmployeeLayoffComponent />;
      case 'Le Personnel':
        return <EmployeeList />;
      case 'Statistiques':
        return <EmployeeAttendanceStats />;  // Partie Statistiques à implémenter
      case 'Pointage Manuel':
        return <ManualAttendance />;
      case 'Perte Outillage':
        return <ToolLossComponent />;
      case 'Departements':
        return <DepartmentComponent />;
      case 'Planning':
        return <Planning />;
      case 'Calendrier':
        return (
          <CalendarView
            holidays={holidays}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            holidayDescription={holidayDescription}
            setHolidayDescription={setHolidayDescription}
            addHoliday={addHoliday}
          />
        );
      default:
        return <EmployeeList />;
    }
  };

  const getIcon = (text) => {
    switch (text) {
      case 'Statistiques':
        return <TroubleshootIcon fontSize="small" />;
      case 'Le Personnel':
        return <PeopleIcon fontSize="small" />;
      case 'Departements':
        return <AccountTreeIcon fontSize="small" />;
      case 'Pointage Manuel':
        return <AssignmentIcon fontSize="small" />;
      case 'Planning':
        return <ScheduleIcon fontSize="small" />;
      case 'Indisponibilités':
        return <FlakyIcon fontSize='small' />;
      case 'Perte Outillage':
        return <CrisisAlertIcon fontSize="small" />;
      case 'Calendrier':
        return <CalendarTodayIcon fontSize="small" />;
      default:
        return null;
    }
  };

  return (
    <Box sx={{ backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      <CssBaseline />

      {/* Bouton pour ouvrir/fermer le drawer */}
      <IconButton
        onClick={toggleDrawer}
        sx={{
          position: 'fixed',
          top: 10,
          left: 5,
          zIndex: 1201,
          backgroundColor: '#27aae0',
          ":hover": {
            backgroundColor: '#1a8ebf',
          },
          color: '#ffffff',
          boxShadow: 1,
        }}
      >
        {drawerOpen ? <CloseIcon /> : <MenuIcon />}
      </IconButton>

      {/* Drawer */}
      <Drawer
  variant="persistent"
  open={drawerOpen}
  sx={{
    width: drawerWidth,
    flexShrink: 0,
    [`& .MuiDrawer-paper`]: {
      width: drawerWidth,
      boxSizing: 'border-box',
      top: '65px',
      backgroundColor: '#ffffff',
      borderRight: '1px solid #e0e0e0',
      display: drawerOpen ? 'block' : 'none', // <-- le drawer est toujours monté, mais masqué
    },
  }}
>
  <Box sx={{ overflow: 'auto', p: 1 }}>
    <List>
      {['Le Personnel','Departements', 'Pointage Manuel', 'Planning', 'Indisponibilités','Statistiques', 'Perte Outillage', 'Calendrier'].map((text) => (
        <Button
          key={text}
          fullWidth
          onClick={() => setSelectedMenuItem(text)}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            p: 1,
            m: 0.5,
            borderRadius: 0,
            backgroundColor: (text === 'Perte Outillage')? '#F28572' : selectedMenuItem === text ? 'aquamarine' : '#27aae0',
            color: selectedMenuItem === text ? '#000000' : '#ffffff',
            transition: 'all 0.3s ease',
            '&:hover': {
              transform: 'scale(1.05)',
              boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
              backgroundColor: selectedMenuItem === text ? 'aquamarine' : '#1a8ebf',
            },
          }}
        >
          {getIcon(text)}
          <Typography variant="caption" sx={{ fontSize: '0.75rem', mt: 0.5 }}>
            {text}
          </Typography>
        </Button>
      ))}
    </List>
  </Box>
</Drawer>


      {/* Contenu principal */}
      <Box component="main" sx={{ flexGrow: 1, p: 1, ml: drawerOpen ? `${drawerWidth}px` : '0' }}>
        <Grid item xs={12}>
          {renderSelectedComponent()}
        </Grid>
      </Box>
    </Box>
  );
};

export default GestionRh;
