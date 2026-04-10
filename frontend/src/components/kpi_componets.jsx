import React from 'react';
import { Card, CardContent, Typography, Grid } from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Warning as WarningIcon,
  EventBusy as EventBusyIcon
} from '@mui/icons-material';

// Composant KPI Absentéisme
export const AbsenteeismRate = ({ rate }) => (
  <Card>
    <CardContent>
      <Typography color="textSecondary">Taux d'Absence</Typography>
      <Typography variant="h4">{rate}%</Typography>
    </CardContent>
  </Card>
);

// Composant KPI Présence
export const PresenceRate = ({ rate }) => (
  <Card>
    <CardContent>
      <Typography color="textSecondary">Taux de Présence</Typography>
      <Typography variant="h4">{rate}%</Typography>
    </CardContent>
  </Card>
);

// Composant KPI Accidents
export const WorkAccidents = ({ count }) => (
  <Card>
    <CardContent>
      <Typography color="textSecondary">Accidents de Travail</Typography>
      <Typography variant="h4">{count}</Typography>
    </CardContent>
  </Card>
);

// Composant KPI Congés
export const LeaveManagement = ({ count }) => (
  <Card>
    <CardContent>
      <Typography color="textSecondary">Total Congés</Typography>
      <Typography variant="h4">{count}</Typography>
    </CardContent>
  </Card>
);

// Composant réutilisable pour les graphiques
export const KPIGrid = ({ children }) => (
  <Grid container spacing={3}>
    {React.Children.map(children, (child, index) => (
      <Grid item xs={12} sm={6} md={3} key={index}>
        {child}
      </Grid>
    ))}
  </Grid>
);