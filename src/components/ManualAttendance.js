import React, { useEffect, useState } from 'react';
import { 
  Box, Typography, TextField, List, ListItem, Button, 
  IconButton, Avatar, ListItemAvatar, Modal, Backdrop, Fade, Snackbar, Alert,
  Grid, InputAdornment, Card, CardContent, Divider
} from '@mui/material';
import { CheckCircle, Cancel, AccessTime, DateRange } from '@mui/icons-material';
import api from '../api/api';
import { set } from 'date-fns';

const ManualAttendance = () => {
  const [employees, setEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [openModal, setOpenModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [date, setDate] = useState('');
  const [timeIn, setTimeIn] = useState('');
  const [timeOut, setTimeOut] = useState('');

  // États pour les notifications
    const [success, setSuccess] = useState('');
    const [error, setError] = useState('');

  useEffect(() => {
    api.fetchEmployees(setEmployees);
  }, []);

  const filteredEmployees = employees.filter(emp =>
    emp.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleOpenModal = (employee) => {
    setSelectedEmployee(employee);
    setOpenModal(true);
  };

  const handleCloseModal = () => {
    setOpenModal(false);
    setSelectedEmployee(null);
    setDate('');
    setTimeIn('');
    setTimeOut('');
  };

  const markAttendance = async () => {
    // Validation de base
    if (!selectedEmployee) {
      setError('Veuillez sélectionner un employé')
      return;
    }
  
    if (!date) {
      setError('Veuillez sélectionner une date');
      return;
    }
  
    if (!timeIn && !timeOut) {
      setError('Veuillez saisir au moins une heure (Entrée ou Sortie)');
      return;
    }
  
    // Validation chronologique si les deux heures sont renseignées
    if (timeIn && timeOut) {
      const entryTime = new Date(`${date}T${timeIn}`);
      const exitTime = new Date(`${date}T${timeOut}`);
      
      if (entryTime >= exitTime) {
        setError('L\'heure d\'arrivée doit être avant l\'heure de départ');
        return;
      }
    }
  
    try {
      // Fonction pour formater la date et l'heure sans utliser ISO
      const formatToPunchtime = (date, time) => {
        const [hours, minutes] = time.split(':').map(n => n.padStart(2, '0'));
        const [year, month, day] = date.split('-');
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')} ${hours}:${minutes}:00`;
      };
      
     
  
      // Tableau pour stocker les promesses des appels API
      const apiCalls = [];
  
      // Pointage d'entrée si renseigné
      if (timeIn) {
        const checkInData = {
          employee_id: selectedEmployee.attendance_id,
          punch_time: formatToPunchtime(date, timeIn),
          punch_type: 'IN'
        };
        apiCalls.push(api.addManualPointage(checkInData));
      }
  
      // Pointage de sortie si renseigné
      if (timeOut) {
        const checkOutData = {
          employee_id: selectedEmployee.attendance_id,
          punch_time: formatToPunchtime(date, timeOut),
          punch_type: 'OUT'
        };
        apiCalls.push(api.addManualPointage(checkOutData));
      }
  
      // Exécution des appels API
      const responses = await Promise.all(apiCalls);
      console.log("Réponses API:", responses);
      // Vérification des erreurs
      const errors = responses.filter(response => !response.ok);
      if (errors.length > 0) {
        const errorMessages = await Promise.all(
          errors.map(async r => {
            const err = await r;
            return err.message || "Erreur inconnue";
          })
        );
        throw setError(errorMessages);
      }
  
      // Mise à jour optimiste du state local
      setEmployees(prevEmployees => 
        prevEmployees.map(emp => {
          if (emp.id === selectedEmployee.id) {
            const newAttendances = [...(emp.attendances || [])];
            
            if (timeIn) {
              newAttendances.push({ 
                date, 
                type: 'IN', 
                time: timeIn,
                punch_time: formatToPunchtime(date, timeIn)
              });
            }
            if (timeOut) {
              newAttendances.push({ 
                date, 
                type: 'OUT', 
                time: timeOut,
                punch_time: formatToPunchtime(date, timeOut)
              });
            }
  
            return { ...emp, attendances: newAttendances };
          }
          return emp;
        })
      );
  
      // Message de succès
      let successMessage = "Pointage enregistré avec succès\n";
      if (timeIn) successMessage += `• Arrivée: ${timeIn}\n`;
      if (timeOut) successMessage += `• Départ: ${timeOut}`;
      
      setSuccess(successMessage);
      handleCloseModal();
  
    } catch (error) {
      console.error("Erreur lors de l'enregistrement:", error);
      setError(`Erreur lors de l'enregistrement:\n${error.response?.data?.error || error.message}`);
      
      // Recharger les données actuelles en cas d'erreur
      api.fetchEmployees(setEmployees);
    }
  };

  return (
    <Card sx={{ boxShadow: 3, minHeight: '80vh' }}>
      <CardContent>
                {/* Notifications */}
                <Snackbar open={!!success} autoHideDuration={6000} onClose={() => setSuccess('')}>
                  <Alert severity="success">{success}</Alert>
                </Snackbar>
                
                <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError('')}>
                  <Alert severity="error">{error}</Alert>
                </Snackbar>
        <Box>
          <Typography sx={{color: '#27aae0'}} variant="h6" gutterBottom>
            POINTAGE MANUEL
          </Typography>
          <TextField 
            label="Rechercher un employé" 
            variant="outlined" 
            fullWidth 
            size="small" 
            sx={{ mb: 2 }}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <List>
            {filteredEmployees.map(employee => (
              <ListItem button onClick={() => handleOpenModal(employee)} key={employee.id}>
                <ListItemAvatar>
                  <Avatar src={employee.avatar} ></Avatar>
                </ListItemAvatar>
                <Typography>{employee.name}</Typography>
              </ListItem>
            ))}
          </List>
         
          <Modal
            open={openModal}
            onClose={handleCloseModal}
            closeAfterTransition
            BackdropComponent={Backdrop}
            BackdropProps={{
              timeout: 500,
            }}
          >
            <Fade in={openModal}>
              <Box sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 400,
                bgcolor: 'background.paper',
                boxShadow: 24,
                p: 4,
                borderRadius: 2
              }}>
                <Typography variant="h6" gutterBottom>Pointage pour {selectedEmployee?.name}</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      label="Date"
                      type="date"
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="Heure d'entrée"
                      type="time"
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                      value={timeIn}
                      onChange={(e) => setTimeIn(e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <AccessTime />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="Heure de sortie"
                      type="time"
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                      value={timeOut}
                      onChange={(e) => setTimeOut(e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <AccessTime />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>
                </Grid>
                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button onClick={handleCloseModal} color="secondary" sx={{ mr: 2 }}>Annuler</Button>
                  <Button 
                    onClick={markAttendance} 
                    variant="contained" 
                    color="primary"
                    disabled={!date || (!timeIn && !timeOut)}
                  >
                    Enregistrer
                  </Button>
                </Box>
              </Box>
            </Fade>
          </Modal>
        </Box>
      </CardContent>
    </Card>
  );
};

export default ManualAttendance;