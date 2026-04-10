import React, { useEffect, useState } from 'react';
import api from '../api/api';
import { 
  Card, 
  CardHeader, 
  CardContent, 
  Typography,
  Divider,
  Grid,
  CircularProgress,
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  Avatar,
  Chip
} from '@mui/material';
import { 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  Legend, 
  ResponsiveContainer
} from 'recharts';
import {
  AbsenteeismRate,
  PresenceRate,
  WorkAccidents,
  LeaveManagement,
  KPIGrid
} from '../components/kpi_componets';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PictureAsPdf, GridOn } from '@mui/icons-material';
import * as XLSX from 'xlsx';


// Couleurs pour les différents statuts
const STATUS_COLORS = {
  absent: '#808080',
  cg_maladie: '#ffa500',
  conge: '#008000',
  accident: '#a329f7',
  map: '#dc3545',
  default: '#17a2b8'
};

// Traduction des statuts
const translateStatus = (status) => {
  const translations = {
    absent: 'Absent',
    map: 'Mise à pied',
    cg_maladie: 'Congé maladie',
    conge: 'Congé',
    accident: 'Accident de Travail',
    cg_dcs: 'Congé Décès Parental',
    cg_naissance: 'Congé Naissance',
    cg_mariage: 'Congé Mariage',
    cg_cir: 'Congé Circoncision',
    cg_exp: 'Congé Exceptionnel',
  };
  return translations[status] || status;
};

const Dashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await api.fetchDashboardDatas();
        if (!response.success) {
          throw new Error('Erreur lors de la récupération des données');
        }
        setDashboardData(response.data);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const generateAbsencePDF = () => {
    const doc = new jsPDF();
    
    // Titre
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('LISTE DES ABSENTS', 105, 15, { align: 'center' });
    
    // Date
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.text(
      `Date: ${new Date(dashboardData.date).toLocaleDateString('fr-FR', { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
      })}`,
      105,
      22,
      { align: 'center' }
    );
    
    // Total
    doc.text(
      `Total: ${dashboardData.absent_employees} absent(s)`,
      105,
      29,
      { align: 'center' }
    );

    // Données du tableau
    const tableData = dashboardData.absences
      .filter(emp => emp.status !== 'present')
      .map(employee => [
        employee.employee_id,
        employee.name.trim(),
        translateStatus(employee.status),
        { 
          content: '',
          styles: { 
            fillColor: STATUS_COLORS[employee.status] || STATUS_COLORS.default,
            textColor: STATUS_COLORS[employee.status] || STATUS_COLORS.default
          } 
        }
      ]);

    // En-têtes
    const headers = [
      { title: 'Matricule', dataKey: '0' },
      { title: 'Nom', dataKey: '1' },
      { title: 'Statut', dataKey: '2' },
      { title: '', dataKey: '3' }
    ];

    // Options
    const options = {
      startY: 40,
      headStyles: {
        fillColor: '#2c3e50',
        textColor: '#ffffff',
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 40 },
        3: { cellWidth: 10 }
      },
      didDrawPage: function(data) {
        // Pied de page
        doc.setFontSize(10);
        doc.setTextColor(150);
        doc.text(
          `Page ${doc.internal.getNumberOfPages()}`,
          doc.internal.pageSize.getWidth() - 15,
          doc.internal.pageSize.getHeight() - 10
        );
      }
    };

    // Génération du tableau
    autoTable(doc, {
      head: [headers.map(h => h.title)],
      body: tableData.map(row => row.slice(0, 3)), // Exclure la colonne de couleur
      ...options
    });

    // Sauvegarde
    doc.save(`liste_absents_${new Date().toISOString().slice(0, 10)}.pdf`);
  };


  const generateAbsenceExcel = () => {
    // Préparer les données pour Excel
    const excelData = dashboardData.absences
      .filter(emp => emp.status !== 'present')
      .map(employee => ({
        'Matricule': employee.employee_id,
        'Nom': employee.name.trim(),
        'Statut': translateStatus(employee.status)
      }));

    // Créer un nouveau workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);

    // Ajouter la feuille au workbook
    XLSX.utils.book_append_sheet(wb, ws, "Liste des absents");

    // Ajouter une feuille de synthèse
    const summaryData = [
      ['Date', new Date(dashboardData.date).toLocaleDateString('fr-FR')],
      ['Total des absents', dashboardData.absent_employees],
      ['Taux d\'absence', `${dashboardData.absence_rate}%`],
      ['Taux de présence', `${dashboardData.presence_rate}%`]
    ];
    
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWs, "Synthèse");

    // Générer le fichier Excel
    XLSX.writeFile(wb, `liste_absents_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Préparer les données pour le graphique circulaire
  const preparePieData = (data) => {
    if (!data || !data.summary || !data.summary.by_status) return [];
    
    return Object.entries(data.summary.by_status).map(([status, value]) => ({
      name: translateStatus(status),
      value,
      color: STATUS_COLORS[status] || STATUS_COLORS.default
    }));
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <Typography color="error">Erreur lors du chargement des données: {error}</Typography>
      </Box>
    );
  }

  if (!dashboardData) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <Typography>Aucune donnée disponible</Typography>
      </Box>
    );
  }

  const pieData = preparePieData(dashboardData);

  return (
    <div style={{ padding: '20px' }}>
      <KPIGrid>
        <AbsenteeismRate rate={dashboardData.absence_rate} />
        <PresenceRate rate={dashboardData.presence_rate} />
        <WorkAccidents count={dashboardData.summary?.by_status?.accident || 0} />
        <LeaveManagement count={dashboardData.summary?.by_status?.conge || 0} />
      </KPIGrid>

      <Divider style={{ margin: '30px 0' }} />

      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <Card>
            <CardHeader 
              title={`Liste des absents - ${new Date(dashboardData.date).toLocaleDateString('fr-FR', { 
                weekday: 'long', 
                day: 'numeric', 
                month: 'long' 
              })}`}
              subheader={`Total: ${dashboardData.absent_employees} absent(s)`}
              action={
                <div>
                <Button
                  variant="contained"
                  color="info"
                  startIcon={<PictureAsPdf />}
                  onClick={generateAbsencePDF}
                  style={{ marginRight: '10px' }}
                >
                  PDF
                </Button>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<GridOn />}
                  onClick={generateAbsenceExcel}
                >
                  Excel
                </Button>
              </div>
              }
            />
            <CardContent>
              <Paper elevation={2} style={{ maxHeight: '500px', overflow: 'auto' }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Photo</TableCell>
                      <TableCell>Nom</TableCell>
                      <TableCell>Matricule</TableCell>
                      <TableCell>Statut</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {dashboardData.absences?.length > 0 ? (
                      dashboardData.absences
                        .filter(emp => emp.status !== 'present')
                        .map((employee, index) => (
                          <TableRow key={index} hover>
                            <TableCell>
                              <Avatar 
                                alt={employee.name.trim()} 
                                src={employee.avatar || '/default-avatar.png'} 
                              />
                            </TableCell>
                            <TableCell>{employee.name.trim()}</TableCell>
                            <TableCell>{employee.employee_id}</TableCell>
                            <TableCell>
                              <Chip
                                label={translateStatus(employee.status)}
                                style={{
                                  backgroundColor: STATUS_COLORS[employee.status] || STATUS_COLORS.default,
                                  color: 'white',
                                  minWidth: 100
                                }}
                              />
                            </TableCell>
                          </TableRow>
                        ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          <Typography variant="body1" color="textSecondary">
                            Aucun absent aujourd'hui
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Paper>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={5}>
          <Card>
            <CardHeader 
              title="Répartition des absences" 
              subheader={`Total: ${dashboardData.absent_employees} employé(s) absent(s)`}
            />
            <CardContent style={{ height: '400px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent, value }) => `${name}: [${value}]  (${(percent * 100).toFixed(0)}%)`}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value, name) => [`${value} employé(s)`, name]}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </div>
  );
};

export default Dashboard;