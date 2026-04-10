import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { 
  Modal, List, Button, TextField, 
  Box, Typography, IconButton, Tabs, Tab, 
  ListItemAvatar, Avatar, Card, CardContent,
  CircularProgress, Alert, Chip, Divider, Snackbar, ListItem, ListItemText,
  Select, MenuItem, Radio, RadioGroup, FormControlLabel, FormControl, FormLabel
} from '@mui/material';
import { 
  Edit, Delete, Search, Person, Today, Close, Add, Exposure, SocialDistance, 
  TaskAlt, Warning, Dangerous, Sick, LocalHospital, DoneAll, PersonAdd, 
  ExitToApp, BeachAccess, Stars, MedicalServices, MedicalInformation, Gavel, LaptopMac,
  FileDownload, 
  AssignmentTurnedIn
} from '@mui/icons-material';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import fr from 'date-fns/locale/fr';
import { format, differenceInDays, addDays, isBefore, differenceInBusinessDays } from 'date-fns';
import * as XLSX from 'xlsx';

import apiConfig from "../config/Endpoint";

// Types
interface Employee {
  id: number;
  name: string;
  attendance_id: string;
  payroll_id?: string;
  avatar?: string;
  department_id?: number;
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

interface Department {
  id: number;
  name: string;
}

interface SelectionMode {
  type: 'department' | 'individual';
  selectedDepartment: number | null;
  selectedEmployees: number[];
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
  | 'avertissement'
  | 'mission'
  | 'remote';

interface ModalState {
  open: boolean;
  employee: Employee | null;
  employees: Employee[];
  type: LayoffType;
  startDate: Date | null;
  endDate: Date | null;
  editingId: number | null;
  motif: string;
  isMultiple: boolean;
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

interface DeleteModalState {
  open: boolean;
  idToDelete: number | null;
}

// Constantes
const API_URL = apiConfig.baseUri;
const LAYOFF_TYPES: {value: LayoffType, label: string, icon: React.ReactNode}[] = [
  { value: 'map', label: 'Mise à Pied', icon: <ExitToApp /> },
  { value: 'accident', label: 'Accident de Travail', icon: <MedicalServices /> },
  { value: 'rdv_medical', label: 'RDV Médical justifié', icon: <MedicalInformation /> },
  { value: 'conge', label: 'Congé Simple', icon: <BeachAccess /> },
  { value: 'cg_maladie', label: 'Congé Maladie', icon: <Sick /> },
  { value: 'cg_dcs', label: 'Congé Décès Parental', icon: <Warning /> },
  { value: 'cg_naissance', label: 'Congé Naissance', icon: <Add /> },
  { value: 'cg_mariage', label: 'Congé Mariage', icon: <DoneAll /> },
  { value: 'cg_cir', label: 'Congé Circoncision', icon: <MedicalInformation /> },
  { value: 'blame', label: 'Blame', icon: <Gavel /> },
  { value: 'avertissement', label: 'Avertissement', icon: <Warning /> },
  { value: 'mission', label: 'Mission', icon: <AssignmentTurnedIn /> },
  { value: 'remote', label: 'Télétravail', icon: <LaptopMac /> },
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
      case 'blame': return "info";
      case 'avertissement': return "warning";
      default: return "primary";
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
              <Avatar sx={{ bgcolor: 'primary.main' }} src={employee?.avatar}>
                {employee?.name?.charAt(0)}
              </Avatar>
            </ListItemAvatar>
            <ListItemText
              primary={employee?.name || 'Inconnu'}
              secondary={`Matricule: ${employee?.attendance_id || 'Inconnu'}`}
            />
            <Chip
              label={getTypeLabel(layoff.type)}
              color={getChipColor(layoff.type)}
              size="small"
              sx={{ ml: 1 }}
            />
            {layoff.is_purged && (
              <Chip
                label="Archivée"
                sx={{ ml: 1, backgroundColor: '#f0f0f0', color: '#757575' }}
                size="small"
              />
            )}
          </Box>
          <Box display="flex" mr={2} alignItems="center">
            <Today color="primary" fontSize="small" sx={{ mr: 1 }} />
            <Typography variant="body2" color="text.secondary">
              Du {format(new Date(layoff.start_date), 'dd/MM/yyyy')} au {format(new Date(layoff.end_date), 'dd/MM/yyyy')}
            </Typography>
          </Box>
        </Box>
      </ListItem>
      {layoff.motif && (
        <Box sx={{ pl: 9, pr: 2, mb: 1 }}>
          <Typography variant="caption" color="text.secondary">
            <strong>Motif:</strong> {layoff.motif}
          </Typography>
        </Box>
      )}
      <Divider sx={{ my: 1 }} />
    </React.Fragment>
  );
};

// Créez un nouveau composant pour la modal de confirmation
const DeleteConfirmationModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}> = ({ open, onClose, onConfirm, loading }) => (
  <Modal open={open} onClose={onClose}>
    <Box sx={{
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: 400,
      bgcolor: 'background.paper',
      boxShadow: 24,
      p: 4,
      borderRadius: 2,
      outline: 'none'
    }}>
      <Typography variant="h6" gutterBottom>
        Confirmer la suppression
      </Typography>
      <Typography variant="body1" sx={{ mb: 3 }}>
        Êtes-vous sûr de vouloir supprimer cette indisponibilité ?
      </Typography>
      <Box display="flex" justifyContent="flex-end" gap={2}>
        <Button variant="outlined" onClick={onClose} disabled={loading}>
          Annuler
        </Button>
        <Button 
          variant="contained" 
          color="error" 
          onClick={onConfirm}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          Confirmer
        </Button>
      </Box>
    </Box>
  </Modal>
);

const LayoffModal: React.FC<{
  state: ModalState;
  onClose: () => void;
  onSubmit: () => void;
  onDateChange: (field: 'startDate' | 'endDate', value: Date | null) => void;
  onTypeChange: (type: LayoffType) => void;
  onMotifChange: (motif: string) => void;
  loading: boolean;
  notification: string | null;
}> = ({ state, onClose, onSubmit, onDateChange, onTypeChange, onMotifChange, loading, notification }) => {
  const duration = useMemo(() => {
    if (state.startDate && state.endDate) {
      return differenceInBusinessDays(state.endDate, state.startDate) + 1;
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
        borderRadius: 2,
        outline: 'none'
      }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h6" fontWeight="bold">
            {state.editingId ? "Modifier indisponibilité" : "Ajouter indisponibilité"}
          </Typography>
          <IconButton onClick={onClose} disabled={loading}>
            <Close />
          </IconButton>
        </Box>

        {state.isMultiple ? (
          <Box mb={3}>
            <Typography variant="subtitle2" gutterBottom>
              {state.employees.length} employé(s) sélectionné(s)
            </Typography>
            <Box sx={{ maxHeight: 120, overflow: 'auto', mb: 2 }}>
              {state.employees.map(emp => (
                <Chip
                  key={emp.id}
                  label={emp.name}
                  sx={{ m: 0.5 }}
                  avatar={<Avatar src={emp.avatar}>{emp.name.charAt(0)}</Avatar>}
                />
              ))}
            </Box>
          </Box>
        ) : state.employee ? (
          <Box display="flex" alignItems="center" mb={3}>
            <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }} src={state.employee.avatar}>
              {state.employee.name.charAt(0)}
            </Avatar>
            <Box>
              <Typography variant="body1" fontWeight="medium">
                {state.employee.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Matricule: {state.employee.attendance_id}
              </Typography>
            </Box>
          </Box>
        ) : null}

        <Box mb={3}>
          <Select
            value={state.type}
            onChange={(e) => onTypeChange(e.target.value as LayoffType)}
            fullWidth
            size="small"
            sx={{ mb: 2 }}
          >
            {LAYOFF_TYPES.map((type) => (
              <MenuItem key={type.value} value={type.value}>
                <Box display="flex" alignItems="center">
                  <Box mr={1}>{type.icon}</Box>
                  {type.label}
                </Box>
              </MenuItem>
            ))}
          </Select>

          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={fr}>
            <Box display="flex" gap={2} sx={{ mb: 2 }}>
              <DatePicker
                label="Date de début"
                value={state.startDate}
                onChange={(newDate) => onDateChange('startDate', newDate)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    size="small"
                    fullWidth
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
                    size="small"
                    fullWidth
                    error={!!notification}
                  />
                )}
              />
            </Box>
          </LocalizationProvider>

          <TextField
            label="Motif"
            multiline
            rows={3}
            fullWidth
            value={state.motif}
            onChange={(e) => onMotifChange(e.target.value)}
            error={!!notification}
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
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>({
    type: 'individual',
    selectedDepartment: null,
    selectedEmployees: []
  });
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
    employees: [],
    type: 'map',
    startDate: null,
    endDate: null,
    editingId: null,
    motif: '',
    isMultiple: false
  });
  const [editModalState, setEditModalState] = useState<ModalState>({
    open: false,
    employee: null,
    employees: [],
    type: 'map',
    startDate: null,
    endDate: null,
    editingId: null,
    motif: '',
    isMultiple: false
  });
  const [tabIndex, setTabIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

  const [deleteModalState, setDeleteModalState] = useState<DeleteModalState>({
    open: false,
    idToDelete: null
  })

 

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
        setLoading(prev => ({ ...prev, employees: true, layoffs: true }));
        
        const [employeesRes, layoffsRes, departmentsRes] = await Promise.all([
          axios.get<Employee[]>(`${API_URL}/active-employees`, axiosConfig),
          axios.get<Layoff[]>(`${API_URL}/layoffs`, axiosConfig),
          axios.get<Department[]>(`${API_URL}/departments`, axiosConfig)
        ]);
        
        setEmployees(employeesRes.data || []);
        setLayoffs(layoffsRes.data || []);
        setDepartments(departmentsRes.data || []);
        
        // Initialiser le département sélectionné s'il y a des départements
        if (departmentsRes.data?.length) {
          setSelectionMode(prev => ({
            ...prev,
            selectedDepartment: departmentsRes.data[0].id
          }));
        }
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
    setNotifications({
      error: error.response?.data?.message || message,
      success: null
    });
  }, []);

  // Gestion des succès
  const handleSuccess = useCallback((message: string) => {
    setNotifications({
      error: null,
      success: message
    });
    setTimeout(() => setNotifications({ error: null, success: null }), 4000);
  }, []);

  // Fermeture des notifications
  const handleCloseNotification = useCallback(() => {
    setNotifications({
      error: null,
      success: null
    });
  }, []);

  // Gestion de la sélection
  const handleSelectionModeChange = (type: 'department' | 'individual') => {
    setSelectionMode({
      type,
      selectedDepartment: type === 'department' ? (departments[0]?.id || null) : null,
      selectedEmployees: []
    });
  };

  const handleDepartmentChange = (departmentId: number) => {
    setSelectionMode(prev => ({
      ...prev,
      selectedDepartment: departmentId,
      selectedEmployees: []
    }));
  };

  const handleEmployeeSelect = (employeeId: number) => {
    setSelectionMode(prev => {
      const newSelectedEmployees = [...prev.selectedEmployees];
      const index = newSelectedEmployees.indexOf(employeeId);
      
      if (index === -1) {
        newSelectedEmployees.push(employeeId);
      } else {
        newSelectedEmployees.splice(index, 1);
      }
      
      return {
        ...prev,
        selectedEmployees: newSelectedEmployees
      };
    });
  };

  const handleSelectAll = () => {
    const currentEmployees = selectionMode.type === 'department' 
      ? employees.filter(emp => emp.department_id === selectionMode.selectedDepartment)
      : filteredEmployees;
    
    const allSelected = currentEmployees.every(emp => 
      selectionMode.selectedEmployees.includes(emp.id)
    );
    
    setSelectionMode(prev => ({
      ...prev,
      selectedEmployees: allSelected 
        ? [] 
        : currentEmployees.map(emp => emp.id)
    }));
  };

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
    if (differenceInBusinessDays(endDate, startDate) > 365) {
      handleError("La durée ne peut pas dépasser 1 an");
      return false;
    }
    return true;
  }, [handleError]);

  // Gestion de la modal
  const handleOpenModal = useCallback((employees: Employee[] | Employee | null = null, layoff: Layoff | null = null) => {
    if (layoff) {
      // Mode édition (toujours pour un seul employé)
      const employeeForLayoff = employees?.find(emp => emp.id === layoff.employee_id);
      setEditModalState({
        open: true,
        employee: employeeForLayoff || null,
        employees: [],
        type: layoff.type as LayoffType,
        startDate: new Date(layoff.start_date),
        endDate: new Date(layoff.end_date),
        editingId: layoff.id,
        motif: layoff.motif || '',
        isMultiple: false
      });
    } else if (Array.isArray(employees)) {
      // Mode création multiple
      setModalState({
        open: true,
        employee: null,
        employees: employees,
        type: 'map',
        startDate: null,
        endDate: null,
        editingId: null,
        motif: '',
        isMultiple: true
      });
    } else {
      // Mode création simple (un seul employé)
      setModalState({
        open: true,
        employee: employees,
        employees: [],
        type: 'map',
        startDate: null,
        endDate: null,
        editingId: null,
        motif: '',
        isMultiple: false
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

  // Soumission du formulaire
  const handleSubmit = useCallback(async () => {
    const isEditMode = modalState.editingId !== null || editModalState.editingId !== null;
    const currentState = isEditMode ? editModalState : modalState;
    
    if (!validateDates(currentState)) return;
  
    try {
      setLoading(prev => ({ ...prev, submit: true }));
      
      if (isEditMode && currentState.editingId) {
        // Mode édition
        const { employee, startDate, endDate, type, editingId, motif } = currentState;
        if (!employee || !startDate || !endDate) return;
        
        const nb_jour = differenceInBusinessDays(endDate, startDate) + 1;
      
        const layoffData = {
          employee_id: employee.id,
          start_date: format(startDate, 'yyyy-MM-dd'),
          end_date: format(endDate, 'yyyy-MM-dd'),
          nb_jour,
          type,
          is_purged: false,
          motif
        };

        await axios.put(`${API_URL}/layoffs/${editingId}`, layoffData, axiosConfig);
        handleSuccess("Mise à jour effectuée avec succès");
      } else if (currentState.isMultiple) {
        // Mode création multiple
        const { employees, startDate, endDate, type, motif } = currentState;
        if (!startDate || !endDate || employees.length === 0) return;
        
        const nb_jour = differenceInBusinessDays(endDate, startDate) + 1;
        
        const promises = employees.map(employee => {
          const layoffData = {
            employee_id: employee.id,
            start_date: format(startDate, 'yyyy-MM-dd'),
            end_date: format(endDate, 'yyyy-MM-dd'),
            nb_jour,
            type,
            is_purged: false,
            motif
          };
          
          return axios.post(`${API_URL}/layoffs`, layoffData, axiosConfig);
        });
        
        await Promise.all(promises);
        handleSuccess(`${employees.length} indisponibilité(s) créée(s) avec succès`);
      } else {
        // Mode création simple
        const { employee, startDate, endDate, type, motif } = currentState;
        if (!employee || !startDate || !endDate) return;
        
        const nb_jour = differenceInBusinessDays(endDate, startDate) + 1;
      
        const layoffData = {
          employee_id: employee.id,
          start_date: format(startDate, 'yyyy-MM-dd'),
          end_date: format(endDate, 'yyyy-MM-dd'),
          nb_jour,
          type,
          is_purged: false,
          motif
        };

        await axios.post(`${API_URL}/layoffs`, layoffData, axiosConfig);
        handleSuccess("Indisponibilité créée avec succès");
      }
  
      // Rafraîchir les données
      const res = await axios.get<Layoff[]>(`${API_URL}/layoffs`, axiosConfig);
      setLayoffs(res.data || []);
      
      // Fermer les modals
      if (isEditMode) {
        handleCloseEditModal();
      } else {
        handleCloseModal();
      }
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


  // // Suppression d'un layoff
const handleDelete = useCallback(async (id: number) => {
  try {
    setLoading(prev => ({ ...prev, submit: true }));
    await axios.delete(`${API_URL}/layoffs/${id}`, axiosConfig);
    handleSuccess("Indisponibilité supprimée avec succès");
    
    const res = await axios.get<Layoff[]>(`${API_URL}/layoffs`, axiosConfig);
    setLayoffs(res.data || []);
  } catch (err) {
    handleError("Erreur lors de la suppression", err);
  } finally {
    setLoading(prev => ({ ...prev, submit: false }));
    setDeleteModalState({ open: false, idToDelete: null });
  }
}, [axiosConfig, handleSuccess, handleError]);



  // Export Excel
  const handleExportExcel = useCallback(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    const startDateRef = new Date(currentYear, currentMonth - 1, 26);
    const endDateRef = new Date(currentYear, currentMonth, 25);
  
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
  
    const wb = XLSX.utils.book_new();
    const dataByType: Record<string, any[]> = {};
    
    filteredLayoffs.forEach(layoff => {
      const employee = employees.find(emp => emp.id === layoff.employee_id);
      const typeObj = LAYOFF_TYPES.find(t => t.value === layoff.type);
      const typeLabel = typeObj?.label || layoff.type;
      
      if (!dataByType[typeLabel]) {
        dataByType[typeLabel] = [];
      }
      
      dataByType[typeLabel].push({
        'Matricule': employee?.attendance_id || 'Inconnu',
        'Employé': employee?.name || 'Inconnu',
        'Type': typeLabel,
        'Date début': format(new Date(layoff.start_date), 'dd/MM/yyyy'),
        'Date fin': format(new Date(layoff.end_date), 'dd/MM/yyyy'),
        'Durée (jours)': layoff.nb_jour,
        'Motif': layoff.motif || 'Non spécifié'
      });
    });
  
    Object.entries(dataByType).forEach(([type, data]) => {
      const sheetName = type.substring(0, 31);
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });
  
    const fileName = `indisponibilites_${format(startDateRef, 'ddMM')}_au_${format(endDateRef, 'ddMMyyyy')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }, [layoffs, employees]);

  // Filtrage des données
  const filteredEmployees = useMemo(() => 
    employees.filter(emp =>
      emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      emp.attendance_id?.toString().includes(searchTerm.toLowerCase())
    ),
  [employees, searchTerm]);

  const filteredLayoffs = useMemo(() => 
    layoffs.filter(layoff => {
      const employee = employees.find(emp => emp.id === layoff.employee_id);
      return (
        employee?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee?.attendance_id?.toString().includes(searchTerm.toLowerCase())
      );
    }),
  [layoffs, employees, searchTerm]);

  // Gestion des changements dans la modal
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

     // Fonction pour ouvrir la modal de confirmation

const handleOpenDeleteModal = useCallback((id: number) => {
  setDeleteModalState({ open: true, idToDelete: id });
}, []);

  const handleTypeChange = useCallback((type: LayoffType, isEditModal = false) => {
    const setState = isEditModal ? setEditModalState : setModalState;
    setState(prev => ({
      ...prev,
      type
    }));
  }, []);

  const handleMotifChange = useCallback((motif: string, isEditModal = false) => {
    const setState = isEditModal ? setEditModalState : setModalState;
    setState(prev => ({
      ...prev,
      motif
    }));
  }, []);

  return (
    <Card sx={{ boxShadow: 3, minHeight: '80vh' }}>
      <CardContent>
        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={fr}>
          {/* En-tête */}
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography sx={{ color: '#27aae0' }} variant="h6" gutterBottom>
              GESTION DES INDISPONIBILITÉS
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
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab icon={<PersonAdd />} label="AJOUTER" />
            <Tab icon={<ExitToApp />} label="MISE À PIED" /> 
            <Tab icon={<BeachAccess />} label="CONGÉS" />
            <Tab icon={<Stars />} label="CONGÉS EXCEPT." /> 
            <Tab icon={<Sick />} label="MALADIE" />
            <Tab icon={<MedicalServices />} label="ACCIDENTS" />
            <Tab icon={<MedicalInformation />} label="RDV MÉDICAL" />
            <Tab icon={<Gavel />} label="BLÂME" /> 
            <Tab icon={<Warning />} label="AVERTISSEMENT" />
            <Tab icon={<AssignmentTurnedIn />} label="MISSION" />
            <Tab icon={<LaptopMac />} label="TELETRAVAIL" />
          </Tabs>

          {/* Contenu des onglets */}
          {tabIndex === 0 && (
            <Box>
              <FormControl component="fieldset" sx={{ mb: 2 }}>
                <FormLabel component="legend">Mode de sélection</FormLabel>
                <RadioGroup 
                  row 
                  value={selectionMode.type} 
                  onChange={(e) => handleSelectionModeChange(e.target.value as 'department' | 'individual')}
                >
                  <FormControlLabel value="individual" control={<Radio />} label="Par employé" />
                  <FormControlLabel value="department" control={<Radio />} label="Par département" />
                </RadioGroup>
              </FormControl>

              {selectionMode.type === 'department' && (
                <Box mb={2}>
                  <Select
                    value={selectionMode.selectedDepartment || ''}
                    onChange={(e) => handleDepartmentChange(Number(e.target.value))}
                    fullWidth
                    size="small"
                  >
                    {departments.map(dept => (
                      <MenuItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </MenuItem>
                    ))}
                  </Select>
                </Box>
              )}

              <Box display="flex"  alignItems="center" mb={2} gap={2}>
                <TextField
                  fullWidth
                  size="small"
                  variant="outlined"
                  label="Rechercher un employé"
                  InputProps={{
                    startAdornment: <Search color="action" sx={{ mr: 1 }} />
                  }}
                
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Button
                  variant="outlined"
                  sx={{width:250}}
                  onClick={handleSelectAll}
                  disabled={loading.employees}
              
                >
                 Tout sélectionner
                </Button>
          
                <Button
                  variant="contained"
                  sx={{width:200}}
                  onClick={() => {
                  const selectedEmployees = employees.filter(emp => 
                      selectionMode.selectedEmployees.includes(emp.id)
                    );
                    handleOpenModal(selectedEmployees);
                  }}
                    disabled={selectionMode.selectedEmployees.length === 0}
                    startIcon={<Add />}
                    >
                      Ajouter ({selectionMode.selectedEmployees.length})
                </Button>
              
              </Box>

              {loading.employees ? (
                <Box display="flex" justifyContent="center" py={4}>
                  <CircularProgress size={60} />
                </Box>
              ) : (
                <>
                  <List sx={{ maxHeight: '50vh', overflow: 'auto' }}>
                    {filteredEmployees
                      .filter(emp => 
                        selectionMode.type === 'department' 
                          ? emp.department_id === selectionMode.selectedDepartment
                          : true
                      )
                      .map(employee => (
                        <ListItem
                          key={employee.id}
                          button
                          onClick={() => handleEmployeeSelect(employee.id)}
                          selected={selectionMode.selectedEmployees.includes(employee.id)}
                          sx={{
                            '&:hover': { backgroundColor: 'action.hover' },
                            borderRadius: 1,
                            mb: 1
                          }}
                        >
                          <ListItemAvatar>
                            <Avatar src={employee.avatar} sx={{ bgcolor: 'primary.main' }}>
                              {employee.name.charAt(0)}
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={employee.name}
                            secondary={`Matricule: ${employee.attendance_id}`}
                          />
                          {selectionMode.selectedEmployees.includes(employee.id) && (
                            <TaskAlt color="primary" />
                          )}
                        </ListItem>
                      ))}
                  </List>
                </>
              )}
            </Box>
          )}

          {(tabIndex >= 1 && tabIndex <= 10) && (
            <Box>
              <TextField
                fullWidth
                size="small"
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
                <List sx={{ maxHeight: '60vh', overflow: 'auto' }}>
                  {filteredLayoffs
                    .filter(layoff => {
                      const tabFilters = [
                        'map',
                        'conge',
                        'cg_dcs|cg_naissance|cg_mariage|cg_cir',
                        'cg_maladie', // Tab 4
                        'accident', // Tab 5
                        'rdv_medical', // Tab 6
                        'blame', // Tab 7
                        'avertissement', // Tab 8
                        'mission', // Tab 9
                        'remote' // Tab 10 : Télétravail
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
                          onEdit={() => handleOpenModal(employees, layoff)}
                          onDelete={handleOpenDeleteModal}
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
            onMotifChange={(motif) => handleMotifChange(motif, false)}
            loading={loading.submit}
            notification={notifications.error}
          />

          {/* Modal d'édition */}
          <LayoffModal
            state={editModalState}
            onClose={handleCloseEditModal}
            onSubmit={handleSubmit}
            onDateChange={(field, value) => handleDateChange(field, value, true)}
            onTypeChange={(type) => handleTypeChange(type, true)}
            onMotifChange={(motif) => handleMotifChange(motif, true)}
            loading={loading.submit}
            notification={notifications.error}
          />

          <DeleteConfirmationModal
            open={deleteModalState.open}
            onClose={() => setDeleteModalState({ open: false, idToDelete: null })}
            onConfirm={() => deleteModalState.idToDelete && handleDelete(deleteModalState.idToDelete)}
            loading={loading.submit}
          />
        </LocalizationProvider>
      </CardContent>
    </Card>
  );
};

export default EmployeeLayoffComponent;