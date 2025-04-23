import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, Typography } from '@mui/material';
import { Table, Spin, Button, Radio, Space, Input, Tooltip, Dropdown, Menu, notification } from 'antd';
import { DownloadOutlined, FileExcelOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import moment from 'moment';
import 'moment/locale/fr';
import api from '../api/api';

moment.locale('fr');

const generatePayPeriodWeeks = (month) => {
  if (!moment.isMoment(month)) return [];
  
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
          shortLabel: dayNames[i].substring(0, 3),
          key: currentDay.format('YYYY-MM-DD'),
          isActive: true,
          dayOfWeek: i // 0=lundi, 6=dimanche
        });
      } else {
        days.push({
          date: null,
          label: dayNames[i],
          shortLabel: dayNames[i].substring(0, 3),
          key: `empty-${i}`,
          isActive: false,
          dayOfWeek: i
        });
      }
    }

    generatedWeeks.push({
      start: monday.clone(),
      end: currentEnd.clone(),
      label: `S${weekNum}`,
      weekNumber: weekNum,
      days,
      key: `week-${weekNum}`
    });

    currentStart = monday.clone().add(7, 'days');
    weekNum++;
  }

  return generatedWeeks;
};

const SynthèsePointages = () => {
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [weeklyData, setWeeklyData] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(moment());
  const [viewMode, setViewMode] = useState('semaine');
  const [currentWeek, setCurrentWeek] = useState(0);
  const [weeks, setWeeks] = useState([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const periodStart = selectedMonth.clone().subtract(1, 'month').date(26).format('YYYY-MM-DD');
      const periodEnd = selectedMonth.clone().date(25).format('YYYY-MM-DD');

      const weeklyRes = await api.fetchWeeklyPointages();
      console.log(weeklyRes);
      setWeeklyData(weeklyRes.data?.rows || []);

    } catch (error) {
      console.error("Erreur de chargement", error);
      notification.error({
        message: 'Erreur',
        description: 'Impossible de charger les données. Veuillez réessayer.',
      });
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    if (moment.isMoment(selectedMonth)) {
      const generatedWeeks = generatePayPeriodWeeks(selectedMonth);
      setWeeks(generatedWeeks || []);
      
      if (currentWeek >= (generatedWeeks?.length || 0)) {
        setCurrentWeek(0);
      }
      
      loadData();
    }
  }, [selectedMonth, loadData, currentWeek]);

  const filteredWeeklyData = useMemo(() => 
    weeklyData.filter(data =>
      (data.employee_name && data.employee_name.toLowerCase().includes(searchText.toLowerCase())) ||
      (data.employee_payroll_id && data.employee_payroll_id.toLowerCase().includes(searchText.toLowerCase()))
    ),
    [weeklyData, searchText]
  );

  // Grouper les données par semaine
  const dataByWeek = useMemo(() => {
    const grouped = {};
    filteredWeeklyData.forEach(data => {
      const weekKey = `S${data.week_number}`;
      if (!grouped[weekKey]) {
        grouped[weekKey] = [];
      }
      grouped[weekKey].push(data);
    });
    return grouped;
  }, [filteredWeeklyData]);

  // Calcul des totaux mensuels par employé
  const monthlyTotals = useMemo(() => {
    const totals = {};
    
    filteredWeeklyData.forEach(week => {
      const empId = week.employee_id;
      if (!totals[empId]) {
        totals[empId] = {
          employee_id: empId,
          employee_name: week.employee_name,
          employee_payroll_id: week.employee_payroll_id,
          total_work_hour: 0,
          total_missed_hour: 0,
          total_sup_hour: 0,
          total_worked_hour_on_holiday: 0,
          total_jc_value: 0,
          total_jcx_value: 0
        };
      }
      
      totals[empId].total_work_hour += week.total_work_hour || 0;
      totals[empId].total_missed_hour += week.total_missed_hour || 0;
      totals[empId].total_sup_hour += week.total_sup_hour || 0;
      totals[empId].total_worked_hour_on_holiday += week.total_worked_hour_on_holiday || 0;
      totals[empId].total_jc_value += week.total_jc_value || 0;
      totals[empId].total_jcx_value += week.total_jcx_value || 0;
    });
    
    return Object.values(totals);
  }, [filteredWeeklyData]);

  const getDayData = (weekData, dayIndex) => {
    const dayPrefixes = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const prefix = dayPrefixes[dayIndex];
    
    return {
      penalisable_hour: weekData[`${prefix}_penalisable_hour`] || 0,
      missed_hour: weekData[`${prefix}_missed_hour`] || 0,
      sup_hour: weekData[`${prefix}_sup_hour`] || 0,
      work_hour: weekData[`${prefix}_work_hour`] || 0,
      worked_hour_on_holiday: weekData[`${prefix}_worked_hour_on_holiday`] || 0,
      jc_value: weekData[`${prefix}_jc_value`] || 0,
      jcx_value: weekData[`${prefix}_jcx_value`] || 0,
      is_active: weekData[`${prefix}_is_active`] || false
    };
  };

  const getWeekColumns = useCallback((week) => {
    if (!week?.days) {
      return [
        {
          title: 'Employé',
          dataIndex: 'employee_id',
          key: 'employee',
          fixed: 'left',
          width: 180,
          render: (_, record) => (
            <div>
              <div><strong>{record.employee_name}</strong></div>
              <div style={{ fontSize: '0.8em', color: '#666' }}>{record.employee_payroll_id}</div>
            </div>
          ),
        }
      ];
    }

    return [
      {
        title: 'Employé',
        dataIndex: 'employee_id',
        key: 'employee',
        fixed: 'left',
        width: 180,
        render: (_, record) => (
          <div>
            <div><strong>{record.employee_name}</strong></div>
            <div style={{ fontSize: '0.8em', color: '#666' }}>{record.employee_payroll_id}</div>
          </div>
        ),
      },
      ...week.days.map((day) => ({
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
        width: 120,
        align: 'center',
        render: (record) => {
          if (!day.isActive || !day.date) return <div style={{ color: '#ccc' }}>-</div>;
          
          const dayData = getDayData(record, day.dayOfWeek);

          return (
            <Tooltip 
              title={
                <div>
                  <div>Date: {day.date.format('DD/MM/YYYY')}</div>
                  <div>HP: {dayData.work_hour}</div>
                  <div>HA: {dayData.missed_hour}</div>
                  <div>HS: {dayData.sup_hour}</div>
                  <div>HTJF: {dayData.worked_hour_on_holiday}</div>
                  <div>JC: {dayData.jc_value}</div>
                  <div>JCX: {dayData.jcx_value}</div>
                </div>
              }
            >
              <div style={{ 
                fontSize: '0.8em',
                textAlign: 'center',
                backgroundColor: '#f9f9f9',
                padding: '4px',
                borderRadius: '4px',
                border: '1px solid #e8e8e8',
                cursor: 'pointer'
              }}>
                <div>HP: <strong>{dayData.work_hour}</strong></div>
                <div>HA: <strong>{dayData.missed_hour}</strong></div>
                <div>HS: <strong>{dayData.sup_hour}</strong></div>
                <div>HTJF: <strong>{dayData.worked_hour_on_holiday}</strong></div>
              </div>
            </Tooltip>
          );
        },
      })),
      {
        title: 'Synthèse Semaine',
        key: 'synthese',
        width: 140,
        fixed: 'right',
        render: (record) => {
          return (
            <div style={{ 
              fontSize: '0.8em',
              backgroundColor: '#e6f7ff',
              padding: '4px',
              fontWeight: 'bold',
              borderRadius: '4px',
              border: '1px solid #91d5ff'
            }}>
              <div>HP: {record.total_work_hour || 0}</div>
              <div>HA: {record.total_missed_hour || 0}</div>
              <div>HS: {record.total_sup_hour || 0}</div>
              <div>HTJF: {record.total_worked_hour_on_holiday || 0}</div>
              <div>JC: {record.total_jc_value || 0}</div>
              <div>JCX: {record.total_jcx_value || 0}</div>
            </div>
          );
        }
      }
    ];
  }, []);

  const getMonthlyColumns = useCallback(() => {
    return [
      {
        title: 'Employé',
        dataIndex: 'employee_id',
        key: 'employee',
        fixed: 'left',
        width: 180,
        render: (_, record) => (
          <div>
            <div><strong>{record.employee_name}</strong></div>
            <div style={{ fontSize: '0.8em', color: '#666' }}>{record.employee_payroll_id}</div>
          </div>
        ),
      },
      {
        title: 'HP Total',
        dataIndex: 'total_work_hour',
        key: 'total_work_hour',
        width: 100,
        align: 'center',
        render: (value) => <strong>{value.toFixed(2)}</strong>
      },
      {
        title: 'HA Total',
        dataIndex: 'total_missed_hour',
        key: 'total_missed_hour',
        width: 100,
        align: 'center',
        render: (value) => <strong>{value.toFixed(2)}</strong>
      },
      {
        title: 'HS Total',
        dataIndex: 'total_sup_hour',
        key: 'total_sup_hour',
        width: 100,
        align: 'center',
        render: (value) => <strong>{value.toFixed(2)}</strong>
      },
      {
        title: 'HTJF Total',
        dataIndex: 'total_worked_hour_on_holiday',
        key: 'total_worked_hour_on_holiday',
        width: 100,
        align: 'center',
        render: (value) => <strong>{value.toFixed(2)}</strong>
      },
      {
        title: 'JC Total',
        dataIndex: 'total_jc_value',
        key: 'total_jc_value',
        width: 100,
        align: 'center',
        render: (value) => <strong>{value.toFixed(2)}</strong>
      },
      {
        title: 'JCX Total',
        dataIndex: 'total_jcx_value',
        key: 'total_jcx_value',
        width: 100,
        align: 'center',
        render: (value) => <strong>{value.toFixed(2)}</strong>
      }
    ];
  }, []);

  const exportToExcel = useCallback(() => {
    let dataToExport = [];
    
    if (viewMode === 'semaine' && weeks[currentWeek]) {
      // Export de la semaine sélectionnée
      const currentWeekData = dataByWeek[weeks[currentWeek]?.label] || [];
      
      dataToExport = currentWeekData.map(week => ({
        'Matricule': week.employee_payroll_id,
        'Employé': week.employee_name,
        'Semaine': `S${week.week_number}`,
        'Date début': weeks[currentWeek].start.format('DD/MM/YYYY'),
        'Date fin': weeks[currentWeek].end.format('DD/MM/YYYY'),
        'HP Total': week.total_work_hour,
        'HA Total': week.total_missed_hour,
        'HS Total': week.total_sup_hour,
        'HTJF Total': week.total_worked_hour_on_holiday,
        'JC Total': week.total_jc_value,
        'JCX Total': week.total_jcx_value,
        ...weeks[currentWeek].days.reduce((acc, day, dayIndex) => {
          if (!day.isActive) return acc;
          
          const dayData = getDayData(week, day.dayOfWeek);
          const dateKey = day.date.format('DD/MM');
          
          return {
            ...acc,
            [`${day.shortLabel} ${dateKey} HP`]: dayData.work_hour,
            [`${day.shortLabel} ${dateKey} HA`]: dayData.missed_hour,
            [`${day.shortLabel} ${dateKey} HS`]: dayData.sup_hour,
            [`${day.shortLabel} ${dateKey} HTJF`]: dayData.worked_hour_on_holiday,
            [`${day.shortLabel} ${dateKey} JC`]: dayData.jc_value,
            [`${day.shortLabel} ${dateKey} JCX`]: dayData.jcx_value,
          };
        }, {})
      }));
    } else if (viewMode === 'mensuel') {
      // Export du mois complet (total des semaines)
      dataToExport = monthlyTotals.map(emp => ({
        'Matricule': emp.employee_payroll_id,
        'Employé': emp.employee_name,
        'HP Total': emp.total_work_hour,
        'HA Total': emp.total_missed_hour,
        'HS Total': emp.total_sup_hour,
        'HTJF Total': emp.total_worked_hour_on_holiday,
        'JC Total': emp.total_jc_value,
        'JCX Total': emp.total_jcx_value
      }));
    }
  
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Pointages");
  
    const fileName = `Pointages_${viewMode === 'semaine' ? `Semaine_${currentWeek + 1}` : 'Mensuel'}_${selectedMonth.format('MM_YYYY')}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  }, [dataByWeek, monthlyTotals, selectedMonth, viewMode, weeks, currentWeek]);

  const exportMenu = (
    <Menu onClick={exportToExcel}>
      <Menu.Item key="export-excel" icon={<FileExcelOutlined />}>
        Exporter en Excel
      </Menu.Item>
    </Menu>
  );

  const weekColumns = useMemo(() => 
    weeks[currentWeek] ? getWeekColumns(weeks[currentWeek]) : [], 
    [weeks, currentWeek, getWeekColumns]
  );

  const monthlyColumns = useMemo(() => getMonthlyColumns(), [getMonthlyColumns]);

  return (
    <Card>
      <CardContent>
        <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <Typography sx={{color: '#27aae0'}} variant="h6" gutterBottom>
            SYNTHÈSE DES POINTAGES
            <div style={{ fontSize: '0.8em', color: '#555' }}>
              {viewMode === 'semaine' ? 'Vue par semaine' : 'Vue mensuelle'} - {selectedMonth.format('MMMM YYYY')}
            </div>
            {viewMode === 'semaine' && weeks[currentWeek] && (
              <div style={{ fontSize: '0.8em', color: '#555' }}>
                Semaine sélectionnée: {weeks[currentWeek].days[0]?.date?.format('DD/MM')} - {weeks[currentWeek].days[6]?.date?.format('DD/MM')}
              </div>
            )}
          </Typography>
          
          <Space size="middle" wrap>
            <Radio.Group 
              value={selectedMonth.format('MM/YYYY')} 
              onChange={e => setSelectedMonth(moment(e.target.value, 'MM/YYYY'))} 
              buttonStyle="solid"
            >
              {[-1, 0, 1].map(offset => (
                <Radio.Button 
                  key={offset}
                  value={moment().add(offset, 'month').format('MM/YYYY')}
                >
                  {moment().add(offset, 'month').format('MMMM YYYY')}
                </Radio.Button>
              ))}
            </Radio.Group>

            <Radio.Group 
              value={viewMode} 
              onChange={e => setViewMode(e.target.value)} 
              buttonStyle="solid"
            >
              <Radio.Button value="semaine">Semaine</Radio.Button>
              <Radio.Button value="mensuel">Mois</Radio.Button>
            </Radio.Group>

            {viewMode === 'semaine' && weeks.length > 0 && (
              <Radio.Group 
                value={currentWeek} 
                onChange={e => setCurrentWeek(e.target.value)} 
                buttonStyle="solid"
              >
                {weeks.map((week, index) => (
                  <Radio.Button key={week.key} value={index}>{week.label}</Radio.Button>
                ))}
              </Radio.Group>
            )}

            <Button type="primary" onClick={loadData}>Actualiser</Button>
            <Dropdown overlay={exportMenu} placement="bottomRight">
              <Button type="primary" icon={<DownloadOutlined />}>
                Exporter
              </Button>
            </Dropdown>
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
          {viewMode === 'semaine' ? (
            weeks.length > 0 ? (
              <Table
                columns={weekColumns}
                dataSource={dataByWeek[weeks[currentWeek]?.label] || []}
                bordered
                size="small"
                scroll={{ x: 'max-content' }}
                pagination={false}
                rowKey="id"
                style={{ width: '100%' }}
              />
            ) : (
              <div style={{ padding: '20px', textAlign: 'center' }}>
                Aucune donnée de semaine disponible
              </div>
            )
          ) : (
            <Table
              columns={monthlyColumns}
              dataSource={monthlyTotals}
              bordered
              size="small"
              scroll={{ x: 'max-content' }}
              pagination={false}
              rowKey="employee_id"
              style={{ width: '100%' }}
            />
          )}
        </Spin>
      </CardContent>
    </Card>
  );
};

export default SynthèsePointages;