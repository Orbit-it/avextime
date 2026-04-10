import React from 'react';
import { Card, CardContent, Typography, Grid, Box } from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const data = [
  { name: 'Lundi', Présent: 40, Absent: 10 },
  { name: 'Mardi', Présent: 45, Absent: 5 },
  { name: 'Mercredi', Présent: 50, Absent: 0 },
  { name: 'Jeudi', Présent: 35, Absent: 15 },
  { name: 'Vendredi', Présent: 30, Absent: 20 },
];

const Statistics = () => {
  return (
    <Box sx={{ flexGrow: 1 }}>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Présence cette semaine
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Présent" fill="#8884d8" />
                  <Bar dataKey="Absent" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Résumé
              </Typography>
              <Typography>
                - Taux de présence moyen : 85%
              </Typography>
              <Typography>
                - Nombre total d'employés : 50
              </Typography>
              <Typography>
                - Nombre d'absences cette semaine : 10
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Statistics;