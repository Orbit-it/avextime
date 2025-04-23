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
  Box
} from '@mui/material';
import { 
  LineChart, 
  PieChart, 
  Line, 
  Pie, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  Cell
} from 'recharts';
import {
  AbsenteeismRate,
  PresenceRate,
  WorkAccidents,
  LeaveManagement,
  KPIGrid
} from '../components/kpi_componets';

// Couleurs constantes pour les graphiques
const CHART_COLORS = {
  PRESENCE: '#4caf50',
  ABSENCE: '#f44336',
  LEAVE: '#2196f3',
  LATE: '#ff9800'
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
        
        if (!response.data) {
          throw new Error('No data received');
        }
        
        setDashboardData({
          ...response.data,
          leaveRequests: response.data.leaveRequests || 23, // Valeur par défaut si non fournie
          currentMonth: new Date().toLocaleString('fr-FR', { month: 'long' })
        });
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Données pour les graphiques (peuvent être remplacées par des données dynamiques)
  const monthlyData = dashboardData?.monthlyStats || [
    { name: 'Sem1', presence: 90, absence: 10 },
    { name: 'Sem2', presence: 84, absence: 16 },
    { name: 'Sem3', presence: 0, absence: 0 },
    { name: 'Sem4', presence: 0, absence: 0 },
    { name: 'Sem5', presence: 0, absence: 0 },
  ];

  const employeeStatusData = dashboardData?.dailyStatus || [
    { name: 'Présent', value: 65, color: CHART_COLORS.PRESENCE },
    { name: 'Absent', value: 15, color: CHART_COLORS.ABSENCE },
    { name: 'Congé', value: 12, color: CHART_COLORS.LEAVE },
    { name: 'Retards', value: 8, color: CHART_COLORS.LATE },
  ];


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

  return (
    <div style={{ padding: '20px' }}>
      
      <Typography variant="subtitle1" gutterBottom>
        Données pour: {dashboardData.currentMonth}
      </Typography>
      
      <KPIGrid>
        <AbsenteeismRate rate={dashboardData.taux_absence} />
        <PresenceRate rate={dashboardData.taux_presence} />
        <WorkAccidents count={dashboardData.total_accident} />
        <LeaveManagement count={dashboardData.total_conges} />
      </KPIGrid>

      <Divider style={{ margin: '30px 0' }} />

      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <Card>
            <CardHeader 
              title="Tendances Mensuelles: Du 26 Mars au 25 Avril" 
              subheader="Évolution des taux de présence et d'absence"
            />
            <CardContent style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip 
                    formatter={(value) => [`${value}%`, value === 'presence' ? 'Présence' : 'Absence']}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="presence" 
                    stroke={CHART_COLORS.PRESENCE} 
                    strokeWidth={2}
                    name="Taux de Présence"
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="absence" 
                    stroke={CHART_COLORS.ABSENCE} 
                    strokeWidth={2}
                    name="Taux d'Absence"
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={5}>
          <Card>
            <CardHeader 
              title="Statut des Employés (Aujourd'hui)" 
              subheader={`Total: ${employeeStatusData.reduce((acc, curr) => acc + curr.value, 0)} employés`}
            />
            <CardContent style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={employeeStatusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {employeeStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value, name) => [`${value} employés`, name]}
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