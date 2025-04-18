import React from 'react';
import { 
  Card, 
  CardHeader, 
  CardContent, 
  Typography,
  Divider ,
  Grid
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
  ResponsiveContainer 
} from 'recharts';
import {
  AbsenteeismRate,
  PresenceRate,
  WorkAccidents,
  LeaveManagement,
  KPIGrid
} from '../components/kpi_componets';

// Données pour les graphiques
const monthlyData = [
  { name: 'Sem1', presence: 90, absence: 10 },
  { name: 'Sem2', presence: 84, absence: 16 },
  { name: 'Sem3', presence: 0, absence: 0 },
  { name: 'Sem4', presence: 0, absence: 0 },
  { name: 'Sem5', presence: 0, absence: 0 },
];

const employeeStatusData = [
  { name: 'Présent', value: 65, fill: '#4caf50' },
  { name: 'Absent', value: 15, fill: '#f44336' },
  { name: 'Congé', value: 12, fill: '#2196f3' },
  { name: 'Retards', value: 8, fill: '#ff9800' },
];

const Dashboard = () => {
  const dashboardData = {
    absenteeismRate: 12.5,
    presenceRate: 87.3,
    workAccidents: 5,
    leaveRequests: 23,
    currentMonth: new Date().toLocaleString('fr-FR', { month: 'long' })
  };

  return (
    <div style={{ padding: '20px' }}>
      <Typography variant="subtitle1" gutterBottom>
        Données pour {dashboardData.currentMonth}
      </Typography>
      
      <KPIGrid>
        <AbsenteeismRate rate={dashboardData.absenteeismRate} />
        <PresenceRate rate={dashboardData.presenceRate} />
        <WorkAccidents count={dashboardData.workAccidents} />
        <LeaveManagement count={dashboardData.leaveRequests} />
      </KPIGrid>

      <Divider style={{ margin: '30px 0' }} />

      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <Card>
            <CardHeader title="Tendances Mensuelles: Du 26 Mars au 25 Avril" />
            <CardContent style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="presence" 
                    stroke="#4caf50" 
                    strokeWidth={2}
                    name="Taux de Présence"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="absence" 
                    stroke="#f44336" 
                    strokeWidth={2}
                    name="Taux d'Absence"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={5}>
          <Card>
            <CardHeader title="Statut des Employés (Aujourd'hui)" />
            <CardContent style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={employeeStatusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  />
                  <Tooltip />
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