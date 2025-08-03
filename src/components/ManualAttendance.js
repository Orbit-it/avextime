import React, { useEffect, useState } from 'react';
import { 
  Box, Typography, TextField, List, ListItem, Button, 
  IconButton, Avatar, ListItemAvatar, Modal, Backdrop, Fade, Snackbar, Alert,
  Grid, InputAdornment, Card, CardContent, Divider
} from '@mui/material';
import { CheckCircle, Cancel, AccessTime, DateRange } from '@mui/icons-material';
import api from '../api/api';
import AttendanceDetailsModal from './AttendanceDetailsModal'; // Assurez-vous d'importer le modal

const ManualAttendance = () => {
  const [employees, setEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [openModal, setOpenModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [date, setDate] = useState('');
  const [timeIn, setTimeIn] = useState('');
  const [timeOut, setTimeOut] = useState('');
  const [selectedAttendance, setSelectedAttendance] = useState(null);
  const [attendanceDetailsOpen, setAttendanceDetailsOpen] = useState(false);

  // États pour les notifications
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const updatedData = {
    getin: timeIn,
    getout: timeOut,
    date: date
  }

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

  // Fonction pour ouvrir les détails d'un pointage
  const openAttendanceDetails = (employee, attendance) => {
    setSelectedEmployee(employee);
    setSelectedAttendance(attendance);
    setAttendanceDetailsOpen(true);
  };

  // Formatage des données pour l'API
  const formatToPunchtime = (date, time) => {
    const [hours, minutes] = time.split(':').map(n => n.padStart(2, '0'));
    const [year, month, day] = date.split('-');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')} ${hours}:${minutes}:00`;
  };

  // Fonction pour modifier un pointage existant
  const handleEditAttendance = async (updatedData) => {
    try {
    
      // Supprimer d'abord l'ancien pointage
      //await api.deletePointage(selectedAttendance.id);

      // Enregistrer les nouveaux pointages
      const apiCalls = [];
      
      if (updatedData.getin) {
        const checkInData = {
          employee_id: selectedEmployee.attendance_id,
          punch_time: formatToPunchtime(updatedData.date, updatedData.getin),
          punch_type: 'IN'
        };
        apiCalls.push(api.addManualPointage(checkInData));
      }

      if (updatedData.getout) {
        const checkOutData = {
          employee_id: selectedEmployee.attendance_id,
          punch_time: formatToPunchtime(updatedData.date, updatedData.getout),
          punch_type: 'OUT'
        };
        apiCalls.push(api.addManualPointage(checkOutData));
      }

      await Promise.all(apiCalls);
      
      // Rafraîchir les données
      api.fetchEmployees(setEmployees);
      
      setSuccess('Pointage ajouté avec succès');
      setAttendanceDetailsOpen(false);
    } catch (err) {
      console.error("Erreur lors de l'ajout du pointage: ", err);
      setError("Erreur lors de l'ajout du pointage");
    }
  };

  // Fonction pour supprimer un pointage
  const handleDeleteAttendance = async () => {
    try {
      await api.deletePointage(selectedAttendance.id);
      
      // Rafraîchir les données
      api.fetchEmployees(setEmployees);
      
      setSuccess('Pointage supprimé avec succès');
      setAttendanceDetailsOpen(false);
    } catch (err) {
      console.error('Erreur lors de la suppression:', err);
      setError('Erreur lors de la suppression du pointage');
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
              <ListItem 
                button 
                onClick={() => handleOpenModal(employee)} 
                key={employee.id}
                secondaryAction={
                  employee.attendances?.length > 0 && (
                    <Button 
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        openAttendanceDetails(employee, employee.attendances[0]);
                      }}
                    >
                      Voir pointage
                    </Button>
                  )
                }
              >
                <ListItemAvatar>
                  <Avatar src={employee.avatar} ></Avatar>
                </ListItemAvatar>
                <Typography>{employee.name}</Typography>
              </ListItem>
            ))}
          </List>
         
          {/* Modal pour ajouter un pointage (existant) */}
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
                    onClick={() => handleEditAttendance(updatedData)} 
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

          {/* Modal des détails du pointage */}
          <AttendanceDetailsModal
            isOpen={attendanceDetailsOpen}
            onClose={() => setAttendanceDetailsOpen(false)}
            employee={selectedEmployee}
            date={new Date(selectedAttendance?.date)}
            dailyAttendances={selectedAttendance ? [selectedAttendance] : []}
            onEdit={handleEditAttendance}
            onDelete={handleDeleteAttendance}
          />
        </Box>
      </CardContent>
    </Card>
  );
};

export default ManualAttendance;