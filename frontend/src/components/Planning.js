import React, { useState, useEffect } from 'react';
import {
  Card, CardContent, Typography, Box, TextField, Button, Dialog, DialogActions, DialogContent, DialogTitle,
  Select, MenuItem, FormControl, InputLabel, Checkbox, CircularProgress, IconButton, Table, TableHead, TableBody, TableRow, TableCell
} from '@mui/material';
import { Add, Edit, Delete } from '@mui/icons-material';
import axios from 'axios';
import { format, differenceInDays, addDays, isBefore } from 'date-fns';
import apiConfig from '../config/Endpoint';

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const Planning = () => {
  const [shifts, setShifts] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [openExceptionDialog, setOpenExceptionDialog] = useState(false);
  const [editShiftId, setEditShiftId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [newShift, setNewShift] = useState({
    shift_name: '',
    department_ids: [],
    start_date: '',
    end_date: '',
    schedule: daysOfWeek.reduce((acc, day) => ({ ...acc, [day.toLowerCase()]: { start: '', end: '', break: '', off: false } }), {}),
  });
  const [editShift, setEditShift] = useState(null);
  const [exceptionShift, setExceptionShift] = useState({
    shift_name: '',
    selectedDepartment: '',
    employee_ids: [],
    date: '',
    start_time: '',
    end_time: '',
    break_duration: ''
  });
  const [filteredEmployees, setFilteredEmployees] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [shiftsResponse, departmentsResponse, employeesResponse] = await Promise.all([
        axios.get(apiConfig.Endpoint.shift),
        axios.get(apiConfig.Endpoint.departments),
        axios.get(apiConfig.Endpoint.employees),
      ]);

      setShifts(shiftsResponse.data || []);
      setDepartments(departmentsResponse.data || []);
      setEmployees(employeesResponse.data || []);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (day, field, value, isEditMode) => {
    if (isEditMode) {
      setEditShift((prev) => ({
        ...prev,
        schedule: {
          ...prev.schedule,
          [day]: { ...prev.schedule[day], [field]: value },
        },
      }));
    } else {
      setNewShift((prev) => ({
        ...prev,
        schedule: {
          ...prev.schedule,
          [day]: { ...prev.schedule[day], [field]: value },
        },
      }));
    }
  };

  const handleAddShift = async () => {
    if (!newShift.shift_name || newShift.department_ids.length === 0 || !newShift.start_date || !newShift.end_date) {
      setError('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        shift_name: newShift.shift_name,
        department_ids: newShift.department_ids,
        start_date: newShift.start_date,
        end_date: newShift.end_date,
        schedule: newShift.schedule,
      };

      await axios.post(apiConfig.Endpoint.shift, payload);
      fetchData();
      setOpenCreateDialog(false);
      setNewShift({
        shift_name: '',
        department_ids: [],
        start_date: '',
        end_date: '',
        schedule: daysOfWeek.reduce((acc, day) => ({ ...acc, [day.toLowerCase()]: { start: '', end: '', break: '', off: false } }), {}),
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateShift = async () => {
    if (!editShift.shift_name || editShift.department_ids.length === 0 || !editShift.start_date || !editShift.end_date) {
      setError('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        shift_name: editShift.shift_name,
        department_ids: editShift.department_ids,
        start_date: editShift.start_date,
        end_date: editShift.end_date,
        schedule: editShift.schedule,
      };

      await axios.put(`${apiConfig.Endpoint.shift}/${editShiftId}`, payload);
      fetchData();
      setOpenEditDialog(false);
      setEditShift(null);
      setEditShiftId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEditShift = (shift) => {
    setEditShift({
      shift_name: shift.shift_name,
      department_ids: shift.department_ids || [],
      start_date: shift.start_date,
      end_date: shift.end_date,
      schedule: daysOfWeek.reduce((acc, day) => ({
        ...acc,
        [day.toLowerCase()]: {
          start: shift[`${day.toLowerCase()}_start`] || '',
          end: shift[`${day.toLowerCase()}_end`] || '',
          break: shift[`${day.toLowerCase()}_break`] || '',
          off: shift[`${day.toLowerCase()}_off`] || false,
        },
      }), {}),
    });
    setEditShiftId(shift.id);
    setOpenEditDialog(true);
  };

  const handleDeleteShift = async (shiftId) => {
    setLoading(true);
    try {
      await axios.delete(`${apiConfig.Endpoint.shift}/${shiftId}`);
      fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDepartmentChange = (event, isEditMode) => {
    const { value } = event.target;
    if (value.includes("all")) {
      if (isEditMode) {
        setEditShift((prev) => ({
          ...prev,
          department_ids: departments.map(dept => dept.id),
        }));
      } else {
        setNewShift((prev) => ({
          ...prev,
          department_ids: departments.map(dept => dept.id),
        }));
      }
    } else {
      if (isEditMode) {
        setEditShift((prev) => ({
          ...prev,
          department_ids: value,
        }));
      } else {
        setNewShift((prev) => ({
          ...prev,
          department_ids: value,
        }));
      }
    }
  };

  const handleAddExceptionShift = async () => {
    if (!exceptionShift.shift_name || !exceptionShift.selectedDepartment || 
        exceptionShift.employee_ids.length === 0 || !exceptionShift.date || 
        !exceptionShift.start_time || !exceptionShift.end_time) {
      setError('Veuillez remplir tous les champs obligatoires.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        shift_name: exceptionShift.shift_name,
        employee_ids: exceptionShift.employee_ids,
        date: exceptionShift.date,
        start_time: exceptionShift.start_time,
        end_time: exceptionShift.end_time,
        break_duration: exceptionShift.break_duration || 0,
        is_exception: true
      };

      await axios.post(apiConfig.Endpoint.shift, payload);
      fetchData();
      setOpenExceptionDialog(false);
      setExceptionShift({
        shift_name: '',
        selectedDepartment: '',
        employee_ids: [],
        date: '',
        start_time: '',
        end_time: '',
        break_duration: ''
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDepartmentChangeForException = (event) => {
    const departmentId = event.target.value;
    setExceptionShift(prev => ({
      ...prev,
      selectedDepartment: departmentId,
      employee_ids: []
    }));

    if (departmentId) {
      const filtered = employees.filter(emp => emp.department_id === departmentId);
      setFilteredEmployees(filtered);
    } else {
      setFilteredEmployees([]);
    }
  };

  const handleEmployeeSelection = (event) => {
    const { value } = event.target;
    setExceptionShift(prev => ({
      ...prev,
      employee_ids: value
    }));
  };



  if (loading) return <CircularProgress />;
  if (error) return <Typography color="error">{error}</Typography>;

  return (
    <Card>
      <CardContent>
        
        <Typography sx={{color: '#27aae0'}} variant="h6" gutterBottom>
                  GESTION DES SHIFTS ET PLANNINGS
        </Typography>

        <Button variant="contained" color="primary" onClick={() => setOpenCreateDialog(true)} startIcon={<Add />}>Ajouter un shift</Button>

        <Button sx={{ml: 5}} variant="contained" color="secondary" onClick={() => setOpenExceptionDialog(true)} startIcon={<Add />}>
          Ajouter un planning exceptionnel
        </Button>
        
        {/* Tableau des Shifts */}
        <Box sx={{ marginTop: 2 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Nom</TableCell>
                <TableCell>Départements</TableCell>
                <TableCell>Période</TableCell>
                {daysOfWeek.map((day) => (
                  <TableCell key={day}>{day}</TableCell>
                ))}
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {shifts?.map((shift) => (
                <TableRow key={shift.id}>
                  <TableCell>{shift.shift_name}</TableCell>
                  <TableCell>
                    {shift.department_ids?.map(id => departments.find(dept => dept.id === id)?.name).join(', ')}
                  </TableCell>
                  <TableCell> Valide du {format(new Date(shift.start_date), 'dd/MM/yyyy')} au {format(new Date(shift.end_date), 'dd/MM/yyyy')}</TableCell>
                  {daysOfWeek.map((day) => {
                    const dayLower = day.toLowerCase();
                    const start = shift[`${dayLower}_start`];
                    const end = shift[`${dayLower}_end`];
                    const breakObject = shift[`${dayLower}_break`];
                    const breakInfo = breakObject?.start && breakObject?.end ? `${breakObject.start} - ${breakObject.end}` : breakObject?.duration || 'Sans pause';

                    return (
                      <TableCell key={day}>
                        {start && end ? `${start} - ${end} (Pause: ${breakObject} mn)` : 'OFF'}
                      </TableCell>
                    );
                  })}
                  <TableCell>
                    <IconButton onClick={() => handleEditShift(shift)}>
                      <Edit />
                    </IconButton>
                    <IconButton onClick={() => handleDeleteShift(shift.id)}>
                      <Delete />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </CardContent>

      {/* Modal de Création */}
      <Dialog maxWidth="md" fullWidth open={openCreateDialog} onClose={() => setOpenCreateDialog(false)}>
        <DialogTitle>Créer un nouveau shift</DialogTitle>
        <DialogContent>
          <TextField
            label="Nom du shift"
            size='small'
            fullWidth
            margin="dense"
            value={newShift.shift_name}
            onChange={(e) => setNewShift({ ...newShift, shift_name: e.target.value })}
            required
          />
          <TextField
            label="Département"
            size="small"
            fullWidth
            margin="dense"
            required
            select
            SelectProps={{
              multiple: true,
              value: newShift.department_ids || [],
              onChange: (e) => handleDepartmentChange(e, false),
            }}
          >
            <MenuItem value="all">Tous les Départements</MenuItem>
            {departments?.map((dept) => (
              <MenuItem key={dept.id} value={dept.id}>
                {dept.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Date de début"
            type="date"
            size='small'
            fullWidth
            margin="dense"
            InputLabelProps={{ shrink: true }}
            value={newShift.start_date}
            onChange={(e) => setNewShift({ ...newShift, start_date: e.target.value })}
            required
          />
          <TextField
            label="Date de fin"
            type="date"
            size='small'
            fullWidth
            margin="dense"
            InputLabelProps={{ shrink: true }}
            value={newShift.end_date}
            onChange={(e) => setNewShift({ ...newShift, end_date: e.target.value })}
            required
          />

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginTop: 2 }}>
            {daysOfWeek.map((day) => {
              const dayLower = day.toLowerCase();
              return (
                <Box key={day} sx={{ flex: '1 1 200px', marginBottom: 2 }}>
                  <Typography variant="subtitle1">{day}</Typography>
                  <Checkbox
                    checked={newShift.schedule[dayLower].off}
                    onChange={(e) => handleInputChange(dayLower, 'off', e.target.checked, false)}
                  /> OFF
                  {!newShift.schedule[dayLower].off && (
                    <>
                      <TextField
                        InputLabelProps={{ shrink: true }}
                        label="Début"
                        type="time"
                        fullWidth
                        margin="dense"
                        value={newShift.schedule[dayLower].start || ''}
                        onChange={(e) => handleInputChange(dayLower, 'start', e.target.value || null, false)}
                      />
                      <TextField
                        InputLabelProps={{ shrink: true }}
                        label="Fin"
                        type="time"
                        fullWidth
                        margin="dense"
                        value={newShift.schedule[dayLower].end || ''}
                        onChange={(e) => handleInputChange(dayLower, 'end', e.target.value || null, false)}
                      />
                      <TextField
                        InputLabelProps={{ shrink: true }}
                        label="Pause"
                        type="number"
                        fullWidth
                        margin="dense"
                        value={newShift.schedule[dayLower].break || ''}
                        onChange={(e) => handleInputChange(dayLower, 'break', e.target.value || null, false)}
                      />
                    </>
                  )}
                </Box>
              );
            })}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreateDialog(false)}>Annuler</Button>
          <Button onClick={handleAddShift} color="primary">
            Créer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal de Modification */}
      <Dialog maxWidth="md" fullWidth open={openEditDialog} onClose={() => setOpenEditDialog(false)}>
        <DialogTitle>Modifier le shift</DialogTitle>
        <DialogContent>
          <TextField
            label="Nom du shift"
            size='small'
            fullWidth
            margin="dense"
            value={editShift?.shift_name || ''}
            onChange={(e) => setEditShift({ ...editShift, shift_name: e.target.value })}
            required
          />
          <TextField
            label="Département"
            size="small"
            fullWidth
            margin="dense"
            required
            select
            SelectProps={{
              multiple: true,
              value: editShift?.department_ids || [],
              onChange: (e) => handleDepartmentChange(e, true),
            }}
          >
            <MenuItem value="all">Tous les Départements</MenuItem>
            {departments?.map((dept) => (
              <MenuItem key={dept.id} value={dept.id}>
                {dept.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Date de début"
            type="date"
            size='small'
            fullWidth
            margin="dense"
            InputLabelProps={{ shrink: true }}
            value={editShift?.start_date || ''}
            onChange={(e) => setEditShift({ ...editShift, start_date: e.target.value })}
            required
          />
          <TextField
            label="Date de fin"
            type="date"
            size='small'
            fullWidth
            margin="dense"
            InputLabelProps={{ shrink: true }}
            value={editShift?.end_date || ''}
            onChange={(e) => setEditShift({ ...editShift, end_date: e.target.value })}
            required
          />

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', marginTop: 2 }}>
            {daysOfWeek.map((day) => {
              const dayLower = day.toLowerCase();
              return (
                <Box key={day} sx={{ flex: '1 1 200px', marginBottom: 2 }}>
                  <Typography variant="subtitle1">{day}</Typography>
                  <Checkbox
                    checked={editShift?.schedule[dayLower]?.off || false}
                    onChange={(e) => handleInputChange(dayLower, 'off', e.target.checked, true)}
                  /> OFF
                  {!editShift?.schedule[dayLower]?.off && (
                    <>
                      <TextField
                        InputLabelProps={{ shrink: true }}
                        label="Début"
                        type="time"
                        fullWidth
                        margin="dense"
                        value={editShift?.schedule[dayLower]?.start || ''}
                        onChange={(e) => handleInputChange(dayLower, 'start', e.target.value || null, true)}
                      />
                      <TextField
                        InputLabelProps={{ shrink: true }}
                        label="Fin"
                        type="time"
                        fullWidth
                        margin="dense"
                        value={editShift?.schedule[dayLower]?.end || ''}
                        onChange={(e) => handleInputChange(dayLower, 'end', e.target.value || null, true)}
                      />
                      <TextField
                        InputLabelProps={{ shrink: true }}
                        label="Pause"
                        type="number"
                        fullWidth
                        margin="dense"
                        value={editShift?.schedule[dayLower]?.break || ''}
                        onChange={(e) => handleInputChange(dayLower, 'break', e.target.value || null, true)}
                      />
                    </>
                  )}
                </Box>
              );
            })}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEditDialog(false)}>Annuler</Button>
          <Button onClick={handleUpdateShift} color="primary">
            Modifier
          </Button>
        </DialogActions>
      </Dialog>

       {/* Dialog pour le planning exceptionnel */}
       <Dialog open={openExceptionDialog} onClose={() => setOpenExceptionDialog(false)}>
          <DialogTitle>Créer un planning exceptionnel</DialogTitle>
          <DialogContent>
            <TextField
              label="Nom du shift"
              size='small'
              fullWidth
              margin="dense"
              value={exceptionShift.shift_name}
              onChange={(e) => setExceptionShift({ ...exceptionShift, shift_name: e.target.value })}
              required
            />
            
            <FormControl fullWidth margin="dense" size="small">
              <InputLabel>Département</InputLabel>
              <Select
                value={exceptionShift.selectedDepartment}
                onChange={handleDepartmentChangeForException}
                label="Département"
                required
              >
                {departments.map((dept) => (
                  <MenuItem key={dept.id} value={dept.id}>{dept.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            
            {exceptionShift.selectedDepartment && (
              <FormControl fullWidth margin="dense" size="small">
                <InputLabel>Employés</InputLabel>
                <Select
                  multiple
                  value={exceptionShift.employee_ids}
                  onChange={handleEmployeeSelection}
                  label="Employés"
                  required
                >
                  {filteredEmployees.map((emp) => (
                    <MenuItem key={emp.id} value={emp.id}>
                      {emp.name} {emp.attendance_id}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            
            <TextField
              label="Date"
              type="date"
              size='small'
              fullWidth
              margin="dense"
              InputLabelProps={{ shrink: true }}
              value={exceptionShift.date}
              onChange={(e) => setExceptionShift({ ...exceptionShift, date: e.target.value })}
              required
            />
            
            <TextField
              label="Heure de début"
              type="time"
              size='small'
              fullWidth
              margin="dense"
              InputLabelProps={{ shrink: true }}
              value={exceptionShift.start_time}
              onChange={(e) => setExceptionShift({ ...exceptionShift, start_time: e.target.value })}
              required
            />
            
            <TextField
              label="Heure de fin"
              type="time"
              size='small'
              fullWidth
              margin="dense"
              InputLabelProps={{ shrink: true }}
              value={exceptionShift.end_time}
              onChange={(e) => setExceptionShift({ ...exceptionShift, end_time: e.target.value })}
              required
            />
            
            <TextField
              label="Durée de pause (minutes)"
              type="number"
              size='small'
              fullWidth
              margin="dense"
              value={exceptionShift.break_duration}
              onChange={(e) => setExceptionShift({ ...exceptionShift, break_duration: e.target.value })}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenExceptionDialog(false)}>Annuler</Button>
            <Button onClick={handleAddExceptionShift} color="primary">Créer</Button>
          </DialogActions>
        </Dialog>

    </Card>
  );
};

export default Planning;