import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, TextField, Button, Box, Modal, Typography, Autocomplete } from '@mui/material';
import { Add, CheckCircle, Cancel, Person } from '@mui/icons-material';
import colorButtonStyle from '../config/Color';
import api from '../api/api';

const DepartmentComponent = () => {
    const [departments, setDepartments] = useState([]);
    const [employees, setEmployees] = useState([]); // State to store employees
    const [newDepartment, setNewDepartment] = useState({ code: '', name: '', responsable_id: '' });
    const [editingDepartment, setEditingDepartment] = useState(null);
    const [searchQuery, setSearchQuery] = useState(''); // State for search query
    const [openModal, setOpenModal] = useState(false); // State to control modal visibility
    const [selectedResponsable, setSelectedResponsable] = useState(null);


    // Fetch departments and employees from the API
    useEffect(() => {
        api.fetchDepartments(setDepartments);
        api.fetchEmployees(setEmployees); // Fetch employees when the component mounts
    }, []);

    const fetchDepartments = async () => {
        try {
            const response = await axios.get('http://localhost:5000/api/departments');
            setDepartments(response.data);
        } catch (error) {
            console.error('Error fetching departments:', error);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        if (editingDepartment) {
            setEditingDepartment({ ...editingDepartment, [name]: value });
        } else {
            setNewDepartment({ ...newDepartment, [name]: value });
        }
    };

    const handleAddDepartment = async () => {
        try {
            await axios.post('http://localhost:5000/api/departments', newDepartment);
            setNewDepartment({ code: '', name: '', responsable_id: '' });
            fetchDepartments();
            setOpenModal(false); // Close modal after adding
        } catch (error) {
            console.error('Error adding department:', error);
        }
    };

    const handleEditDepartment = (department) => {
        setEditingDepartment(department);
        setOpenModal(true); // Open modal for editing
    };

    const handleUpdateDepartment = async () => {
        try {
            await axios.put(`http://localhost:5000/api/departments/${editingDepartment.id}`, editingDepartment);
            setEditingDepartment(null);
            fetchDepartments();
            setOpenModal(false); // Close modal after updating
        } catch (error) {
            console.error('Error updating department:', error);
        }
    };

    const handleDeleteDepartment = async (id) => {
        try {
            await axios.delete(`http://localhost:5000/api/departments/${id}`);
            fetchDepartments();
        } catch (error) {
            console.error('Error deleting department:', error);
        }
    };

    const handleSearchChange = (e) => {
        setSearchQuery(e.target.value);
    };

    // Filter departments based on search query
    const filteredDepartments = departments.filter((department) =>
        department.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleResponsableChange = (event, newValue) => {
        setSelectedResponsable(newValue);
        handleInputChange({
            target: {
                name: "responsable_id",
                value: newValue ? newValue.id : ""
            }
        });
    };


    return (
        <Card>
            <CardContent>
                <Typography sx={{color: '#27aae0'}} variant="h6" gutterBottom>
                          GESTION DES DEPARTEMENTS
                </Typography>
                {/* Sticky Search Bar */}
                <Box sx={{ position: 'sticky', top: 0, bgcolor: 'background.paper', zIndex: 1, py: 2, justifyContent: 'space-between', display: 'flex' }}>
                    <TextField
                        fullWidth
                        size='small'
                        variant="outlined"
                        placeholder="Rechercher un département..."
                        value={searchQuery}
                        onChange={handleSearchChange}
                        sx={{ mb: 1 }}
                    />
                    <Button
                        variant="contained"
                        sx={{mb: 1, ml:1, ...colorButtonStyle.primary}}
                        onClick={() => { setEditingDepartment(null); setOpenModal(true); }}
                    >
                        <Add />
                    </Button>
                </Box>

                {/* Departments Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th>Code</th>
                            <th>Nom</th>
                            <th>Responsable</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredDepartments.map((department) => {
                            const responsable = employees.find(emp => emp.id === department.responsable_id);
                            return (
                                <tr key={department.code}>
                                    <td>{department.code}</td>
                                    <td>{department.name}</td>
                                    <td>{responsable ? `${responsable.name}` : 'Non assigné'}</td>
                                    <td>
                                        <Button
                                            variant="contained"
                                            onClick={() => handleEditDepartment(department)}
                                            sx={{ mr: 1, ...colorButtonStyle.primary }}
                                        >
                                            Modifier
                                        </Button>
                                        <Button
                                            variant="contained"
                                            disabled={department.doescontainemployees}
                                            sx={{ ...colorButtonStyle.error }}
                                            onClick={() => handleDeleteDepartment(department.id)}
                                        >
                                            Supprimer
                                        </Button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {/* Modal for Add/Edit Department */}
                <Modal
                    open={openModal}
                    onClose={() => setOpenModal(false)}
                    aria-labelledby="modal-modal-title"
                    aria-describedby="modal-modal-description"
                >
                    <Box sx={modalStyle}>
                        <Typography variant="h6" id="modal-modal-title" sx={{ mb: 2 }}>
                            {editingDepartment ? 'Modifier Département' : 'Ajouter un Département'}
                        </Typography>
                        <TextField
                            fullWidth
                            size='small'
                            label="Code departement"
                            name="code"
                            value={editingDepartment ? editingDepartment.code : newDepartment.code}
                            onChange={handleInputChange}
                            disabled={!!editingDepartment}
                            sx={{ mb: 2 }}
                        />
                        <TextField
                            fullWidth
                            size='small'
                            label="Nom"
                            name="name"
                            value={editingDepartment ? editingDepartment.name : newDepartment.name}
                            onChange={handleInputChange}
                            sx={{ mb: 2 }}
                        />
                        <Autocomplete
                            options={employees}
                            getOptionLabel={(employee) => employee.name}
                            value={selectedResponsable}
                            onChange={handleResponsableChange}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    size="small"
                                    fullWidth
                                    label="Responsable"
                                    name="responsable_id"
                                    sx={{ mb: 2 }}
                                />
                            )}
                        />
                        <Button variant="contained"
                         sx={{ mr: 1, ...colorButtonStyle.secondary }}
                         onClick={() => setOpenModal(false)}>
                            Annuler
                        </Button>
                        <Button
                            variant="contained"
                            onClick={editingDepartment ? handleUpdateDepartment : handleAddDepartment}
                            sx={{ mr: 1, ...colorButtonStyle.primary }}
                        >
                            {editingDepartment ? 'Mettre à jour' : 'Ajouter'}
                        </Button>
                    </Box>
                </Modal>
            </CardContent>
        </Card>
    );
};

// Modal style
const modalStyle = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 400,
    bgcolor: 'background.paper',
    boxShadow: 24,
    p: 4,
    borderRadius: 1,
};

export default DepartmentComponent;