import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { 
  Modal, List, Button, TextField, 
  Box, Typography, IconButton, Tabs, Tab, 
  ListItemAvatar, Avatar, Card, CardContent,
  CircularProgress, Alert, Chip, Divider, Snackbar, ListItem, ListItemText,
} from '@mui/material';
import { Edit, Delete, Search, Person, Today, Close, Add, Exposure, SocialDistance, TaskAlt, Warning, Dangerous, Sick, LocalHospital, DoneAll } from '@mui/icons-material';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import fr from 'date-fns/locale/fr';
import { format, differenceInDays, addDays, isBefore } from 'date-fns';

// Types
interface Employee {
  id: number;
  name: string;
  attendance_id: string;
  avatar?: React.ReactNode;
}

interface Layoff {
  id: number;
  employee_id: number;
  start_date: string;
  end_date: string;
  nb_jour: number;
  type: string;
  is_purged: boolean;
}

type LayoffType = 
  | 'map' 
  | 'conge' 
  | 'cg_maladie' 
  | 'accident' 
  | 'cg_dcs' 
  | 'cg_naissance' 
  | 'cg_mariage' 
  | 'cg_cir'
  | 'rdv_medical';

interface ModalState {
  open: boolean;
  employee: Employee | null;
  type: LayoffType;
  startDate: Date | null;
  endDate: Date | null;
  editingId: number | null;
}

interface Notification {
  error: string | null;
  success: string | null;
}

interface LoadingState {
  employees: boolean;
  layoffs: boolean;
  submit: boolean;
}

// Constantes
const API_URL = 'http://localhost:5000/api';
const LAYOFF_TYPES: {value: LayoffType, label: string}[] = [
  { value: 'map', label: 'Mise à Pied' },
  { value: 'accident', label: 'Accident de Travail' },
  { value: 'rdv_medical', label: 'RDV Médical justifié' },
  { value: 'conge', label: 'Congé Simple' },
  { value: 'cg_maladie', label: 'Congé Maladie' },
  { value: 'cg_dcs', label: 'Congé Décès Parental' },
  { value: 'cg_naissance', label: 'Congé Naissance' },
  { value: 'cg_mariage', label: 'Congé Mariage' },
  { value: 'cg_cir', label: 'Congé Circoncision' },
];

// Sous-composants
const LayoffListItem: React.FC<{
  layoff: Layoff;
  employee: Employee | undefined;
  onEdit: (layoff: Layoff) => void;
  onDelete: (id: number) => void;
  loading: boolean;
}> = ({ layoff, employee, onEdit, onDelete, loading }) => {
  const getChipColor = (type: string) => {
    switch(type) {
      case 'conge': return "success";
      case 'cg_maladie': return "warning";
      case 'accident': return "secondary";
      case 'map': return "error";
      default: return "info";
    }
  };

  const getTypeLabel = (type: string) => {
    const typeObj = LAYOFF_TYPES.find(t => t.value === type);
    return typeObj ? `${layoff.nb_jour} jour(s) ${typeObj.label}` : `${layoff.nb_jour} jour(s)`;
  };

  return (
    <React.Fragment>
      <ListItem
        sx={{
          backgroundColor: 'background.paper',
          borderRadius: 1,
          mb: 1,
          boxShadow: 1
        }}
        secondaryAction={
          <Box>
            <IconButton
              onClick={() => onEdit(layoff)}
              color="primary"
              disabled={loading}
            >
              <Edit />
            </IconButton>
            <IconButton
              onClick={() => onDelete(layoff.id)}
              color="error"
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : <Delete />}
            </IconButton>
          </Box>
        }
      >
        <Box width="100%" display="flex" >
          <Box display="flex" alignItems="center">
            <ListItemAvatar>
              <Avatar sx={{ bgcolor: 'primary.main' }}  src={employee?.avatar}>
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={employee?.name || 'Inconnu'}
              secondary={employee?.attendance_id || 'Inconnu'}
            />
            <Chip
              label={getTypeLabel(layoff.type)}
              color={getChipColor(layoff.type)}
              size="small"
            />
            {layoff.is_purged && (
              <Chip
                label="Archivée"
                sx={{ ml: 1, backgroundColor: '#f0f0f0', color: '#757575' }}
              />
            )}
          </Box>
          <Box display="flex" mr={2} alignItems="center">
            <Today color="primary" fontSize="small" />
            <Typography variant="body2" color="text.secondary">
              Du {format(new Date(layoff.start_date), 'dd/MM/yyyy')} au {format(new Date(layoff.end_date), 'dd/MM/yyyy')}
            </Typography>
          </Box>
        </Box>
      </ListItem>
      <Divider sx={{ my: 1 }} />
    </React.Fragment>
  );
};

const LayoffModal: React.FC<{
  state: ModalState;
  onClose: () => void;
  onSubmit: () => void;
  onDateChange: (field: 'startDate' | 'endDate', value: Date | null) => void;
  onTypeChange: (type: LayoffType) => void;
  loading: boolean;
  notification: string | null;
}> = ({ state, onClose, onSubmit, onDateChange, onTypeChange, loading, notification }) => {
  const duration = useMemo(() => {
    if (state.startDate && state.endDate) {
      return differenceInDays(state.endDate, state.startDate) + 1;
    }
    return 0;
  }, [state.startDate, state.endDate]);

  return (
    <Modal open={state.open} onClose={onClose}>
      <Box sx={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: { xs: '90%', sm: '80%', md: '60%' },
        maxWidth: 500,
        bgcolor: 'background.paper',
        boxShadow: 24,
        p: 4,
        borderRadius: 0,
        outline: 'none'
      }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h6" fontWeight="bold">
            {state.editingId ? "Modification" : "Attribution de Congés / Sanctions"}
          </Typography>
          <IconButton onClick={onClose} disabled={loading}>
            <Close />
          </IconButton>
        </Box>

        {state.employee && (
          <Box display="flex" alignItems="center" mb={3}>
            <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }} src={state.employee.avatar}> 
            </Avatar>
            <Typography variant="body1" fontWeight="medium">
              {state.employee.name}
            </Typography>
          </Box>
        )}

        <Box mb={3} display="flex" flexDirection="column">
          <select
            value={state.type}
            onChange={(e) => onTypeChange(e.target.value as LayoffType)}
            style={{ 
              padding: '10px', 
              borderRadius: '4px', 
              border: '1px solid #ccc', 
              marginBottom: '16px',
              fontSize: '14px'
            }}
          >
            {LAYOFF_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>

          <DatePicker
            label="Date de début"
            value={state.startDate}
            sx={{ mb: 2 }}
            onChange={(newDate) => onDateChange('startDate', newDate)}
            renderInput={(params) => (
              <TextField
                {...params}
                size='small'
                fullWidth
                sx={{ mb: 2 }}
                error={!!notification}
              />
            )}
          />

          <DatePicker
            label="Date de fin"
            value={state.endDate}
            minDate={state.startDate || undefined}
            onChange={(newDate) => onDateChange('endDate', newDate)}
            renderInput={(params) => (
              <TextField
                {...params}
                size='small'
                fullWidth
                error={!!notification}
              />
            )}
          />
        </Box>

        {duration > 0 && (
          <Box mb={3}>
            <Chip
              label={`Durée: ${duration} jour(s)`}
              color="primary"
              variant="outlined"
              size="medium"
            />
          </Box>
        )}

        {notification && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {notification}
          </Alert>
        )}

        <Box display="flex" justifyContent="flex-end" gap={2}>
          <Button
            variant="outlined"
            onClick={onClose}
            disabled={loading}
          >
            Annuler
          </Button>
          <Button
            variant="contained"
            onClick={onSubmit}
            disabled={loading || !state.startDate || !state.endDate}
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            {state.editingId ? "Mettre à jour" : "Confirmer"}
          </Button>
        </Box>
      </Box>
    </Modal>
  );
};

// Composant principal
const EmployeeLayoffComponent: React.FC = () => {
  // États
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [layoffs, setLayoffs] = useState<Layoff[]>([]);
  const [loading, setLoading] = useState<LoadingState>({
    employees: true,
    layoffs: true,
    submit: false
  });
  const [notifications, setNotifications] = useState<Notification>({
    error: null,
    success: null
  });
  const [modalState, setModalState] = useState<ModalState>({
    open: false,
    employee: null,
    type: 'map',
    startDate: null,
    endDate: null,
    editingId: null
  });
  const [tabIndex, setTabIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

  // Configuration axios
  const axiosConfig = useMemo(() => ({
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  }), []);

  // Chargement des données
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [employeesRes, layoffsRes] = await Promise.all([
          axios.get<Employee[]>(`${API_URL}/employees`, axiosConfig),
          axios.get<Layoff[]>(`${API_URL}/layoffs`, axiosConfig)
        ]);
        
        setEmployees(employeesRes.data || []);
        setLayoffs(layoffsRes.data || []);
      } catch (err) {
        handleError("Erreur lors du chargement des données", err);
      } finally {
        setLoading(prev => ({
          ...prev,
          employees: false,
          layoffs: false
        }));
      }
    };

    fetchData();
  }, [axiosConfig]);

  // Gestion des erreurs
  const handleError = useCallback((message: string, error?: any) => {
    console.error(message, error);
    setNotifications(prev => ({
      ...prev,
      error: message
    }));
  }, []);

  // Gestion des succès
  const handleSuccess = useCallback((message: string) => {
    setNotifications(prev => ({
      ...prev,
      success: message
    }));
  }, []);

  // Fermeture des notifications
  const handleCloseNotification = useCallback(() => {
    setNotifications({
      error: null,
      success: null
    });
  }, []);

  // Gestion de la modal
  const handleOpenModal = useCallback((employee: Employee | null = null, layoff: Layoff | null = null) => {
    setModalState({
      open: true,
      employee,
      type: layoff ? (layoff.type as LayoffType) : 'map',
      startDate: layoff ? new Date(layoff.start_date) : null,
      endDate: layoff ? new Date(layoff.end_date) : null,
      editingId: layoff ? layoff.id : null
    });
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalState(prev => ({
      ...prev,
      open: false
    }));
  }, []);

  // Validation des dates
  const validateDates = useCallback(() => {
    const { startDate, endDate } = modalState;
    
    if (!startDate || !endDate) {
      handleError("Veuillez sélectionner une date de début et de fin");
      return false;
    }
    if (isBefore(endDate, startDate)) {
      handleError("La date de fin doit être après la date de début");
      return false;
    }
    if (differenceInDays(endDate, startDate) > 365) {
      handleError("La durée ne peut pas dépasser 1 an");
      return false;
    }
    return true;
  }, [modalState, handleError]);

  // Soumission du formulaire
  const handleSubmit = useCallback(async () => {
    if (!validateDates() || !modalState.employee) return;

    const { employee, startDate, endDate, type, editingId } = modalState;
    const nb_jour = differenceInDays(endDate!, startDate!) + 1;

    const layoffData = {
      employee_id: employee.id,
      start_date: format(startDate!, 'yyyy-MM-dd'),
      end_date: format(endDate!, 'yyyy-MM-dd'),
      nb_jour,
      type,
      is_purged: false
    };

    try {
      setLoading(prev => ({ ...prev, submit: true }));
      
      if (editingId) {
        await axios.put(`${API_URL}/layoffs/${editingId}`, layoffData, axiosConfig);
        handleSuccess("Mise à jour avec succès");
      } else {
        await axios.post(`${API_URL}/layoffs`, layoffData, axiosConfig);
        handleSuccess("Crée avec succès");
      }

      // Rafraîchir les données
      const res = await axios.get<Layoff[]>(`${API_URL}/layoffs`, axiosConfig);
      setLayoffs(res.data || []);
      
      // Fermer la modal après un délai
      setTimeout(handleCloseModal, 1500);
    } catch (err) {
      handleError(
        err.response?.data?.message || 
        (editingId ? "Erreur lors de la mise à jour" : "Erreur lors de la création"),
        err
      );
    } finally {
      setLoading(prev => ({ ...prev, submit: false }));
    }
  }, [modalState, validateDates, handleSuccess, handleError, handleCloseModal, axiosConfig]);

  // Suppression d'un layoff
  const handleDelete = useCallback(async (id: number) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cette mise à pied ?")) return;

    try {
      setLoading(prev => ({ ...prev, submit: true }));
      await axios.delete(`${API_URL}/layoffs/${id}`, axiosConfig);
      handleSuccess("Mise à pied supprimée avec succès");
      
      const res = await axios.get<Layoff[]>(`${API_URL}/layoffs`, axiosConfig);
      setLayoffs(res.data || []);
    } catch (err) {
      handleError("Erreur lors de la suppression", err);
    } finally {
      setLoading(prev => ({ ...prev, submit: false }));
    }
  }, [axiosConfig, handleSuccess, handleError]);

  // Filtrage des données
  const filteredEmployees = useMemo(() => 
    employees.filter(emp =>
      emp.name?.toLowerCase().includes(searchTerm.toLowerCase())
    ),
  [employees, searchTerm]);

  const filteredLayoffs = useMemo(() => 
    layoffs.filter(layoff => {
      const employee = employees.find(emp => emp.id === layoff.employee_id);
      return employee?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    }),
  [layoffs, employees, searchTerm]);

  // Gestion des changements de dates dans la modal
  const handleDateChange = useCallback((field: 'startDate' | 'endDate', value: Date | null) => {
    setModalState(prev => {
      if (field === 'startDate' && value && prev.endDate && isBefore(prev.endDate, value)) {
        return {
          ...prev,
          [field]: value,
          endDate: addDays(value, 1)
        };
      }
      return {
        ...prev,
        [field]: value
      };
    });
  }, []);

  const handleTypeChange = useCallback((type: LayoffType) => {
    setModalState(prev => ({
      ...prev,
      type
    }));
  }, []);

  return (
    <Card sx={{ boxShadow: 3, minHeight: '80vh' }}>
      <CardContent>
        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={fr}>
          {/* En-tête */}
          <Box display="flex" alignItems="center" mb={2}>
            <Typography sx={{color: '#27aae0'}} variant="h6" gutterBottom>
              GESTION DES INDISPONIBILITES
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
          
          <Snackbar
            open={!!notifications.success}
            autoHideDuration={4000}
            onClose={handleCloseNotification}
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          >
            <Alert severity="success" onClose={handleCloseNotification}>
              {notifications.success}
            </Alert>
          </Snackbar>

          {/* Onglets */}
          <Tabs 
            value={tabIndex} 
            onChange={(_, newIndex) => setTabIndex(newIndex)} 
            sx={{ mb: 3 }}
            indicatorColor="primary"
            textColor="primary"
          >
            <Tab icon={<Add/>} label="AJOUTER" />
            <Tab icon={<Dangerous/>} label="MISE A PIED" />
            <Tab icon={<TaskAlt/>} label="CONGES NORMAUX" />
            <Tab icon={<DoneAll/>} label="CONGES EXCEPTIONNELS" />
            <Tab icon={<Sick/>} label="CONGES MALADIES" />
            <Tab icon={<Warning/>} label="ACCIDENTS DE TRAVAIL" />
            <Tab icon={<LocalHospital/>} label="RDV MEDICAL" />
          </Tabs>

          {/* Contenu des onglets */}
          {tabIndex === 0 && (
            /* Onglet Ajout un nouveau */
            <Box>
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
                <List sx={{ maxHeight: '60vh', overflow: 'auto' }}>
                  {filteredEmployees.map(employee => (
                    <ListItem
                      key={employee.id}
                      button
                      onClick={() => handleOpenModal(employee)}
                      sx={{
                        '&:hover': { backgroundColor: 'action.hover' },
                        borderRadius: 1,
                        mb: 1
                      }}
                    >
                      <ListItemAvatar>
                        <Avatar src={employee?.avatar} ></Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={employee.name}
                        secondary={employee.attendance_id}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          )}

          {(tabIndex >= 1 && tabIndex <= 6) && (
            /* Onglets avec listes de layoffs */
            <Box>
              <TextField
                fullWidth
                size='small'
                variant="outlined"
                label="Rechercher par employé"
                InputProps={{
                  startAdornment: <Search color="action" sx={{ mr: 1 }} />
                }}
                sx={{ mb: 3 }}
                onChange={(e) => setSearchTerm(e.target.value)}
              />

              {loading.layoffs ? (
                <Box display="flex" justifyContent="center" py={4}>
                  <CircularProgress size={60} />
                </Box>
              ) : filteredLayoffs.length > 0 ? (
                <List sx={{ maxHeight: '50vh', overflow: 'auto' }}>
                  {filteredLayoffs
                    .filter(layoff => {
                      // Filtre selon l'onglet sélectionné
                      const tabFilters = [
                        'map', // Tab 1
                        'conge', // Tab 2
                        'cg_dcs|cg_naissance|cg_mariage|cg_cir', // Tab 3
                        'cg_maladie', // Tab 4
                        'accident', // Tab 5
                        'rdv_medical' // Tab 6
                      ];
                      const regex = new RegExp(tabFilters[tabIndex - 1]);
                      return regex.test(layoff.type);
                    })
                    .map(layoff => {
                      const employee = employees.find(emp => emp.id === layoff.employee_id);
                      return (
                        <LayoffListItem
                          key={layoff.id}
                          layoff={layoff}
                          employee={employee}
                          onEdit={handleOpenModal}
                          onDelete={handleDelete}
                          loading={loading.submit}
                        />
                      );
                    })}
                </List>
              ) : (
                <Box textAlign="center" py={4}>
                  <Typography variant="body1" color="text.secondary">
                    Aucun enregistrement trouvé
                  </Typography>
                </Box>
              )}
            </Box>
          )}

          {/* Modal */}
          <LayoffModal
            state={modalState}
            onClose={handleCloseModal}
            onSubmit={handleSubmit}
            onDateChange={handleDateChange}
            onTypeChange={handleTypeChange}
            loading={loading.submit}
            notification={notifications.error}
          />
        </LocalizationProvider>
      </CardContent>
    </Card>
  );
};

export default EmployeeLayoffComponent;