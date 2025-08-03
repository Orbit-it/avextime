import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  CircularProgress,
  Alert,
  Collapse,
  IconButton
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import { ImportExport } from '@mui/icons-material';
import Add from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import colorButtonStyle from '../config/Color';
import ExcelImportModal from '../components/ExcelUploader';
import apiConfig from '../config/Endpoint';
import DownloadModal from '../components/DownloadModal';

const MachinesPage = () => {
  const [machines, setMachines] = useState([]);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [loadingDownload, setLoadingDownload] = useState(false);
  const [failedMachines, setFailedMachines] = useState([]);
  const [showFailedMachines, setShowFailedMachines] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [error, setError] = useState('');
  const [newMachine, setNewMachine] = useState({
    device_name: '',
    ip_address: '',
    port: '',
    location: '',
  });

  const [downloadStatus, setDownloadStatus] = useState({
    open: false,
    progress: 0,
    message: '',
    machine: ''
  });

  useEffect(() => {
    fetchMachines();
  }, []);

  const fetchMachines = async () => {
    try {
      const response = await axios.get(apiConfig.Endpoint.machine);
      setMachines(response.data);
    } catch (error) {
      console.error('Error fetching machines:', error);
    }
  };

  const addMachine = async (machine) => {
    try {
      const response = await axios.post(apiConfig.Endpoint.machine, machine);
      setMachines([...machines, response.data]);
    } catch (error) {
      console.error('Error adding machine:', error);
    }
  };

  const updateMachine = async (machine) => {
    try {
      const response = await axios.put(`${apiConfig.Endpoint.machine}/${machine.id}`, machine);
      setMachines((prevMachines) =>
        prevMachines.map((m) => (m.id === machine.id ? response.data : m))
      );
    } catch (error) {
      console.error('Error updating machine:', error);
    }
  };

  const deleteMachine = async (id) => {
    try {
      await axios.delete(`${apiConfig.Endpoint.machine}/${id}`);
      setMachines((prevMachines) => prevMachines.filter((m) => m.id !== id));
    } catch (error) {
      console.error('Error deleting machine:', error);
    }
  };

  // Frontend: handleDownloadAllAttendance function
const handleDownloadAllAttendance = async () => {
  setLoadingDownload(true);
  setFailedMachines([]);
  setShowFailedMachines(false);
  
  try {
    const failed = [];
    
    // Initial status
    setDownloadStatus({
      open: true,
      progress: 0,
      machine: '',
      message: "Début du processus..."
    });

    // Phase 1: Download all machine data
    for (const machine of machines) {
      setDownloadStatus(prev => ({
        ...prev,
        machine: machine.device_name,
        message: `Téléchargement ${machine.device_name}...`
      }));

      try {
        const response = await axios.post(
          `${apiConfig.Endpoint.machine}/${machine.id}/attendance`, 
          { machine },
          {
            onDownloadProgress: (progressEvent) => {
              const percentCompleted = progressEvent.total 
                ? Math.round((progressEvent.loaded * 25) / progressEvent.total) // First 25% of progress
                : 0;
              
              setDownloadStatus(prev => ({
                ...prev,
                progress: percentCompleted,
                message: `Téléchargement (${machine.device_name}) ${percentCompleted}%`
              }));
            },
            responseType: 'blob'
          }
        );

        setDownloadStatus(prev => ({
          ...prev,
          progress: 25,
          message: `${machine.device_name}: Téléchargement réussi!`,
        }));

      } catch (error) {
        failed.push({
          name: machine.device_name,
          error: error.message || 'Erreur inconnue'
        });
        
        setDownloadStatus(prev => ({
          ...prev,
          message: `${machine.device_name}: Échec du téléchargement`,
        }));
      }
    }

    setFailedMachines(failed);

    // Phase 2: Trigger compute process
    setDownloadStatus(prev => ({
      ...prev,
      progress: 30,
      message: "Début du calcul des pointages...",
      machine: ''
    }));

    const computeResponse = await axios.post(`${apiConfig.Endpoint.compute}`, {
      machines: machines.map(m => m.id),
      failedMachines: failed.map(f => f.name)
    }, {
      onDownloadProgress: (progressEvent) => {
        // Progress from 30% to 100% during compute
        const percentCompleted = 30 + Math.round(
          (progressEvent.loaded * 70) / (progressEvent.total || 1)
        );
        
        setDownloadStatus(prev => ({
          ...prev,
          progress: percentCompleted,
          message: `Calcul en cours... ${percentCompleted}%`
        }));
      }
    });

    // Final status
    setDownloadStatus(prev => ({
      ...prev,
      progress: 100,
      message: computeResponse.data.message || "Traitement terminé avec succès!",
    }));

    if (failed.length > 0) {
      setShowFailedMachines(true);
    }

    // Auto-close after 3 seconds
    setTimeout(() => {
      setDownloadStatus(prev => ({ ...prev, open: false }));
    }, 3000);
    
  } catch (error) {
    setDownloadStatus({
      open: true,
      progress: 0,
      machine: '',
      message: `Erreur: ${error.response?.data?.message || error.message}`
    });
  } finally {
    setLoadingDownload(false);
  }
};

  const handleAdd = () => {
    if (newMachine.device_name && newMachine.ip_address && newMachine.port) {
      addMachine(newMachine);
      setNewMachine({
        device_name: '',
        ip_address: '',
        port: '',
        location: '',
      });
      setAddModalOpen(false);
    }
  };

  const handleEditClick = (machine) => {
    setSelectedMachine(machine);
    setEditModalOpen(true);
  };

  const handleDeleteClick = (machine) => {
    setSelectedMachine(machine);
    setDeleteModalOpen(true);
  };

  const handleCloseModals = () => {
    setEditModalOpen(false);
    setDeleteModalOpen(false);
    setSelectedMachine(null);
    setAddModalOpen(false);
  };

  const handleSave = () => {
    if (selectedMachine) {
      updateMachine(selectedMachine);
      handleCloseModals();
    }
  };

  const handleDelete = () => {
    if (selectedMachine) {
      deleteMachine(selectedMachine.id);
      handleCloseModals();
    }
  };

  const ipRegex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  
  const handleIpChange = (e) => {
    const value = e.target.value;
    const filteredValue = value.replace(/[^0-9.]/g, '');
  
    if (ipRegex.test(filteredValue)) {
      setNewMachine({ ...newMachine, ip_address: filteredValue });
      setError('');
    } else {
      setError('Adresse IP invalide');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography sx={{color: '#27aae0'}} variant="h6" gutterBottom>
        GESTION DES POINTEUSES
      </Typography>

      <Stack direction="row" spacing={2} sx={{mb: 2}}>
        <Button
          variant="contained"
          sx={{mb: 1, ml:1, ...colorButtonStyle.primary}}
          onClick={() => setAddModalOpen(true)}
          startIcon={<Add />}
        >
          Ajouter une Machine
        </Button>
        <Button 
          variant="contained" 
          onClick={() => setImportModalOpen(true)}
          startIcon={<ImportExport />}
        >
          Importer depuis Excel
        </Button>
        <Button
          variant="contained"
          onClick={handleDownloadAllAttendance}
          startIcon={
            loadingDownload ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              <CloudDownloadIcon />
            )
          }
          disabled={loadingDownload}
          color={failedMachines.length > 0 ? 'warning' : 'info'}
          sx={{ minWidth: 250 }}
        >
          {loadingDownload ? 'Téléchargement...' : 'Télécharger tous les pointages'}
        </Button>
      </Stack>

      <Collapse in={showFailedMachines && failedMachines.length > 0}>
        <Alert 
          severity="warning"
          action={
            <IconButton
              aria-label="close"
              color="inherit"
              size="small"
              onClick={() => setShowFailedMachines(false)}
            >
              <CloseIcon fontSize="inherit" />
            </IconButton>
          }
          sx={{ mb: 2 }}
        >
          <Typography variant="subtitle1" gutterBottom>
            Machines avec des erreurs de téléchargement:
          </Typography>
          <ul style={{ marginTop: 0, paddingLeft: 20 }}>
            {failedMachines.map((machine, index) => (
              <li key={index}>
                <strong>{machine.name}</strong>: {machine.error}
              </li>
            ))}
          </ul>
        </Alert>
      </Collapse>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Machine</TableCell>
              <TableCell>Adresse IP</TableCell>
              <TableCell>Port</TableCell>
              <TableCell>Site</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {machines.map((machine) => (
              <TableRow key={machine.id}>
                <TableCell>{machine.id}</TableCell>
                <TableCell>{machine.device_name}</TableCell>
                <TableCell>{machine.ip_address}</TableCell>
                <TableCell>{machine.port}</TableCell>
                <TableCell>
                  {machine.location ? machine.location : 'Non défini'}
                </TableCell>
                <TableCell>
                  <Button
                    startIcon={<EditIcon />}
                    onClick={() => handleEditClick(machine)}
                    sx={{ mr: 1 }}
                  >
                    Éditer
                  </Button>
                  <Button
                    startIcon={<DeleteIcon />}
                    onClick={() => handleDeleteClick(machine)}
                    sx={{ mr: 1 }}
                    color="error"
                  >
                    Supprimer
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <ExcelImportModal 
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        machineId="1"
      />

      <DownloadModal 
        open={downloadStatus.open}
        progress={downloadStatus.progress}
        message={downloadStatus.message}
        machine_name={downloadStatus.machine}
      />

      <Dialog open={addModalOpen} onClose={handleCloseModals}>
        <DialogTitle>Ajouter une Machine</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2, width: '300px' }}>
            <TextField
              size='small'
              label="Nom de la Machine"
              value={newMachine.device_name}
              onChange={(e) => setNewMachine({ ...newMachine, device_name: e.target.value })}
              required
            />
            <TextField
              size='small'
              label="Adresse IP"
              value={newMachine.ip_address}
              onChange={handleIpChange}
              error={!!error}
              helperText={error}
              required
            />
            <TextField
              size='small'
              label="Port"
              value={newMachine.port}
              onChange={(e) => setNewMachine({ ...newMachine, port: e.target.value })}
              required
            />
            <TextField
              size='small'
              label="Site"
              value={newMachine.location}
              onChange={(e) => setNewMachine({ ...newMachine, location: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseModals} variant='contained' sx={{...colorButtonStyle.secondary}}>
            Annuler
          </Button>
          <Button onClick={handleAdd} variant='contained' sx={{...colorButtonStyle.primary}}>
            Ajouter
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editModalOpen} onClose={handleCloseModals}>
        <DialogTitle>Éditer la Machine</DialogTitle>
        <DialogContent>
          {selectedMachine && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2, width: '300px' }}>
              <TextField
                size='small'
                label="Nom de la Machine"
                value={selectedMachine.device_name}
                onChange={(e) =>
                  setSelectedMachine({ ...selectedMachine, device_name: e.target.value })
                }
              />
              <TextField
                size='small'
                label="Adresse IP"
                value={selectedMachine.ip_address}
                onChange={(e) =>
                  setSelectedMachine({ ...selectedMachine, ip_address: e.target.value })
                }
              />
              <TextField
                size='small'
                label="Port"
                value={selectedMachine.port}
                onChange={(e) =>
                  setSelectedMachine({ ...selectedMachine, port: e.target.value })
                }
              />
              <TextField
                size='small'
                label="Site"
                value={selectedMachine.location || ''}
                onChange={(e) =>
                  setSelectedMachine({ ...selectedMachine, location: e.target.value })
                }
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseModals} variant='contained' sx={{...colorButtonStyle.secondary}}>
            Annuler
          </Button>
          <Button onClick={handleSave} variant='contained' sx={{...colorButtonStyle.primary}}>
            Sauvegarder
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteModalOpen} onClose={handleCloseModals}>
        <DialogTitle>Confirmer la Suppression</DialogTitle>
        <DialogContent>
          <Typography>
            Êtes-vous sûr de vouloir supprimer la machine "{selectedMachine?.device_name}" ?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseModals}>Annuler</Button>
          <Button onClick={handleDelete} color="error">
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MachinesPage;