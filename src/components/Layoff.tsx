import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { 
  Modal, List, Button, TextField, 
  Box, Typography, IconButton, Tabs, Tab, 
  ListItemAvatar, Avatar, Card, CardContent,
  CircularProgress, Alert, Chip, Divider, Snackbar, ListItem, ListItemText,
} from '@mui/material';
import { Edit, Delete, Search, Person, Today, Close, Add, Exposure, SocialDistance, TaskAlt, Warning, Dangerous, Sick, LocalHospital, DoneAll, PersonAdd, 
  ExitToApp, BeachAccess ,Stars , MedicalServices
, MedicalInformation, Gavel, FileDownload }  from '@mui/icons-material';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import fr from 'date-fns/locale/fr';
import { format, differenceInDays, addDays, isBefore } from 'date-fns';
import * as XLSX from 'xlsx';

import apiConfig from "../config/Endpoint";

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
  motif: string;
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
  | 'rdv_medical'
  | 'blame'
  | 'avertissement';


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
const API_URL = apiConfig.baseUri;
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
  { value: 'blame', label: 'Blame' },
  { value: 'avertissement', label: 'Avertissement' },
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
      case 'blame': return "grey";
      case 'avertissement': return "warning";
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
  const [editModalState, setEditModalState] = useState<ModalState>({
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

    console.log(employee);
    console.log(layoff);

    if (layoff) {
      // Mode édition
      const employeeForLayoff = employees.find(emp => emp.id === layoff.employee_id);
      setEditModalState({
        open: true,
        employee: employeeForLayoff || null,
        type: layoff.type as LayoffType,
        startDate: new Date(layoff.start_date),
        endDate: new Date(layoff.end_date),
        editingId: layoff.id
      });
    } else {
      // Mode création
      setModalState({
        open: true,
        employee,
        type: 'map',
        startDate: null,
        endDate: null,
        editingId: null
      });
    }
  }, [employees]);

  const handleCloseModal = useCallback(() => {
    setModalState(prev => ({
      ...prev,
      open: false
    }));
  }, []);

  const handleCloseEditModal = useCallback(() => {
    setEditModalState(prev => ({
      ...prev,
      open: false
    }));
  }, []);

  // Validation des dates
  const validateDates = useCallback((state: ModalState) => {
    const { startDate, endDate } = state;
    
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
  }, [handleError]);

  // Soumission du formulaire
  const handleSubmit = useCallback(async () => {
    // Détermine si on est en mode édition ou création
    const isEditMode = modalState.editingId !== null || editModalState.editingId !== null;
    const currentState = isEditMode ? editModalState : modalState;
    
    if (!validateDates(currentState) || !currentState.employee) return;
  
    const { employee, startDate, endDate, type, editingId } = currentState;
    const nb_jour = differenceInDays(endDate!, startDate!) + 1;
  
    const layoffData = {
      employee_id: employee.id,
      start_date: format(startDate!, 'yyyy-MM-dd'),
      end_date: format(endDate!, 'yyyy-MM-dd'),
      nb_jour,
      type,
      is_purged: false
    };

    console.log(editingId);
  
    try {
      setLoading(prev => ({ ...prev, submit: true }));
      
      if (isEditMode) {
        await axios.put(`${API_URL}/layoffs/${editingId}`, layoffData, axiosConfig);
        handleSuccess("Mise à jour avec succès");
      } else {
        await axios.post(`${API_URL}/layoffs`, layoffData, axiosConfig);
        handleSuccess("Crée avec succès");
      }
  
      // Rafraîchir les données
      const res = await axios.get<Layoff[]>(`${API_URL}/layoffs`, axiosConfig);
      setLayoffs(res.data || []);
      
      // Fermer les modals après un délai
      setTimeout(() => {
        handleCloseModal();
        handleCloseEditModal();
      }, 1500);
    } catch (err) {
      handleError(
        err.response?.data?.message || 
        (isEditMode ? "Erreur lors de la mise à jour" : "Erreur lors de la création"),
        err
      );
    } finally {
      setLoading(prev => ({ ...prev, submit: false }));
    }
  }, [modalState, editModalState, validateDates, handleSuccess, handleError, handleCloseModal, handleCloseEditModal, axiosConfig]);

  // Suppression d'un layoff
  const handleDelete = useCallback(async (id: number) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cette indisponibilité ?")) return;

    try {
      setLoading(prev => ({ ...prev, submit: true }));
      await axios.delete(`${API_URL}/layoffs/${id}`, axiosConfig);
      handleSuccess(" Supprimée avec succès");
      
      const res = await axios.get<Layoff[]>(`${API_URL}/layoffs`, axiosConfig);
      setLayoffs(res.data || []);
    } catch (err) {
      handleError("Erreur lors de la suppression", err);
    } finally {
      setLoading(prev => ({ ...prev, submit: false }));
    }
  }, [axiosConfig, handleSuccess, handleError]);

  // Export Excel
  const handleExportExcel = useCallback(() => {
    // Obtenir les dates de référence
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    // Date de début: 26 du mois précédent
    const startDateRef = new Date(currentYear, currentMonth - 1, 26);
    
    // Date de fin: 25 du mois courant
    const endDateRef = new Date(currentYear, currentMonth, 25);
  
    // Filtrer les layoffs selon la période
    const filteredLayoffs = layoffs.filter(layoff => {
      const startDate = new Date(layoff.start_date);
      const endDate = new Date(layoff.end_date);
      
      return startDate >= startDateRef && endDate <= endDateRef;
    });
  
    if (filteredLayoffs.length === 0) {
      setNotifications({
        error: "Aucune donnée à exporter pour la période sélectionnée",
        success: null
      });
      return;
    }
  
    // Créer un nouveau workbook
    const wb = XLSX.utils.book_new();
  
    // Grouper les données par type
    const dataByType = {};
    
    filteredLayoffs.forEach(layoff => {
      const employee = employees.find(emp => emp.id === layoff.employee_id);
      const typeObj = LAYOFF_TYPES.find(t => t.value === layoff.type);
      const typeLabel = typeObj?.label || layoff.type;
      
      if (!dataByType[typeLabel]) {
        dataByType[typeLabel] = [];
      }
      
      dataByType[typeLabel].push({
        'Matricule de Paie': employee?.payroll_id || 'Inconnu',
        'Employé': employee?.name || 'Inconnu',
        'Type': typeLabel,
        'Date début': format(new Date(layoff.start_date), 'dd/MM/yyyy'),
        'Date fin': format(new Date(layoff.end_date), 'dd/MM/yyyy'),
        'Durée (jours)': layoff.nb_jour,
      });
    });
  
    // Créer une feuille pour chaque type
    Object.entries(dataByType).forEach(([type, data]) => {
      // Limiter le nom de la feuille à 31 caractères (limitation Excel)
      const sheetName = type.substring(0, 31);
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });
  
    // Nom du fichier avec la période
    const fileName = `indisponibilites_${format(startDateRef, 'ddMM')}_au_${format(endDateRef, 'ddMMyyyy')}.xlsx`;
    
    // Exporter le fichier Excel
    XLSX.writeFile(wb, fileName);
  }, [layoffs, employees]);

  // Filtrage des données
  const filteredEmployees = useMemo(() => 
    employees.filter(emp =>
      emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) || emp.attendance_id?.toString().includes(searchTerm.toLocaleLowerCase())
    ),
  [employees, searchTerm]);



  const filteredLayoffs = useMemo(() => 
    layoffs.filter(layoff => {
      const employee = employees.find(emp => emp.id === layoff.employee_id);
      return employee?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ;
    }),
  [layoffs, employees, searchTerm]);

  // Gestion des changements de dates dans la modal
const handleDateChange = useCallback((field: 'startDate' | 'endDate', value: Date | null, isEditModal = false) => {
  const setState = isEditModal ? setEditModalState : setModalState;
  
  setState(prev => {
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

const handleTypeChange = useCallback((type: LayoffType, isEditModal = false) => {
  const setState = isEditModal ? setEditModalState : setModalState;
  setState(prev => ({
    ...prev,
    type
  }));
}, []);

  return (
    <Card sx={{ boxShadow: 3, minHeight: '80vh' }}>
      <CardContent>
        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={fr}>
          {/* En-tête */}
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography sx={{color: '#27aae0'}} variant="h6" gutterBottom>
              GESTION DES INDISPONIBILITES
            </Typography>
            <Button
              variant="contained"
              color="success"
              startIcon={<FileDownload />}
              onClick={handleExportExcel}
              disabled={loading.layoffs || layoffs.length === 0}
            >
              Exporter Excel
            </Button>
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
            <Tab icon={<PersonAdd />} label="AJOUTER" />
            <Tab icon={<ExitToApp />} label="MISE A PIED" /> 
            <Tab icon={<BeachAccess />} label="CONGES NORMAUX" />
            <Tab icon={<Stars />} label="CONGES EXCEPTIONNELS" /> 
            <Tab icon={<Sick />} label="CONGES MALADIES" />
            <Tab icon={<MedicalServices />} label="ACCIDENTS DE TRAVAIL" />
            <Tab icon={<MedicalInformation />} label="RDV MEDICAL" />
            <Tab icon={<Gavel />} label="BLAME" /> 
            <Tab icon={<Warning />} label="AVERTISSEMENT" />
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

          {(tabIndex >= 1 && tabIndex <= 8) && (
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
                        'rdv_medical', // Tab 6
                        'blame',
                        'avertissement'
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

          {/* Modal d'ajout */}
          <LayoffModal
            state={modalState}
            onClose={handleCloseModal}
            onSubmit={handleSubmit}
            onDateChange={(field, value) => handleDateChange(field, value, false)}
            onTypeChange={(type) => handleTypeChange(type, false)}
            loading={loading.submit}
            notification={notifications.error}
          />

          {/* Modal d'edition */}
          <LayoffModal
            state={editModalState}
            onClose={handleCloseEditModal}
            onSubmit={handleSubmit}
            onDateChange={(field, value) => handleDateChange(field, value, true)}
            onTypeChange={(type) => handleTypeChange(type, true)}
            loading={loading.submit}
            notification={notifications.error}
          />
        </LocalizationProvider>
      </CardContent>
    </Card>
  );
};

export default EmployeeLayoffComponent;