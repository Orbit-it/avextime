import React, { useState, useEffect, use } from 'react';
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
  Chip,
  Stack,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import Add from '@mui/icons-material/Add';
import colorButtonStyle from '../config/Color';
import ExcelImportModal from '../components/ExcelUploader';
import apiConfig from '../config/Endpoint';

const MachinesPage = () => {
  // Données fictives des machines
  const [machines, setMachines] = useState([]);
  const [selectedMachine, setSelectedMachine] = useState(null); // Machine sélectionnée pour édition/suppression
  const [editModalOpen, setEditModalOpen] = useState(false); // État du modal d'édition
  const [deleteModalOpen, setDeleteModalOpen] = useState(false); // État du modal de suppression
  const [importModalOpen, setImportModalOpen] = useState(false);

  // Charger les machines au chargement de la page
  useEffect(() => {
    fetchMachines();
  }, []);

  // function to fetch data from the API
  const fetchMachines = async () => {
    try {
      const response = await axios.get(apiConfig.Endpoint.machine);
      setMachines(response.data);
    } catch (error) {
      console.error('Error fetching machines:', error);
    }
  };

  // function to add a new machine
  const addMachine = async (machine) => {
    try {
      const response = await axios.post(apiConfig.Endpoint.machine, machine);
      setMachines([...machines, response.data]);
    } catch (error) {
      console.error('Error adding machine:', error);
    }
  };

  // function to update a machine
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

  // function to delete a machine
  const deleteMachine = async (id) => {
    try {
      await axios.delete(`${apiConfig.Endpoint.machine}/${id}`);
      setMachines((prevMachines) => prevMachines.filter((m) => m.id !== id));
    } catch (error) {
      console.error('Error deleting machine:', error);
    }
  };

  const handleDownloadAttendance = async (machine) => {
    try {
      const response = await axios.post(`${apiConfig.Endpoint.machine}/${machine.id}/attendance`, { machine });
      console.log('Attendance data:', response.data);
      // Handle the response data as needed (e.g., download a file, show a message, etc.)
    } catch (error) {
      console.error('Error downloading attendance:', error);
    }
  };

  // Ajouter une machine
  const handleAdd = () => {
    if (newMachine.device_name && newMachine.ip_address && newMachine.port) {
      addMachine(newMachine); // Appeler la fonction pour ajouter une machine
      setNewMachine({
        device_name: '',
        ip_address: '',
        port: '',
        location: '',
      });
      setAddModalOpen(false);
    }
  };

  // Ouvrir le modal d'édition
  const handleEditClick = (machine) => {
    setSelectedMachine(machine);
    setEditModalOpen(true);
  };

  // Ouvrir le modal de suppression
  const handleDeleteClick = (machine) => {
    setSelectedMachine(machine);
    setDeleteModalOpen(true);
  };

  // Fermer les modals
  const handleCloseModals = () => {
    setEditModalOpen(false);
    setDeleteModalOpen(false);
    setSelectedMachine(null);
    setAddModalOpen(false);
  };

  // Sauvegarder les modifications
  const handleSave = () => {
    if (selectedMachine) {
      setMachines((prevMachines) =>
        prevMachines.map((machine) =>
          machine.id === selectedMachine.id ? selectedMachine : machine
        )
      );
      updateMachine(selectedMachine);
      handleCloseModals();
    }
  };

  // Supprimer une machine
  const handleDelete = () => {
    if (selectedMachine) {
      setMachines((prevMachines) =>
        prevMachines.filter((machine) => machine.id !== selectedMachine.id)
      );
      deleteMachine(selectedMachine.id);
      handleCloseModals();
    }
  };

  // Validation de l'adresse IP
  const ipRegex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  const handleIpChange = (e) => {
    const value = e.target.value;
  
    // Autoriser uniquement les chiffres et les points
    const filteredValue = value.replace(/[^0-9.]/g, '');
  
    // Valider l'adresse IP
    if (ipRegex) {
      setNewMachine({ ...newMachine, ip_address: filteredValue });
      setError('');
    } else {
      setError('Adresse IP invalide');
    }
  };


  // État pour le modal d'ajout
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [error, setError] = useState(''); // Message d'erreur pour l'adresse IP
  const [newMachine, setNewMachine] = useState({
    device_name: '',
    ip_address: '',
    port: '',
    location: '',
  });

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
        startIcon={<CloudDownloadIcon />}
      >
        Importer depuis Excel
      </Button>
      </Stack>
      {/* Tableau des machines */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
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
                  <Button
                    startIcon={<CloudDownloadIcon />}
                    onClick={() => handleDownloadAttendance(machine)}
                    sx={{ mr: 1 }}
                    color="primary"
                  >
                    Télécharger
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
        machineId="1" // ID de la machine sélectionnée
      />
        


      {/* Modal d'ajout */}
      <Dialog open={addModalOpen} onClose={handleCloseModals}>
        <DialogTitle>Ajouter une Machine</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2, width: '300px' }}>
            <TextField
              size='small'
              label="Nom de la Machine"
              value={newMachine.device_name}
              onChange={(e) => setNewMachine({ ...newMachine, device_name: e.target.value })}
            />
             <TextField
              size='small'
              label="Adresse IP"
              value={newMachine.ip_address}
              onChange={handleIpChange}
              error={!!error} // Afficher une bordure rouge en cas d'erreur
              helperText={error} // Afficher le message d'erreur
            />
            <TextField
              size='small'
              label="Port"
              value={newMachine.port}
              onChange={(e) => setNewMachine({ ...newMachine, port: e.target.value })}
            />
            <TextField
              size='small'
              label="Site"
              value={newMachine.location}
              onChange={(e) =>
                setNewMachine({ ...newMachine, location: e.target.value }) 
              }
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseModals} variant='contained' sx={{...colorButtonStyle.secondary}} >Annuler</Button>
          <Button onClick={handleAdd}  variant='contained' sx={{...colorButtonStyle.primary}}> 
            Ajouter
          </Button>   
        </DialogActions>
      </Dialog>

      {/* Modal d'édition */}
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
                value={selectedMachine.location ? selectedMachine.location : ''}
                onChange={(e) =>
                  setSelectedMachine({
                    ...selectedMachine,
                    location: { location: e.target.value },
                  })
                } 
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseModals} variant='contained' sx={{...colorButtonStyle.secondary}} >Annuler</Button>
          <Button onClick={handleSave} variant='contained' sx={{...colorButtonStyle.primary}}>
            Sauvegarder
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal de confirmation de suppression */}
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