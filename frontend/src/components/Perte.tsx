import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { 
  Modal, List, Button, TextField, 
  Box, Typography, IconButton, Tabs, Tab, 
  ListItemAvatar, Avatar, Card, CardContent,
  CircularProgress, Alert, Chip, Divider, Snackbar, ListItem, ListItemText,
  Select, MenuItem, Radio, RadioGroup, FormControlLabel, FormControl, FormLabel,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper
} from '@mui/material';
import { 
  Edit, Delete, Search, Person, Today, Close, Add, Construction, 
  TaskAlt, Warning, AttachMoney, FileDownload , PersonAdd, PanToolAlt, PanToolTwoTone
} from '@mui/icons-material';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import fr from 'date-fns/locale/fr';
import { format } from 'date-fns';
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

interface ToolLoss {
  id: number;
  employee_id: number;
  tool: string;
  price: number;
  date: string;
  is_payed: boolean;
  notes: string;
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

interface ModalState {
  open: boolean;
  employee: Employee | null;
  employees: Employee[];
  toolName: string;
  toolPrice: number;
  lossDate: Date | null;
  notes: string;
  editingId: number | null;
  isMultiple: boolean;
}

interface Notification {
  error: string | null;
  success: string | null;
}

interface LoadingState {
  employees: boolean;
  toolLosses: boolean;
  submit: boolean;
}

interface DeleteModalState {
  open: boolean;
  idToDelete: number | null;
}

// Configuration API
const API_URL = apiConfig.baseUri;

// Sous-composants
const ToolLossListItem: React.FC<{
  toolLoss: ToolLoss;
  employee: Employee | undefined;
  onEdit: (toolLoss: ToolLoss) => void;
  onDelete: (id: number) => void;
  loading: boolean;
}> = ({ toolLoss, employee, onEdit, onDelete, loading }) => {
  return (
    <React.Fragment>
        <ListItem
    sx={{
      backgroundColor: 'background.paper',
      borderRadius: 1,
      mb: 1,
      boxShadow: 1,
      justifyContent: "space-between",
      alignItems: "center",
      py: 1.5,
      px: 2
    }}
    secondaryAction={
      <Box sx={{ ml: 2 }}>
        <IconButton
          onClick={() => onEdit(toolLoss)}
          color="primary"
          disabled={loading}
          size="small"
        >
          <Edit />
        </IconButton>
        <IconButton
          onClick={() => onDelete(toolLoss.id)}
          color="error"
          disabled={loading}
          size="small"
        >
          {loading ? <CircularProgress size={20} /> : <Delete />}
        </IconButton>
      </Box>
    }
  >
    <Box width="100%" display="flex" alignItems="center" gap={2}>
      {/* Section Avatar et Info Employé */}
      <Box display="flex" alignItems="center" flexShrink={0}>
        <ListItemAvatar sx={{ minWidth: 48 }}>
          <Avatar 
            sx={{ 
              bgcolor: 'primary.main', 
              width: 40, 
              height: 40,
              mr: 1
            }} 
            src={employee?.avatar}
          >
            {employee?.name?.charAt(0)}
          </Avatar>
        </ListItemAvatar>
        <Box>
          <Typography variant="subtitle2" fontWeight="medium">
            {employee?.name || 'Inconnu'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Matricule: {employee?.attendance_id || 'Inconnu'}
          </Typography>
        </Box>
      </Box>

      {/* Section Outil et Prix */}
      <Box display="flex" flexDirection="column" alignItems="center" minWidth="120px">
        <Typography variant="body1" fontWeight="bold" noWrap>
          {toolLoss.tool}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {toolLoss.price} TND
        </Typography>
      </Box>

      {/* Statut Paiement */}
      <Box>
        <Chip
          label={toolLoss.is_payed ? "Payé" : "Non payé"}
          color={toolLoss.is_payed ? "success" : "error"}
          size="small"
          variant="outlined"
        />
      </Box>

      {/* Date */}
      <Box display="flex" alignItems="center" flexShrink={0}>
        <Today color="primary" fontSize="small" sx={{ mr: 0.5 }} />
        <Typography variant="caption" color="text.secondary">
          {format(new Date(toolLoss.date), 'dd/MM/yyyy')}
        </Typography>
      </Box>
    </Box>
        </ListItem>
      
      {toolLoss.notes && (
        <Box sx={{ pl: 9, pr: 2, mb: 1 }}>
          <Typography variant="caption" color="text.secondary">
            <strong>Notes:</strong> {toolLoss.notes}
          </Typography>
        </Box>
      )}
      <Divider sx={{ my: 1 }} />
    </React.Fragment>
  );
};

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
        Êtes-vous sûr de vouloir supprimer cette perte d'outillage ?
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

const ToolLossModal: React.FC<{
  state: ModalState;
  onClose: () => void;
  onSubmit: () => void;
  onToolNameChange: (name: string) => void;
  onToolPriceChange: (price: number) => void;
  onDateChange: (date: Date | null) => void;
  onNotesChange: (notes: string) => void;
  loading: boolean;
  notification: string | null;
}> = ({ 
  state, onClose, onSubmit, onToolNameChange, onToolPriceChange, 
  onDateChange, onNotesChange, loading, notification 
}) => {
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
            {state.editingId ? "Modifier perte d'outillage" : "Enregistrer une perte d'outillage"}
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
          <TextField
            label="Nom de l'outil"
            fullWidth
            value={state.toolName}
            onChange={(e) => onToolNameChange(e.target.value)}
            sx={{ mb: 2 }}
            error={!!notification}
          />

          <TextField
            label="Prix de l'outil (TND)"
            type="number"
            fullWidth
            value={state.toolPrice || ''}
            onChange={(e) => onToolPriceChange(Number(e.target.value))}
            InputProps={{
              inputProps: { min: 0, step: 0.01 }
            }}
            sx={{ mb: 2 }}
            error={!!notification}
          />

          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={fr}>
            <DatePicker
              label="Date de perte"
              value={state.lossDate}
              onChange={onDateChange}
              renderInput={(params) => (
                <TextField
                  {...params}
                  fullWidth
                  sx={{ mb: 2 }}
                  error={!!notification}
                />
              )}
            />
          </LocalizationProvider>

          <TextField
            label="Notes"
            multiline
            rows={3}
            fullWidth
            value={state.notes}
            onChange={(e) => onNotesChange(e.target.value)}
            error={!!notification}
          />
        </Box>

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
            disabled={loading || !state.toolName || !state.toolPrice || !state.lossDate}
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
const ToolLossComponent: React.FC = () => {
  // États
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>({
    type: 'individual',
    selectedDepartment: null,
    selectedEmployees: []
  });
  const [toolLosses, setToolLosses] = useState<ToolLoss[]>([]);
  const [loading, setLoading] = useState<LoadingState>({
    employees: true,
    toolLosses: true,
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
    toolName: '',
    toolPrice: 0,
    lossDate: null,
    notes: '',
    editingId: null,
    isMultiple: false
  });
  const [editModalState, setEditModalState] = useState<ModalState>({
    open: false,
    employee: null,
    employees: [],
    toolName: '',
    toolPrice: 0,
    lossDate: null,
    notes: '',
    editingId: null,
    isMultiple: false
  });
  const [tabIndex, setTabIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteModalState, setDeleteModalState] = useState<DeleteModalState>({
    open: false,
    idToDelete: null
  });

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
        setLoading(prev => ({ ...prev, employees: true, toolLosses: true }));
        
        const [employeesRes, toolLossesRes, departmentsRes] = await Promise.all([
          axios.get<Employee[]>(`${API_URL}/employees`, axiosConfig),
          axios.get<ToolLoss[]>(`${API_URL}/tool-losses`, axiosConfig),
          axios.get<Department[]>(`${API_URL}/departments`, axiosConfig)
        ]);
        
        setEmployees(employeesRes.data || []);
        setToolLosses(toolLossesRes.data || []);
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
          toolLosses: false
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

  // Gestion de la modal
  const handleOpenModal = useCallback((employees: Employee , toolLoss: ToolLoss | null = null) => {
    if (toolLoss) {
      // Mode édition (toujours pour un seul employé)
      const employeeForToolLoss = employees?.find(emp => emp.id === toolLoss.employee_id);
      setEditModalState({
        open: true,
        employee: employeeForToolLoss || null,
        employees: [],
        toolName: toolLoss.tool,
        toolPrice: toolLoss.price,
        lossDate: new Date(toolLoss.date),
        notes: toolLoss.notes || '',
        editingId: toolLoss.id,
        isMultiple: false
      });
    } else if (Array.isArray(employees)) {
      // Mode création multiple
      setModalState({
        open: true,
        employee: null,
        employees: employees,
        toolName: '',
        toolPrice: 0,
        lossDate: null,
        notes: '',
        editingId: null,
        isMultiple: true
      });
    } else {
      // Mode création simple (un seul employé)
      setModalState({
        open: true,
        employee: employees,
        employees: [],
        toolName: '',
        toolPrice: 0,
        lossDate: null,
        notes: '',
        editingId: null,
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
    
    if (!currentState.toolName || !currentState.toolPrice || !currentState.lossDate) {
      handleError("Veuillez remplir tous les champs obligatoires");
      return;
    }
  
    try {
      setLoading(prev => ({ ...prev, submit: true }));
      
      if (isEditMode && currentState.editingId) {
        // Mode édition
        const { employee, toolName, toolPrice, lossDate, notes, editingId } = currentState;
        if (!employee || !lossDate) return; 
      
        const toolLossData = {
          employee_id: employee.id,
          tool: toolName,
          price: toolPrice,
          date: format(lossDate, 'yyyy-MM-dd'),
          notes: notes || '',
          is_payed: false
        };

        await axios.put(`${API_URL}/tool-losses/${editingId}`, toolLossData, axiosConfig);
        handleSuccess("Mise à jour effectuée avec succès");
      } else if (currentState.isMultiple) {
        // Mode création multiple
        const { employees, toolName, toolPrice, lossDate, notes } = currentState;
        if (!lossDate || employees.length === 0) return;
        
        const promises = employees.map(employee => {
          const toolLossData = {
            employee_id: employee.id,
            tool: toolName,
            price: toolPrice,
            date: format(lossDate, 'yyyy-MM-dd'),
            notes: notes || '',
            is_payed: false
          };
          
          return axios.post(`${API_URL}/tool-losses`, toolLossData, axiosConfig);
        });
        
        await Promise.all(promises);
        handleSuccess(`${employees.length} perte(s) d'outillage créée(s) avec succès`);
      } else {
        // Mode création simple
        const { employee, toolName, toolPrice, lossDate, notes } = currentState;
        if (!employee || !lossDate) return;
      
        const toolLossData = {
          employee_id: employee.id,
          tool: toolName,
          price: toolPrice,
          date: format(lossDate, 'yyyy-MM-dd'),
          notes: notes || '',
          is_payed: false
        };

        await axios.post(`${API_URL}/tool-losses`, toolLossData, axiosConfig);
        handleSuccess("Perte d'outillage enregistrée avec succès");
      }
  
      // Rafraîchir les données
      const res = await axios.get<ToolLoss[]>(`${API_URL}/tool-losses`, axiosConfig);
      setToolLosses(res.data || []);
      
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
  }, [modalState, editModalState, handleSuccess, handleError, handleCloseModal, handleCloseEditModal, axiosConfig]);

  // Suppression d'une perte d'outillage
  const handleDelete = useCallback(async (id: number) => {
    try {
      setLoading(prev => ({ ...prev, submit: true }));
      await axios.delete(`${API_URL}/tool-losses/${id}`, axiosConfig);
      handleSuccess("Perte d'outillage supprimée avec succès");
      
      const res = await axios.get<ToolLoss[]>(`${API_URL}/tool-losses`, axiosConfig);
      setToolLosses(res.data || []);
    } catch (err) {
      handleError("Erreur lors de la suppression", err);
    } finally {
      setLoading(prev => ({ ...prev, submit: false }));
      setDeleteModalState({ open: false, idToDelete: null });
    }
  }, [axiosConfig, handleSuccess, handleError]);

  // Export Excel
  const handleExportExcel = useCallback(() => {
    if (toolLosses.length === 0) {
      setNotifications({
        error: "Aucune donnée à exporter",
        success: null
      });
      return;
    }
  
    const wb = XLSX.utils.book_new();
    const data = toolLosses.map(loss => {
      const employee = employees.find(emp => emp.id === loss.employee_id);
      return {
        'Matricule': employee?.attendance_id || 'Inconnu',
        'Employé': employee?.name || 'Inconnu',
        'Outil': loss.tool,
        'Prix (TND)': loss.price,
        'Date perte': format(new Date(loss.date), 'dd/MM/yyyy'),
        'Statut': loss.is_payed ? 'Payé' : 'Non payé',
        'Notes': loss.notes || 'Non spécifié'
      };
    });
  
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Pertes d'outillage");
  
    const fileName = `pertes_outillage_${format(new Date(), 'ddMMyyyy')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }, [toolLosses, employees]);

  // Filtrage des données
  const filteredEmployees = useMemo(() => 
    employees.filter(emp =>
      emp.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      emp.attendance_id?.toString().includes(searchTerm.toLowerCase())
    ),
  [employees, searchTerm]);

  const filteredToolLosses = useMemo(() => 
    toolLosses.filter(loss => {
      const employee = employees.find(emp => emp.id === loss.employee_id);
      return (
        employee?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee?.attendance_id?.toString().includes(searchTerm.toLowerCase()) ||
        loss.tool?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }),
  [toolLosses, employees, searchTerm]);

  // Gestion des changements dans la modal
  const handleToolNameChange = useCallback((name: string, isEditModal = false) => {
    const setState = isEditModal ? setEditModalState : setModalState;
    setState(prev => ({
      ...prev,
      toolName: name
    }));
  }, []);

  const handleToolPriceChange = useCallback((price: number, isEditModal = false) => {
    const setState = isEditModal ? setEditModalState : setModalState;
    setState(prev => ({
      ...prev,
      toolPrice: price
    }));
  }, []);

  const handleDateChange = useCallback((date: Date | null, isEditModal = false) => {
    const setState = isEditModal ? setEditModalState : setModalState;
    setState(prev => ({
      ...prev,
      lossDate: date
    }));
  }, []);

  const handleNotesChange = useCallback((notes: string, isEditModal = false) => {
    const setState = isEditModal ? setEditModalState : setModalState;
    setState(prev => ({
      ...prev,
      notes
    }));
  }, []);

  // Fonction pour ouvrir la modal de confirmation
  const handleOpenDeleteModal = useCallback((id: number) => {
    setDeleteModalState({ open: true, idToDelete: id });
  }, []);

  // Calcul des totaux
  const totalLosses = useMemo(() => {
    return filteredToolLosses.reduce((sum, loss) => sum + loss.price, 0);
  }, [filteredToolLosses]);

  const totalPaid = useMemo(() => {
    return filteredToolLosses
      .filter(loss => loss.is_payed)
      .reduce((sum, loss) => sum + loss.price, 0);
  }, [filteredToolLosses]);

  const totalUnpaid = useMemo(() => {
    return filteredToolLosses
      .filter(loss => !loss.is_payed)
      .reduce((sum, loss) => sum + loss.price, 0);
  }, [filteredToolLosses]);

  return (
    <Card sx={{ boxShadow: 3, minHeight: '80vh' }}>
      <CardContent>
        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={fr}>
          {/* En-tête */}
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography sx={{ color: '#27aae0' }} variant="h6" gutterBottom>
              GESTION DES PERTES D'OUTILLAGE
            </Typography>
            <Button
              variant="contained"
              color="success"
              startIcon={<FileDownload />}
              onClick={handleExportExcel}
              disabled={loading.toolLosses || toolLosses.length === 0}
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
            <Tab icon={<Warning />} label="TOUTES LES PERTES" />
            <Tab icon={<TaskAlt />} label="PAYÉES" />
            <Tab icon={<Warning />} label="NON PAYÉES" />
          </Tabs>

          {/* Statistiques */}
          <Box display="flex" justifyContent="space-between" mb={3}>
            <Card sx={{ minWidth: 120, backgroundColor: '#f5f5f5' }}>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Total pertes
                </Typography>
                <Typography variant="h6" color="text.primary">
                  {totalLosses} TND
                </Typography>
              </CardContent>
            </Card>
            
            <Card sx={{ minWidth: 120, backgroundColor: '#e8f5e9' }}>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Payées
                </Typography>
                <Typography variant="h6" color="success.main">
                  {totalPaid} TND
                </Typography>
              </CardContent>
            </Card>
            
            <Card sx={{ minWidth: 120, backgroundColor: '#ffebee' }}>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  Non payées
                </Typography>
                <Typography variant="h6" color="error.main">
                  {totalUnpaid} TND
                </Typography>
              </CardContent>
            </Card>
          </Box>

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

              <Box display="flex" alignItems="center" mb={2} gap={2}>
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

          {(tabIndex >= 1 && tabIndex <= 3) && (
            <Box>
              <TextField
                fullWidth
                size="small"
                variant="outlined"
                label="Rechercher par employé ou outil"
                InputProps={{
                  startAdornment: <Search color="action" sx={{ mr: 1 }} />
                }}
                sx={{ mb: 3 }}
                onChange={(e) => setSearchTerm(e.target.value)}
              />

              {loading.toolLosses ? (
                <Box display="flex" justifyContent="center" py={4}>
                  <CircularProgress size={60} />
                </Box>
              ) : filteredToolLosses.length > 0 ? (
                <>
                  <List sx={{ maxHeight: '60vh', overflow: 'auto' }}>
                    {filteredToolLosses
                      .filter(loss => {
                        if (tabIndex === 1) return true; // Toutes les pertes
                        if (tabIndex === 2) return loss.is_payed; // Payées
                        if (tabIndex === 3) return !loss.is_payed; // Non payées
                        return true;
                      })
                      .map(loss => {
                        const employee = employees.find(emp => emp.id === loss.employee_id);
                        return (
                          <ToolLossListItem
                            key={loss.id}
                            toolLoss={loss}
                            employee={employee}
                            onEdit={() => handleOpenModal(null, loss)}
                            onDelete={handleOpenDeleteModal}
                            loading={loading.submit}
                          />
                        );
                      })}
                  </List>
                </>
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
          <ToolLossModal
            state={modalState}
            onClose={handleCloseModal}
            onSubmit={handleSubmit}
            onToolNameChange={(name) => handleToolNameChange(name, false)}
            onToolPriceChange={(price) => handleToolPriceChange(price, false)}
            onDateChange={(date) => handleDateChange(date, false)}
            onNotesChange={(notes) => handleNotesChange(notes, false)}
            loading={loading.submit}
            notification={notifications.error}
          />

          {/* Modal d'édition */}
          <ToolLossModal
            state={editModalState}
            onClose={handleCloseEditModal}
            onSubmit={handleSubmit}
            onToolNameChange={(name) => handleToolNameChange(name, true)}
            
            onToolPriceChange={(price) => handleToolPriceChange(price, true)}
            onDateChange={(date) => handleDateChange(date, true)}
            onNotesChange={(notes) => handleNotesChange(notes, true)}
            loading={loading.submit}
            notification={notifications.error}
          />
  
          {/* Modal de suppression */}
          <DeleteConfirmationModal
            open={deleteModalState.open}
            onClose={() => setDeleteModalState({ open: false, idToDelete: null })}
            onConfirm={() => {
              if (deleteModalState.idToDelete) {
                handleDelete(deleteModalState.idToDelete);
              }
            }}
            loading={loading.submit}
          />
          </LocalizationProvider>
        </CardContent>
      </Card>
    );
  };
  
  export default ToolLossComponent;
