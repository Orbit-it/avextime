import React, { useState, useEffect } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import fr from 'date-fns/locale/fr';
import { Card, CardContent, Typography, TextField, Box, Modal } from '@mui/material';
import { Table, Spin, Button, Radio, Space, Input } from 'antd';
import api from '../api/api';
import moment from 'moment';
import 'moment/locale/fr'; // Importer la locale française pour moment

moment.locale('fr'); // Définir la locale française pour moment

const SynthèsePointages = () => {
  const [loading, setLoading] = useState(false);
  const [employeesData, setEmployeesData] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [attendances, setAttendances] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(moment());
  const [viewMode, setViewMode] = useState('semaine');
  const [currentWeek, setCurrentWeek] = useState(0);
  const [weeks, setWeeks] = useState([]);

  const generatePayPeriodWeeks = (month) => {
    const startDate = month.clone().subtract(1, 'month').date(26);
    const endDate = month.clone().date(25);
    let currentStart = startDate.clone();
    const generatedWeeks = [];
    let weekNum = 1;

    while (currentStart.isBefore(endDate)) {
      let monday = currentStart.clone();
      if (monday.day() !== 1) {
        monday = monday.day(1);
      }

      let currentEnd = monday.clone().add(6, 'days');
      if (currentEnd.isAfter(endDate)) currentEnd = endDate.clone();

      const days = [];
      const dayNames = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
      
      for (let i = 0; i < 7; i++) {
        const currentDay = monday.clone().add(i, 'days');
        if (currentDay.isBetween(startDate, endDate, null, '[]')) {
          days.push({
            date: currentDay.clone(),
            label: dayNames[i],
            shortLabel: dayNames[i].substring(0, 3), // Afficher les 3 premières lettres
            key: currentDay.format('YYYY-MM-DD'),
            isActive: true
          });
        } else {
          days.push({
            date: null,
            label: dayNames[i],
            shortLabel: dayNames[i].substring(0, 3),
            key: `empty-${i}`,
            isActive: false
          });
        }
      }

      generatedWeeks.push({
        start: monday.clone(),
        end: currentEnd.clone(),
        label: `S${weekNum}`,
        days,
        key: `week-${weekNum}`
      });

      currentStart = monday.clone().add(7, 'days');
      weekNum++;
    }

    return generatedWeeks;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const periodStart = selectedMonth.clone().subtract(1, 'month').date(26);
      const periodEnd = selectedMonth.clone().date(25);
      const activeDays = [];
      let currentDay = periodStart.clone();
      while (currentDay?.isSameOrBefore(periodEnd)) {
        activeDays.push(currentDay.format('YYYY-MM-DD'));
        currentDay.add(1, 'day');
      }
      const mockData = Array.from({ length: 5 }, (_, i) => {
        const pointages = {};
        activeDays.forEach(day => {
          pointages[day] = {
            HA: Math.floor(Math.random() * 2),
            HP: 8 + Math.floor(Math.random() * 2),
            C: 0,
            HN: Math.floor(Math.random() * 2),
            HS: Math.floor(Math.random() * 2),
            HD: 0,
            HTJF: 0,
            JF: 0
          };
        });
        return {
          id: i + 1,
          nom: `Employé ${i + 1}`,
          matricule: `EMP00${i + 1}`,
          pointages
        };
      });
      setEmployeesData(mockData);
    } catch (error) {
      console.error("Erreur de chargement", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (moment.isMoment(selectedMonth)) {
      setWeeks(generatePayPeriodWeeks(selectedMonth));
      loadData();
    }
  }, [selectedMonth]);

  useEffect(() => {
    api.fetchEmployees(setEmployees);
    //fetchAttendances();
  }, []);


 
  

  const filteredEmployees = employeesData.filter(emp =>
    emp.nom.toLowerCase().includes(searchText.toLowerCase()) ||
    emp.matricule.toLowerCase().includes(searchText.toLowerCase())
  );

  const getWeekColumns = (week) => [
    {
      title: 'Employé',
      dataIndex: 'nom',
      key: 'nom',
      fixed: 'left',
      width: 150,
      render: (text, record) => (
        <div>
          <div><strong>{text}</strong></div>
          <div style={{ fontSize: '0.8em', color: '#666' }}>{record.matricule}</div>
        </div>
      ),
    },
    ...week.days.map((day, index) => ({
      title: (
        <div style={{ 
          width: '100%',
          textAlign: 'center',
          backgroundColor: day.isActive ? '#f0f0f0' : 'transparent',
          padding: '4px',
          borderLeft: '1px solid #e8e8e8',
          borderRight: '1px solid #e8e8e8'
        }}>
          <div style={{ fontWeight: 'bold', fontSize: '0.9em' }}>{day.shortLabel}</div>
          <div style={{ fontSize: '0.75em' }}>
            {day.date ? day.date.format('DD/MM') : '-'}
          </div>
        </div>
      ),
      key: day.key,
      width: 90,
      align: 'center',
      render: (_, record) => {
        if (!day.isActive || !day.date) return <div style={{ color: '#ccc' }}>-</div>;
        const pointage = record.pointages?.[day.date.format('YYYY-MM-DD')] || {};
        return (
          <div style={{ 
            fontSize: '0.8em',
            textAlign: 'center',
            backgroundColor: '#f9f9f9',
            padding: '4px',
            borderRadius: '4px',
            border: '1px solid #e8e8e8'
          }}>
            <div>HP: <strong>{pointage.HP || 0}</strong></div>
            <div>HA: <strong>{pointage.HA || 0}</strong></div>
            <div>HS: <strong>{pointage.HS || 0}</strong></div>
            <div>HN: <strong>{pointage.HN || 0}</strong></div>
          </div>
        );
      },
    })),
    {
      title: 'Synthèse',
      key: 'synthese',
      width: 100,
      fixed: 'right',
      render: (_, record) => {
        const totals = { HA: 0, HP: 0, HN: 0, HS: 0 };
        week.days.forEach(day => {
          if (day.isActive && day.date) {
            const pointage = record.pointages?.[day.date.format('YYYY-MM-DD')] || {};
            Object.keys(totals).forEach(key => { totals[key] += pointage[key] || 0 });
          }
        });
        return (
          <div style={{ 
            fontSize: '0.8em',
            backgroundColor: '#e6f7ff',
            padding: '4px',
            fontWeight: 'bold',
            borderRadius: '4px',
            border: '1px solid #91d5ff'
          }}>
            <div>HP: {totals.HP}</div>
            <div>HA: {totals.HA}</div>
            <div>HS: {totals.HS}</div>
            <div>HN: {totals.HN}</div>
          </div>
        );
      }
    }
  ];

  const getMonthlyColumns = () => [
    {
      title: 'Employé',
      dataIndex: 'nom',
      key: 'nom',
      fixed: 'left',
      width: 180,
      render: (text, record) => (
        <div>
          <div style={{ fontWeight: 'bold' }}>{text}</div>
          <div style={{ fontSize: '0.8em', color: '#666' }}>{record.matricule}</div>
        </div>
      ),
    },
    ...weeks.map(week => ({
      title: (
        <div style={{ textAlign: 'center', fontWeight: 'bold' }}>
          {week.label}
          <div style={{ fontSize: '0.7em', fontWeight: 'normal' }}>
            {week.start.format('DD')}-{week.end.format('DD')}
          </div>
        </div>
      ),
      key: week.key,
      width: 120,
      align: 'center',
      render: (_, record) => {
        const totals = { HA: 0, HP: 0, HN: 0, HS: 0 };
        week.days.forEach(day => {
          if (day.isActive && day.date) {
            const pointage = record.pointages?.[day.date.format('YYYY-MM-DD')] || {};
            Object.keys(totals).forEach(key => { totals[key] += pointage[key] || 0 });
          }
        });
        return (
          <div style={{ 
            fontSize: '0.8em',
            backgroundColor: totals.HP > 40 ? '#fff7e6' : '#f6ffed',
            padding: '4px',
            borderRadius: '4px',
            border: totals.HP > 40 ? '1px solid #ffd591' : '1px solid #b7eb8f'
          }}>
            <div>HP: <strong>{totals.HP}</strong></div>
            <div>HA: <strong>{totals.HA}</strong></div>
            <div>HS: <strong>{totals.HS}</strong></div>
          </div>
        );
      }
    })),
    {
      title: 'Total Mois',
      key: 'total',
      width: 120,
      fixed: 'right',
      align: 'center',
      render: (_, record) => {
        const totals = { HA: 0, HP: 0, HN: 0, HS: 0 };
        weeks.forEach(week => {
          week.days.forEach(day => {
            if (day.isActive && day.date) {
              const pointage = record.pointages?.[day.date.format('YYYY-MM-DD')] || {};
              Object.keys(totals).forEach(key => { totals[key] += pointage[key] || 0 });
            }
          });
        });
        return (
          <div style={{ 
            fontSize: '0.8em',
            backgroundColor: '#e6f7ff',
            padding: '4px',
            fontWeight: 'bold',
            borderRadius: '4px',
            border: '1px solid #91d5ff'
          }}>
            <div>HP: {totals.HP}</div>
            <div>HA: {totals.HA}</div>
            <div>HS: {totals.HS}</div>
            <div>HN: {totals.HN}</div>
          </div>
        );
      }
    }
  ];

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={fr}>
      <Card>
        <CardContent>
          <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <Typography sx={{color: '#27aae0'}} variant="h6" gutterBottom>
              SYNTHÈSE DES POINTAGES
              <div style={{ fontSize: '0.8em', color: '#555' }}>
                {viewMode === 'semaine' ? 'Vue par semaine' : 'Vue mensuelle'} - {selectedMonth.format('MMMM YYYY')}
              </div>
              <div style={{ fontSize: '0.8em', color: '#555' }}>
                Période: {selectedMonth.clone().subtract(1, 'month').date(26).format('DD/MM/YYYY')} - {selectedMonth.clone().date(25).format('DD/MM/YYYY')}
              </div>
              {viewMode === 'semaine' && weeks.length > 0 && (
                <div style={{ fontSize: '0.8em', color: '#555' }}>
                  Semaine sélectionnée: {weeks[currentWeek].days[0].date?.format('DD/MM')} - {weeks[currentWeek].days[6].date?.format('DD/MM')}
                </div>
              )}
            </Typography>
            <Space size="middle" wrap>
              <Radio.Group 
                value={selectedMonth.format('MM/YYYY')} 
                onChange={e => setSelectedMonth(moment(e.target.value, 'MM/YYYY'))} 
                buttonStyle="solid"
              >
                <Radio.Button value={moment().subtract(1, 'month').format('MM/YYYY')}>
                  {moment().subtract(1, 'month').format('MMMM YYYY')}
                </Radio.Button>
                <Radio.Button value={moment().format('MM/YYYY')}>
                  {moment().format('MMMM YYYY')}
                </Radio.Button>
                <Radio.Button value={moment().add(1, 'month').format('MM/YYYY')}>
                  {moment().add(1, 'month').format('MMMM YYYY')}
                </Radio.Button>
              </Radio.Group>

              <Radio.Group value={viewMode} onChange={e => setViewMode(e.target.value)} buttonStyle="solid">
                <Radio.Button value="semaine">Semaine</Radio.Button>
                <Radio.Button value="mensuel">Mois</Radio.Button>
              </Radio.Group>
              {viewMode === 'semaine' && weeks.length > 0 && (
                <Radio.Group value={currentWeek} onChange={e => setCurrentWeek(e.target.value)} buttonStyle="solid">
                  {weeks.map((week, index) => (
                    <Radio.Button key={week.key} value={index}>{week.label}</Radio.Button>
                  ))}
                </Radio.Group>
              )}
              <Button type="primary" onClick={loadData}>Actualiser</Button>
            </Space>
          </div>

          <div style={{ marginBottom: '10px', maxWidth: '300px' }}>
            <Input.Search
              placeholder="Rechercher un employé..."
              allowClear
              onChange={e => setSearchText(e.target.value)}
              value={searchText}
              style={{ width: '100%' }}
            />
          </div>

          <Spin spinning={loading}>
            {viewMode === 'semaine' && weeks.length > 0 ? (
              <Table
                columns={getWeekColumns(weeks[currentWeek])}
                dataSource={filteredEmployees}
                bordered
                size="small"
                scroll={{ x: 'max-content' }}
                pagination={false}
                rowKey="id"
                style={{ width: '100%' }}
              />
            ) : (
              <Table
                columns={getMonthlyColumns()}
                dataSource={filteredEmployees}
                bordered
                size="small"
                scroll={{ x: 'max-content' }}
                pagination={false}
                rowKey="id"
                style={{ width: '100%' }}
              />
            )}
          </Spin>
        </CardContent>
      </Card>
    </LocalizationProvider>
  );
};

export default SynthèsePointages;