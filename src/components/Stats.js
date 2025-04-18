import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Box, Typography, TextField, Button, 
  Card, CardContent, List, ListItem, 
  ListItemAvatar, Avatar, Divider, Chip,
  CircularProgress, Alert, Snackbar, ListItemText,
  Paper, Grid
} from '@mui/material';
import { Search, Person, Today, Event, Close } from '@mui/icons-material';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, isBefore, differenceInDays } from 'date-fns';
import fr from 'date-fns/locale/fr';

const EmployeeAttendanceStats = () => {
  // États initiaux
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState({
    employees: true,
    stats: false
  });
  const [notifications, setNotifications] = useState({
    error: null,
    success: null
  });
  const [dateRange, setDateRange] = useState({
    startDate: null,
    endDate: null
  });
  const [searchTerm, setSearchTerm] = useState('');

  // Configuration API
  const API_URL = 'http://localhost:5000/api';
  const axiosConfig = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  };

  // Chargement des employés
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await axios.get(`${API_URL}/employees`, axiosConfig);
        setEmployees(response.data || []);
      } catch (err) {
        handleError("Erreur lors du chargement des employés", err);
      } finally {
        setLoading(prev => ({ ...prev, employees: false }));
      }
    };

    fetchEmployees();
  }, []);

  // Gestion des erreurs
  const handleError = (message, error) => {
    console.error(message, error);
    setNotifications(prev => ({
      ...prev,
      error: message
    }));
  };

  // Fermeture des notifications
  const handleCloseNotification = () => {
    setNotifications({
      error: null,
      success: null
    });
  };

  // Validation des dates
  const validateDates = () => {
    const { startDate, endDate } = dateRange;
    
    if (!startDate || !endDate) {
      handleError("Veuillez sélectionner une date de début et de fin");
      return false;
    }
    if (isBefore(endDate, startDate)) {
      handleError("La date de fin doit être après la date de début");
      return false;
    }
    return true;
  };

  // Récupération des statistiques
  const fetchStats = async () => {
    if (!selectedEmployee || !validateDates()) return;

    try {
      setLoading(prev => ({ ...prev, stats: true }));
      
      const { startDate, endDate } = dateRange;
      const params = {
        start_date: format(startDate, 'yyyy-MM-dd'),
        end_date: format(endDate, 'yyyy-MM-dd')
      };

      const response = await axios.get(
        `${API_URL}/attendance-stats/${params.start_date}/${params.end_date}/${selectedEmployee.attendance_id}`, 
        axiosConfig
      );

      setStats(response.data);
    } catch (err) {
      handleError(
        err.response?.data?.error || 
        "Erreur lors de la récupération des statistiques", 
        err
      );
      setStats(null);
    } finally {
      setLoading(prev => ({ ...prev, stats: false }));
    }
  };

  // Filtrage des employés
  const filteredEmployees = employees.filter(emp =>
    emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.attendance_id.toString().includes(searchTerm.toLowerCase())
  );

  // Calcul du nombre de jours
  const daysCount = dateRange.startDate && dateRange.endDate 
    ? differenceInDays(dateRange.endDate, dateRange.startDate) + 1 
    : 0;

  return (
    <Card sx={{ boxShadow: 3, minHeight: '80vh' }}>
      <CardContent>
        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={fr}>
          {/* En-tête */}
          <Box display="flex" alignItems="center" mb={2}>
            <Typography sx={{ color: '#27aae0' }} variant="h6" gutterBottom>
              STATISTIQUES DE PRESENCE
            </Typography>
          </Box>

          {/* Notifications */}
          <Snackbar
            open={!!notifications.error}
            autoHideDuration={6000}
            onClose={handleCloseNotification}
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          >
            <Alert severity="error" onClose={handleCloseNotification}>
              {notifications.error}
            </Alert>
          </Snackbar>

          {/* Recherche d'employé */}
          <TextField
            fullWidth
            size='small'
            variant="outlined"
            label="Rechercher un employé"
            InputProps={{
              startAdornment: <Search color="action" sx={{ mr: 1 }} />
            }}
            sx={{ mb: 3 }}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          {loading.employees ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress size={60} />
            </Box>
          ) : (
            <>
              {/* Liste des employés */}
              <List sx={{ maxHeight: '30vh', overflow: 'auto', mb: 3, border: '1px solid #ccc', borderRadius: 1, backgroundColor: '#f9f9f0' }}>
                {filteredEmployees.map(employee => (
                  <ListItem
                    key={employee.id}
                    button
                    selected={selectedEmployee?.id === employee.id}
                    onClick={() => setSelectedEmployee(employee)}
                    sx={{
                      '&:hover': { backgroundColor: 'action.hover' },
                      borderRadius: 1,
                      mb: 1
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar>{employee.avatar || <Person />}</Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={employee.name}
                      secondary={`Matricule: ${employee.attendance_id}`}
                    />
                  </ListItem>
                ))}
              </List>

              {/* Sélection de la période */}
              {selectedEmployee && (
                <Paper elevation={2} sx={{ mb: 3, p: 3 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Période de consultation pour {selectedEmployee.name}
                  </Typography>

                  <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={12} md={6}>
                      <DatePicker
                        label="Date de début"
                        value={dateRange.startDate}
                        onChange={(newDate) => setDateRange(prev => ({
                          ...prev,
                          startDate: newDate
                        }))}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            size='small'
                            fullWidth
                            error={!!notifications.error && (!dateRange.startDate || (dateRange.endDate && isBefore(dateRange.endDate, dateRange.startDate)))}
                          />
                        )}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <DatePicker
                        label="Date de fin"
                        value={dateRange.endDate}
                        minDate={dateRange.startDate || undefined}
                        onChange={(newDate) => setDateRange(prev => ({
                          ...prev,
                          endDate: newDate
                        }))}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            size='small'
                            fullWidth
                            error={!!notifications.error && (!dateRange.endDate || isBefore(dateRange.endDate, dateRange.startDate))}
                          />
                        )}
                      />
                    </Grid>
                  </Grid>

                  {dateRange.startDate && dateRange.endDate && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Période sélectionnée: {daysCount} jour(s)
                    </Typography>
                  )}

                  <Button
                    variant="contained"
                    onClick={fetchStats}
                    disabled={loading.stats || !dateRange.startDate || !dateRange.endDate}
                    startIcon={loading.stats ? <CircularProgress size={20} /> : null}
                    fullWidth
                  >
                    {loading.stats ? 'Chargement...' : 'Afficher les statistiques'}
                  </Button>
                </Paper>
              )}

              {/* Affichage des statistiques */}
              {stats && (
                <Paper elevation={2} sx={{ p: 3 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6">
                      Statistiques de présence
                    </Typography>
                    <Typography variant="body2">
                      Du {format(new Date(stats.metadata.period.start_date), 'dd/MM/yyyy')} au {format(new Date(stats.metadata.period.end_date), 'dd/MM/yyyy')} 
                      ({stats.metadata.period.days} jours)
                    </Typography>
                  </Box>

                  <Divider sx={{ my: 2 }} />

                  <Grid container spacing={2}>
                    <Grid item xs={6} md={3}>
                      <Paper sx={{ p: 2, textAlign: 'center' }}>
                        <Typography variant="h5" color="error.main">
                          {stats.data.total_absence || 0}
                        </Typography>
                        <Typography variant="body2">Absences</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <Paper sx={{ p: 2, textAlign: 'center' }}>
                        <Typography variant="h5" color="warning.main">
                          {stats.data.total_retard || 0}
                        </Typography>
                        <Typography variant="body2">Retards</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <Paper sx={{ p: 2, textAlign: 'center' }}>
                        <Typography variant="h5" color="info.main">
                          {stats.data.total_depanti || 0}
                        </Typography>
                        <Typography variant="body2">Départs anticipés</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={6} md={3}>
                      <Paper sx={{ p: 2, textAlign: 'center' }}>
                        <Typography variant="h5" color="success.main">
                          {daysCount - (stats.data.total_absence || 0)}
                        </Typography>
                        <Typography variant="body2">Jours présents</Typography>
                      </Paper>
                    </Grid>
                  </Grid>

                  <Box mt={3}>
                    <Typography variant="subtitle2" gutterBottom>
                      
                    </Typography>
                  </Box>
                </Paper>
              )}
            </>
          )}
        </LocalizationProvider>
      </CardContent>
    </Card>
  );
};

export default EmployeeAttendanceStats;