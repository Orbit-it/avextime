import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';
import {
  Avatar,
  Typography,
  Divider,
  Box,
  IconButton,
  TextField,
  Button,
  Snackbar,
  Alert
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import api from '../api/api';



Modal.setAppElement('#root');

const AttendanceDetailsModal = ({
  isOpen,
  onClose,
  employee,
  date,
  dailyAttendances,
  onEdit,
  onSaveSuccess
}) => {
  

  const attendance = dailyAttendances?.[0] || {};

  const [getIn, setGetIn] = useState('');
  const [getOut, setGetOut] = useState('');
  const [autorizgetIn, setautorizGetIn] = useState('');
  const [autorizgetOut, setautorizGetOut] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setGetIn(attendance.getin || '');
    setGetOut(attendance.getout || '');
    setautorizGetIn(attendance.autoriz_getin || '');
    setautorizGetOut(attendance.autoriz_getout || '');
  }, [attendance]);

  if (!employee || !date || dailyAttendances.length === 0) return null;

  const handleSwitchTimes = () => {
    const temp = getIn;
    setGetIn(getOut);
    setGetOut(temp);
  };

  const handleSwitchAutoriz = () => {
    const temp = autorizgetIn;
    setautorizGetIn(autorizgetOut);
    setautorizGetOut(temp);
  };

  const getAttendanceParams = {
    employee: employee.attendance_id,
    date,
    getin: getIn,
    getout: getOut
  };

  const formattedDate = date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  

  const handleFixAttendance = async () => {
    // Validation : Arrivée doit être avant Départ
    if (getIn && getOut && getIn >= getOut) {
      setError("L'heure d'arrivée doit être antérieure à l'heure de départ");
      return;
    }

    if (autorizgetIn && autorizgetOut && autorizgetOut >= autorizgetIn) {
        setError("L'heure de sortie d'autorisation doit être antérieure à l'heure d'entrée !");
        return;
      }
  
    setIsLoading(true);     // Pour afficher un spinner ou désactiver le bouton
    setError('');
    setSuccess('');
  
    try {
      // Appel API pour corriger manuellement le pointage
      await api.fixManuallyPointage({
        employee: employee.attendance_id,
        date: date.toISOString().split('T')[0], // Format YYYY-MM-DD
        getin: getIn,
        getout: getOut,
        autorizgetOut,
        autorizgetIn
      });
  
      setSuccess('Pointage corrigé avec succès');
  
      // Notifier le parent si nécessaire
      if (onSaveSuccess) {
        onSaveSuccess({
          employee_id: employee.attendance_id,
          date,
          getin: getIn,
          getout: getOut,
          autoriz_getin: autorizgetOut,
          autoriz_getout: autorizgetIn
        });
      }
  
      // Fermer le modal si nécessaire
      onClose();
  
    } catch (err) {
      console.error('Erreur lors de la correction:', err);
      setError(err.response?.data?.message || 'Erreur lors de la correction du pointage');
    } finally {
      setIsLoading(false);
    }
  };
  

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      contentLabel="Détails de présence"
      style={{
        content: {
          top: '50%',
          left: '50%',
          right: 'auto',
          bottom: 'auto',
          marginRight: '-50%',
          transform: 'translate(-50%, -50%)',
          padding: '0',
          borderRadius: '8px',
          border: 'none',
          maxWidth: '600px',
          width: '90%',
          maxHeight: '90%',
          overflow: 'auto',
        },
        overlay: {
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1000
        }
      }}
    >
      <Snackbar open={!!success} autoHideDuration={6000} onClose={() => setSuccess('')}>
        <Alert severity="success">{success}</Alert>
      </Snackbar>

      <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError('')}>
        <Alert severity="error">{error}</Alert>
      </Snackbar>

      <Box sx={{ p: 3 }}>

        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Avatar src={employee.avatar} sx={{ width: 56, height: 56, mr: 2 }} />
          <div>
            <Typography variant="h6">{employee.name}</Typography>
            <Typography variant="subtitle1" color="text.secondary">
              Matricule: {employee.attendance_id}
            </Typography>
          </div>
          <div>
          
          <Box sx={{ ml: 4 }}>
            <Typography variant="subtitle2">Heures TRAV: {attendance.hours_worked || "00:00"} </Typography>
            {attendance.is_anomalie && (
              <Typography color="error" sx={{ mt: 1 }}>⚠️ Anomalie détectée</Typography>
            )}
          </Box>
          </div>
        </Box>

        <Typography variant="h5" sx={{ mb: 2 }}>{formattedDate}</Typography>
        <Divider sx={{ my: 2 }} />

        {/* Horaires */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>Horaires</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <TextField
              label="Arrivée"
              type="time"
              value={getIn}
              onChange={(e) => setGetIn(e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ step: 300 }}
            />
            <IconButton onClick={handleSwitchTimes} color="primary">
              <SwapHorizIcon />
            </IconButton>
            <TextField
              label="Départ"
              type="time"
              value={getOut}
              onChange={(e) => setGetOut(e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ step: 300 }}
            />
          </Box>
          
        </Box>

        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>Autorisation</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <TextField
              label="Sortie"
              type="time"
              value={autorizgetOut}
              onChange={(e) => setautorizGetOut(e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ step: 300 }}
            />
            <IconButton onClick={handleSwitchAutoriz} color="primary">
              <SwapHorizIcon />
            </IconButton>
            <TextField
              label="Retour"
              type="time"
              value={autorizgetIn}
              onChange={(e) => setautorizGetIn(e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ step: 300 }}
            />
          </Box>
          
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
          <Button variant="contained" color="secondary" onClick={onClose}>
            Fermer
          </Button>
          <Button variant="contained" color="primary" onClick={handleFixAttendance}>
            Enregistrer
          </Button>
        </Box>
      </Box>
    </Modal>
  );
};

export default AttendanceDetailsModal;
