import React, { useState, useEffect } from 'react';
import {
  Box, Typography, TextField, Button, Modal, Backdrop, Fade, Card, CardContent,
  Grid, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Avatar,
  List, ListItem, MenuItem, ListItemText, Radio, FormControlLabel, Switch, Alert, Autocomplete,
  CircularProgress, Snackbar
} from '@mui/material';
import axios from 'axios';
import Spin from 'antd';
import * as XLSX from 'xlsx';
import api from '../api/api';
import { Add, CheckCircle, Cancel, Person, Description } from '@mui/icons-material';
import colorButtonStyle from '../config/Color';
import apiConfig from '../config/Endpoint';


const EmployeeList = () => {
  // États principaux
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // États pour les filtres
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('Tous');
  const [selectedStatus, setSelectedStatus] = useState('Tous');
  const [inputValue, setInputValue] = useState('');
  
  // États pour les modals
  const [openAddEmployeeModal, setOpenAddEmployeeModal] = useState(false);
  const [openEditEmployeeModal, setOpenEditEmployeeModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  
  // États pour les notifications
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  let withPreview = false 

  // États pour les Exports
  const [exportFilter, setExportFilter] = useState({
    type: 'ALL', // 'ALL', 'PFA', 'STC'
    month: new Date().getMonth(),
    
  });



  // État pour le preview des exportations
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  
  // États pour les formulaires
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    payroll_id: '',
    attendance_id: '',
    position: '',
    department_id: '',
    cin_number: '',
    cnss_number: '',
    phone_number: '',
    address: '',
    status: 'Actif',
    avatar: null,
    hire_date: '',
  });
  
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [isSTCEnabled, setIsSTCEnabled] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  // Chargement initial des données
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        await api.fetchDepartments(setDepartments);
        await api.fetchEmployees(setEmployees);
      } catch (err) {
        setError("Erreur de chargement des données");
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, []);

  // Validation des données employé
  const validateEmployee = (employee, isEdit = false) => {
    const errors = {};
    
    if (!employee.name?.toString().trim()) errors.name = "Nom requis";
    if (!employee.payroll_id?.toString().trim()) errors.payroll_id = "Matricule paie requis";
    if (!employee.attendance_id?.toString().trim()) errors.attendance_id = "Matricule pointage requis";
    if (!employee.department_id) errors.department_id = "Département requis";
    
    // Validation spécifique pour l'édition
    if (isEdit && isSTCEnabled && !employee.termination_date) {
      errors.termination_date = "Date de sortie requise pour STC";
    }
    
    // Validation format CNSS (exemple pour Tunisie)
    if (employee.cnss_number && !/^\d{8}-\d{2}$/.test(employee.cnss_number)) {
      errors.cnss_number = "Format CNSS invalide (ex: 12345678-09)";
    }
    
    // Validation téléphone
    if (employee.phone_number && !/^[0-9]{08}$/.test(employee.phone_number)) {
      errors.phone_number = "Numéro invalide (08 chiffres)";
    }
    
    return errors;
  };

  // Filtrage des employés
  const filteredEmployees = employees.filter((employee) => {
    const matchesSearchTerm =
      employee?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee?.attendance_id.toString().includes(searchTerm.toLowerCase());
    
    const matchesDepartment =
      selectedDepartment === 'Tous' || employee.department_id === selectedDepartment;

      const matchStatus = 
      selectedStatus === 'Tous' || 
      (selectedStatus === 'true' && employee.is_active === true) || 
      (selectedStatus === 'false' && employee.is_active === false);
    
    return matchesSearchTerm && matchesDepartment && matchStatus;
  });

  // Filtrage des employés par période de paie
  const filterEmployeesByPayrollPeriod = (employees, filterType, month) => {
    if (filterType === 'ALL') return employees;
  
    const getPayrollPeriod = (month) => {
      const year = new Date().getFullYear();
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      
      return {
        start: new Date(year, month - 1, 26),
        end: new Date(nextYear, nextMonth - 1, 25)
      };
    };
  
    const { start, end } = getPayrollPeriod(parseInt(month));
    const lastYear = new Date().getFullYear() - 1;
  
    if (filterType === 'PFA') {
      const lastYearPeriod = getPayrollPeriod(parseInt(month));
      lastYearPeriod.start.setFullYear(lastYear);
      lastYearPeriod.end.setFullYear(lastYear);
  
      return employees.filter(emp => {
        if (!emp.hire_date) return false;
        const hireDate = new Date(emp.hire_date);
        return hireDate >= lastYearPeriod.start && hireDate <= lastYearPeriod.end;
      });
    } else if (filterType === 'STC') {
      return employees.filter(emp => {
        if (!emp.termination_date) return false;
        const termDate = new Date(emp.termination_date);
        return termDate >= start && termDate <= end;
      });
    }
  
    return employees;
  };

  // Gestion des modals
  const handleOpenAddEmployeeModal = () => {
    setOpenAddEmployeeModal(true);
    setValidationErrors({});
  };

  const handleCloseAddEmployeeModal = () => {
    setOpenAddEmployeeModal(false);
    setNewEmployee({
      name: '',
      payroll_id: '',
      attendance_id: '',
      position: '',
      department_id: '',
      cin_number: '',
      cnss_number: '',
      phone_number: '',
      address: '',
      status: 'Actif',
      avatar: null,
      hire_date: '',
    });
    setAvatarPreview(null);
    setError('');
  };

  const handleOpenEditEmployeeModal = (employee) => {
    setSelectedEmployee(employee);
    setIsSTCEnabled(!!employee.termination_date);
    setOpenEditEmployeeModal(true);
    setValidationErrors({});
  };

  const handleCloseEditEmployeeModal = () => {
    setOpenEditEmployeeModal(false);
    setSelectedEmployee(null);
    setIsSTCEnabled(false);
    setError('');
  };

  // Gestion des images
  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    
    // Vérification de la taille
    if (file && file.size > 2 * 1024 * 1024) { // 2MB max
      setError("L'image ne doit pas dépasser 2MB");
      return;
    }
  
    if (file) {
      try {
        setIsLoading(true);
        
        // Créer FormData pour l'upload
        const formData = new FormData();
        formData.append('avatar', file);
  
        // Uploader l'image
        const uploadResponse = await axios.post(`${apiConfig.baseUri}/upload-avatar`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
  
        // Mettre à jour l'état avec le chemin de l'avatar
        const avatarPath = apiConfig.server + uploadResponse.data.avatarPath;
        setAvatarPreview(avatarPath);
        
        if (openAddEmployeeModal) {
          setNewEmployee(prev => ({ ...prev, avatar: avatarPath }));
        } else {
          setSelectedEmployee(prev => ({ ...prev, avatar: avatarPath }));
        }
  
      } catch (error) {
        console.error('Erreur upload:', error);
        setError("Échec de l'upload de l'image");
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Opérations CRUD
  const handleAddEmployee = async () => {
    const errors = validateEmployee(newEmployee);
    setValidationErrors(errors);
    
    if (Object.keys(errors).length > 0) {
      setError("Veuillez corriger les erreurs dans le formulaire");
      return;
    }

    try {
      setIsLoading(true);
      const response = await api.createEmployee(newEmployee);
      console.log("Response:", response);
      if (response.success) {
        setEmployees([...employees, response.data]);
        setSuccess("Employé ajouté avec succès");
        handleCloseAddEmployeeModal();

        await api.fetchEmployees(setEmployees); // Recharger la liste des employés

      } else {
        setError(response.message || "Erreur lors de l'ajout");
      }
    } catch (error) {
      console.error('Erreur:', error);
      setError(error.response?.data?.message || "Erreur serveur");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateEmployee = async () => {
    const errors = validateEmployee(selectedEmployee, true);
    setValidationErrors(errors);
    
    if (Object.keys(errors).length > 0) {
      setError("Veuillez corriger les erreurs dans le formulaire");
      return;
    }

    try {
      setIsLoading(true);
      const response = await api.updateEmployee(selectedEmployee.id, selectedEmployee);
      
      if (response.success) {
        setEmployees(employees.map(emp => 
          emp.id === selectedEmployee.id ? selectedEmployee : emp
        ));
        setSuccess("Employé modifié avec succès");
        handleCloseEditEmployeeModal();
        await api.fetchEmployees(setEmployees); // Recharger la liste des employés
      } else {
        setError(response.message || "Erreur lors de la modification");
      }
    } catch (error) {
      console.error('Erreur:', error);
      setError(error.response?.data?.message || "Erreur serveur");
    } finally {
      setIsLoading(false);
    }
  };

  // Fonctions utilitaires
  const FindDepartmentName = (departmentId) => {
    const department = departments.find(dept => dept.id === departmentId);
    return department ? department.name : '';
  };

// Fonction exportToExcel 
const handleExport = () => {
  const { type, month } = exportFilter;
  
  // Fonction pour déterminer la période de paie (du 26 au 25)
const getPayrollPeriod = (month, year = new Date().getFullYear()) => {
  // Validation des paramètres
  if (month < 1 || month > 12) {
    throw new Error('Le mois doit être compris entre 1 et 12');
  }

  // Calcul du mois précédent (avec gestion du changement d'année)
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;

  return {
    start: new Date(prevYear, prevMonth - 1, 26),  // 26 du mois précédent
    end: new Date(year, month - 1, 25),           // 25 du mois courant
    // Méthode pour afficher la période sous forme lisible
    toString() {
      const options = { day: '2-digit', month: '2-digit', year: 'numeric' };
      return `${this.start.toLocaleDateString('fr-FR', options)} au ${this.end.toLocaleDateString('fr-FR', options)}`;
    }
  };
};

  let dataToExport = filteredEmployees;


  /*
  if (type !== 'ALL') {
    const { start, end } = getPayrollPeriod(month);
    const lastYear = new Date().getFullYear() - 1;

    if (type === 'PFA') {
      const { start, end } = getPayrollPeriod(month);
    
      dataToExport = dataToExport.filter(emp => {
        if (!emp.hire_date || !emp.is_active) return false;
    
        const hireDate = new Date(emp.hire_date);
        const hireMonthDay = new Date(start.getFullYear(), hireDate.getMonth(), hireDate.getDate());
    
        // Si la date ajustée de l'anniversaire tombe dans la période
        return hireMonthDay >= start && hireMonthDay <= end;
      });
    } else if (type === 'STC') {
      dataToExport = dataToExport.filter(emp => {
        if (!emp.termination_date) return false;
        const termDate = new Date(emp.termination_date);
        return termDate >= start && termDate <= end;
      });
    }
  }   */

  if (type !== 'ALL') {
    const { start, end } = getPayrollPeriod(month);
  
    if (type === 'PFA') {
      dataToExport = dataToExport.filter(emp => {
        if (!emp.hire_date || !emp.is_active) return false;
  
        const hireDate = new Date(emp.hire_date);
        const hireAnniversaryThisYear = new Date(start.getFullYear(), hireDate.getMonth(), hireDate.getDate());
  
        // Ne pas inclure si embauché cette année (donc < 1 an)
        const oneYearLater = new Date(hireDate);
        oneYearLater.setFullYear(hireDate.getFullYear() + 1);
        if (oneYearLater > end) return false; // pas encore 1 an d'ancienneté
  
        return hireAnniversaryThisYear >= start && hireAnniversaryThisYear <= end;
      });
  
    } else if (type === 'STC') {
      dataToExport = dataToExport.filter(emp => {
        if (!emp.termination_date) return false;
  
        const termDate = new Date(emp.termination_date);
        return termDate >= start && termDate <= end;
      });
    }
  }


  const data = dataToExport.map(emp => ({
    Nom: emp.name,
    'Matricule Paie': emp.payroll_id,
    'Matricule Pointage': emp.attendance_id,
    Département: FindDepartmentName(emp.department_id),
    Poste: emp.position,
    'Date Recrutement': emp.hire_date,
    'Date Fin': emp.termination_date || '',
    Statut: emp.is_active ? "Actif" : "Inactif"
  }));

  if (data.length === 0) {
    setError(`Aucun employé trouvé pour ${type} ce mois`);
    return;
  }

   // Use the passed withPreview parameter or fall back to state
   const shouldShowPreview = withPreview || exportFilter.withPreview;
  
   if (shouldShowPreview) {
     setPreviewData(data);
     setShowPreview(true);
   } else {
     const ws = XLSX.utils.json_to_sheet(data);
     const wb = XLSX.utils.book_new();
     XLSX.utils.book_append_sheet(wb, ws, "Employés");
     XLSX.writeFile(wb, `export_employes_${type}_${month}.xlsx`);
     setExportModalOpen(false);
   }
};



  // Composant pour afficher une ligne du tableau (optimisation pour les grandes listes)
  const EmployeeRow = ({ employee }) => {
    const department = departments.find(dep => employee.department_id === dep.id);
    
    return (
        <TableRow onDoubleClick={() => handleOpenEditEmployeeModal(employee)} style={{ cursor: 'pointer' }}>
          <TableCell>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Avatar src={employee.avatar} sx={{ mr: 2 }}>
                {employee.avatar ? null : <Person />}
              </Avatar>
              <Box>
                <Typography>{employee.name}</Typography>
                <Typography variant="body2" color="textSecondary">{employee.attendance_id}</Typography>
              </Box>
            </Box>
          </TableCell>
          <TableCell>{employee.payroll_id}</TableCell>
          <TableCell>{department?.name}</TableCell>
          <TableCell>{employee.position}</TableCell>
          <TableCell>
            {employee.is_active ? (
              <CheckCircle color="success" />
            ) : (
              <Cancel color="error" />
            )}
          </TableCell>
        </TableRow>  
    );
  };

  return (
    <Card>
      <CardContent>
        {/* Notifications */}
        <Snackbar open={!!success} autoHideDuration={6000} onClose={() => setSuccess('')}>
          <Alert severity="success">{success}</Alert>
        </Snackbar>
        
        <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError('')}>
          <Alert severity="error">{error}</Alert>
        </Snackbar>

        <Typography sx={{ color: '#27aae0' }} variant="h6" gutterBottom>
          GESTION DU PERSONNEL
        </Typography>

        {/* Barre de filtres et actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2 }}>
          <TextField
            label="Rechercher par nom ou matricule"
            variant="outlined"
            size="small"
            sx={{ flex: 1 }}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          
          <Autocomplete
            options={departments}
            getOptionLabel={(department) => department.name}
            value={departments.find((dept) => dept.id === selectedDepartment) || null}
            onChange={(event, newValue) => {
              setSelectedDepartment(newValue ? newValue.id : "Tous");
            }}
            inputValue={inputValue}
            onInputChange={(event, newInputValue) => {
              setInputValue(newInputValue);
            }}
            renderInput={(params) => (
              <TextField {...params} size="small" label="Département" sx={{ width: 200 }} />
            )}
          />

          <TextField
            select
            size='small'
            label="Status"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            sx={{ width: 150 }}
          >
            <MenuItem value="Tous">Tous</MenuItem>
            <MenuItem value="true">Actifs</MenuItem>
            <MenuItem value="false">Départs</MenuItem>
          </TextField>
          
          <Button
            variant="contained"
            sx={colorButtonStyle.primary}
            onClick={handleOpenAddEmployeeModal}
            startIcon={<Add />}
          >
            Ajouter
          </Button>

          <Button
            variant="outlined"
            onClick={() => setExportModalOpen(true)}
            startIcon={<Description />}
          >
            Exporter
          </Button>
          <ExportModal
            open={exportModalOpen}
            onClose={() => setExportModalOpen(false)}
            onConfirm={(withPreview) => handleExport(withPreview)}
            filter={exportFilter}
            setFilter={setExportFilter}
          />
        
        </Box>

        {/* Préview des Exports */}
        {showPreview && previewData && (
          <Modal open={showPreview} onClose={() => setShowPreview(false)}>
            <Box sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '80%',
              bgcolor: 'background.paper',
              boxShadow: 24,
              p: 4,
              borderRadius: 1,
              maxHeight: '90vh',
              overflow: 'auto'
            }}>
              <Typography variant="h6" gutterBottom>
                Aperçu avant export ({previewData.length} employés)
              </Typography>
              
              <TableContainer component={Paper} sx={{ mt: 2 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Nom</TableCell>
                      <TableCell>Matricule Paie</TableCell>
                      <TableCell>Département</TableCell>
                      <TableCell>Poste</TableCell>
                      <TableCell>Date Recrutement</TableCell>
                      <TableCell>Date Fin</TableCell>
                      <TableCell>Statut</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {previewData.map((emp, index) => (
                      <TableRow key={index}>
                        <TableCell>{emp.Nom}</TableCell>
                        <TableCell>{emp['Matricule Paie']}</TableCell>
                        <TableCell>{emp.Département}</TableCell>
                        <TableCell>{emp.Poste}</TableCell>
                        <TableCell>{emp['Date Recrutement']}</TableCell>
                        <TableCell>{emp['Date Fin'] || '-'}</TableCell>
                        <TableCell>{emp.Statut}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                <Button 
                  onClick={() => setShowPreview(false)}
                  sx={{ mr: 2 }}
                  variant="outlined"
                >
                  Annuler
                </Button>
                <Button 
                  onClick={() => {
                    const ws = XLSX.utils.json_to_sheet(previewData);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, "Employés");
                    XLSX.writeFile(wb, `export_employes_${exportFilter.type}_${exportFilter.month}.xlsx`);
                    setShowPreview(false);
                    setExportModalOpen(false);
                  }}
                  variant="contained"
                  color="primary"
                >
                  Exporter
                </Button>
              </Box>
            </Box>
          </Modal>
        )}

        {/* Tableau des Employés */}
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Salarié</TableCell>
                  <TableCell>Matricule de Paie</TableCell>
                  <TableCell>Département</TableCell>
                  <TableCell>Poste</TableCell>
                  <TableCell>État</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredEmployees.map(employee => (
                  <EmployeeRow key={employee.id} employee={employee} />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Modal pour Ajouter un Employé */}
        <EmployeeModal
          open={openAddEmployeeModal}
          onClose={handleCloseAddEmployeeModal}
          employee={newEmployee}
          setEmployee={setNewEmployee}
          departments={departments}
          avatarPreview={avatarPreview}
          handleAvatarUpload={handleAvatarUpload}
          onSubmit={handleAddEmployee}
          isLoading={isLoading}
          validationErrors={validationErrors}
        />

        {/* Modal pour Modifier un Employé */}
        {selectedEmployee && (
          <EmployeeModal
            open={openEditEmployeeModal}
            onClose={handleCloseEditEmployeeModal}
            employee={selectedEmployee}
            setEmployee={setSelectedEmployee}
            departments={departments}
            avatarPreview={selectedEmployee.avatar}
            handleAvatarUpload={handleAvatarUpload}
            onSubmit={handleUpdateEmployee}
            isLoading={isLoading}
            isEditMode={true}
            isSTCEnabled={isSTCEnabled}
            setIsSTCEnabled={setIsSTCEnabled}
            validationErrors={validationErrors}
          />
        )}
      </CardContent>
    </Card>
  );
};

// Composant séparé pour le modal employé
const EmployeeModal = ({
  open,
  onClose,
  employee,
  setEmployee,
  departments,
  avatarPreview,
  handleAvatarUpload,
  onSubmit,
  isLoading,
  isEditMode = false,
  isSTCEnabled = false,
  setIsSTCEnabled = null,
  validationErrors = {}
}) => {
  return (
    <Modal
      open={open}
      onClose={onClose}
      closeAfterTransition
      BackdropComponent={Backdrop}
      BackdropProps={{ timeout: 500 }}
    >
      <Fade in={open}>
        <Box sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 600,
          bgcolor: 'background.paper',
          boxShadow: 24,
          p: 4,
          borderRadius: 2,
          maxHeight: '90vh',
          overflowY: 'auto'
        }}>
          
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <label htmlFor="avatar-upload">
              <Avatar
                src={avatarPreview || (employee.avatar && `${employee.avatar}`)}
                sx={{ width: 100, height: 100, cursor: 'pointer' }}
              >
                {avatarPreview || employee.avatar ? null : <Person fontSize="large" />}
              </Avatar>
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleAvatarUpload}
              />
            </label>
            <Box sx={{ ml: 2, width: '100%' }}>
              <TextField
                fullWidth
                required
                disabled={isEditMode}
                label="Matricule de paie"
                size="small"
                value={employee.payroll_id}
                onChange={(e) => setEmployee({ ...employee, payroll_id: e.target.value })}
                sx={{ mb: 2 }}
                error={!!validationErrors.payroll_id}
                helperText={validationErrors.payroll_id}
              />
              <TextField
                fullWidth
                required
                disabled={isEditMode}
                size="small"
                label="Matricule de pointage"
                value={employee.attendance_id}
                onChange={(e) => setEmployee({ ...employee, attendance_id: e.target.value })}
                sx={{ mb: 2 }}
                error={!!validationErrors.attendance_id}
                helperText={validationErrors.attendance_id}
              />
            </Box>
          </Box>

          <Grid container spacing={2}>

            <Grid item xs={6}>
              <TextField
                fullWidth
                required
                label="Nom complet"
                size="small"
                value={employee.name}
                onChange={(e) => setEmployee({ ...employee, name: e.target.value })}
                sx={{ mb: 2 }}
                error={!!validationErrors.name}
                helperText={validationErrors.name}
              />
              <TextField
                fullWidth
                label="Poste"
                size="small"
                value={employee.position}
                onChange={(e) => setEmployee({ ...employee, position: e.target.value })}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                select
                required
                label="Département"
                size="small"
                value={employee.department_id}
                onChange={(e) => setEmployee({ ...employee, department_id: e.target.value })}
                sx={{ mb: 2 }}
                error={!!validationErrors.department_id}
                helperText={validationErrors.department_id}
              >
                {departments.map((department) => (
                  <MenuItem key={department.id} value={department.id}>
                    {department.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                fullWidth
                label="Date de Recrutement"
                type="date"
                size="small"
                InputLabelProps={{ shrink: true }}
                value={employee.hire_date}
                onChange={(e) => setEmployee({ ...employee, hire_date: e.target.value })}
                sx={{ mb: 2 }}
              />
            </Grid>

            <Grid item xs={6}>
              <TextField
                fullWidth
                label="N° CIN"
                size="small"
                value={employee.cin_number}
                onChange={(e) => setEmployee({ ...employee, cin_number: e.target.value })}
                sx={{ mb: 2 }}
                helperText={validationErrors.cin_number}
              />
              <TextField
                fullWidth
                label="N° CNSS"
                size="small"
                value={employee.cnss_number}
                onChange={(e) => setEmployee({ ...employee, cnss_number: e.target.value })}
                sx={{ mb: 2 }}
                error={!!validationErrors.cnss_number}
                helperText={validationErrors.cnss_number}
              />
              <TextField
                fullWidth
                label="N° Téléphone"
                size="small"
                value={employee.phone_number}
                onChange={(e) => setEmployee({ ...employee, phone_number: e.target.value })}
                sx={{ mb: 2 }}
                error={!!validationErrors.phone_number}
                helperText={validationErrors.phone_number}
              />
              <TextField
                fullWidth
                label="Date de Naissance"
                size="small"
                type="date"
                value={employee.birthday_date}
                InputLabelProps={{ shrink: true }}
                onChange={(e) => setEmployee({ ...employee, birthday_date: e.target.value })}
                sx={{ mb: 2 }}
              />
            </Grid>

          </Grid>

          <TextField
                fullWidth
                label="Adresse"
                size="small"
                value={employee.address}
                onChange={(e) => setEmployee({ ...employee, address: e.target.value })}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="Plafond Assiduité"
                disabled
                size="small"
                value={employee.plafond}
                onChange={(e) => setEmployee({ ...employee, plafond: e.target.value })}
                sx={{ mb: 2 }}
              />

          {isEditMode && (
            <>
              <FormControlLabel
                control={
                  <Switch
                    checked={isSTCEnabled}
                    onChange={(e) => setIsSTCEnabled(e.target.checked)}
                  />
                }
                label="STC"
                sx={{ mb: 2 }}
              />
              
              {isSTCEnabled && (
                <TextField
                  fullWidth
                  label="Date de Sortie"
                  type="date"
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  value={employee.termination_date || ''}
                  onChange={(e) => setEmployee({ ...employee, is_active:false, termination_date: e.target.value })}
                  sx={{ mb: 2 }}
                  error={!!validationErrors.termination_date}
                  helperText={validationErrors.termination_date}
                />
              )}
            </>
          )}

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Button 
              onClick={onClose} 
              sx={{ mr: 2, ...colorButtonStyle.secondary }}
              disabled={isLoading}
            >
              Annuler
            </Button>
            <Button 
              onClick={onSubmit} 
              variant="contained"
              sx={colorButtonStyle.primary}
              disabled={isLoading}
            >
              {isLoading ? <CircularProgress size={24} /> : isEditMode ? "Enregistrer" : "Ajouter"}
            </Button>
          </Box>
        </Box>
      </Fade>
    </Modal>
  );
};

// Composant modal pour exporter les employés
const ExportModal = ({ open, onClose, onConfirm, filter, setFilter }) => {
  return (
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
        borderRadius: 1
      }}>
        <Typography variant="h6" gutterBottom>Options d'export</Typography>
        
        <TextField
          select
          fullWidth
          size='small'
          label="Type d'export"
          value={filter.type}
          onChange={(e) => setFilter({...filter, type: e.target.value})}
          sx={{ mb: 2 }}
        >
          <MenuItem value="ALL">La Liste Selectionnée</MenuItem>
          <MenuItem value="PFA">PFA (Prime de Fin d'Année)</MenuItem>
          <MenuItem value="STC">STC (Départs)</MenuItem>
        </TextField>

        {filter.type !== 'ALL' && (
          <TextField
            select
            fullWidth
            label="Mois de paie"
            value={filter.month}
            onChange={(e) => setFilter({...filter, month: e.target.value})}
            sx={{ mb: 2 }}
          >
            {Array.from({length: 12}, (_, i) => i + 1).map(month => (
              <MenuItem key={month} value={month}>
                {new Date(0, month - 1).toLocaleString('default', {month: 'long'})}
              </MenuItem>
            ))}
          </TextField>
        )}

      <FormControlLabel
        control={
          <Switch
            checked={filter.withPreview || false}
            onChange={(e) => setFilter({...filter, withPreview: e.target.checked})}
          />
        }
        label="Aperçu avant export"
        sx={{ mb: 3 }}
      />

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        <Button onClick={onClose} variant="outlined">Annuler</Button>
        <Button 
          onClick={() => onConfirm(filter.withPreview)} 
          variant="contained" 
          color="primary"
        >
          {filter.withPreview ? "Voir l'aperçu" : "Exporter"}
        </Button>
      </Box>
     </Box> 
    </Modal>
  );
};



export default EmployeeList;