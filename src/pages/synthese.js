import React, { useState, useEffect, useMemo, useCallback } from 'react';
import './synthese.css';
import { ListItem, ListItemText, Avatar, ListItemAvatar, Typography, Button } from '@mui/material';
import axios from 'axios';
import apiconfig from '../config/Endpoint';
import AttendanceDetailsModal from '../components/AttendanceDetailsModal';
import * as XLSX from 'xlsx';

// Fonctions utilitaires pures déplacées en dehors du composant pour éviter les recréations
const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatWeekstart = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${day}-${month}-${year}`;
};

const formatDayNumber = (date) => {
  return date.toLocaleDateString('en-US', { day: '2-digit' });
};

const formatMonth = (date) => {
  return date.toLocaleDateString('fr', { month: 'short' });
};

const formatDayName = (date) => {
  return ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'][date.getDay()];
};

const getCurrentWeekDates = (startDate) => {
  const dates = Array(7);
  for (let i = 0; i < 7; i++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + i);
    dates[i] = currentDate;
  }
  return dates;
};

const getCurrentMonthDates = (startDate, endDate) => {
  const dates = [];
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return dates;
};

const groupDatesByWeek = (dates) => {
  const weeks = [];
  let currentWeek = [];
  
  dates.forEach((date, index) => {
    currentWeek.push(date);
    
    if (date.getDay() === 0 || index === dates.length - 1) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });
  
  return weeks;
};

const getDateOfISOWeek = (year, week) => {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dayOfWeek = simple.getDay();
  const startOfWeek = new Date(simple);
  startOfWeek.setDate(simple.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
  return startOfWeek;
};

function Synthese() {
  // États initiaux
  const [viewMode, setViewMode] = useState('weekly');
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
    return startOfWeek;
  });

  //Calcul de currentWeekEnd (dimanche de la même semaine)
  const currentWeekEnd = new Date(currentWeekStart);
  currentWeekEnd.setDate(currentWeekStart.getDate() + 6); // +6 jours = dimanche

  const [currentMonthRange, setCurrentMonthRange] = useState(() => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const startDate = new Date(currentYear, currentMonth - 1, 26);
    const endDate = new Date(currentYear, currentMonth, 25);
    return { start: startDate, end: endDate };
  });

  // États des données
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [attendances, setAttendances] = useState([]);
  const [weeksAttendance, setWeeksAttendance] = useState([]);
  const [monthsAttendance, setMonthsAttendance] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('Tous');

  // État du modal
  const [modalData, setModalData] = useState({
    isOpen: false,
    employee: null,
    date: null,
    dailyAttendances: []
  });

  // Mémoïsation des données calculées
  const weekDates = useMemo(() => getCurrentWeekDates(currentWeekStart), [currentWeekStart]);
  const monthDates = useMemo(() => getCurrentMonthDates(currentMonthRange.start, currentMonthRange.end), [currentMonthRange]);
  const monthWeeks = useMemo(() => groupDatesByWeek(monthDates), [monthDates]);


  // Filtrage des données
  const filteredScheduleData = useMemo(() => {
    return employees.filter((employee) => {
      const matchesSearchTerm =
        employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.attendance_id.toString().includes(searchTerm.toLowerCase());

      const matchesDepartment =
        selectedDepartment === 'Tous' || employee.department_id == selectedDepartment;

      return matchesSearchTerm && matchesDepartment && employee.is_active;
    });
  }, [employees, searchTerm, selectedDepartment]);

  // Fonction pour exporter en Excel
  const exportToExcel = useCallback(() => {
    if (viewMode !== 'monthly') return;

    // Préparer les données
    const dataForExport = filteredScheduleData.map(employee => {
      const employeeData = {
        'Matricule': employee.payroll_id,
        'Nom': employee.name,
        'Département': departments.find(d => d.id === employee.department_id)?.name || 'Inconnu'
      };

      // Ajouter le total mensuel
      const monthlyRecord = monthsAttendance.find(ma => ma.employee_id === employee.attendance_id);
      if (monthlyRecord) {
        employeeData['Hrs Travaillées'] = monthlyRecord.total_worked_hours || '0,00';   // colonne 1
        employeeData['Hrs Normal Trav'] = monthlyRecord.total_normal_trav || '0,00';    // colonne 2
        employeeData['Hrs Sup 75%'] = monthlyRecord.total_sup || '0,00';                // colonne 4
        employeeData['Hrs Absence'] = monthlyRecord.total_missed_hours || '0,00';       // colonne 5
        employeeData['Hrs Pénalisable'] = monthlyRecord.total_penalisable || '0,00';    // colonne 6
        employeeData['Hrs de Nuit'] = monthlyRecord.total_night_hours || '0,00';        // colonne 7
        employeeData['Hrs Dimanche'] = monthlyRecord.total_sunday_hours || '0,00';      // colonne 8
        employeeData['Jour Férié'] = monthlyRecord.total_jf || '0,00';                  // colonne 9
        employeeData['Congé'] = monthlyRecord.total_jc || '0,00';                       // colonne 10
        employeeData['Congé Exceptionnels'] = monthlyRecord.total_jcx || '0,00';        // colonne 11
        employeeData['Hrs Travaillées Jour férié'] = monthlyRecord.total_htjf || '0,00';// colonne 12
        employeeData['Prime Assiduité'] = monthlyRecord.prime_assiduite || '0,00';      // colonne 13
      }

      return employeeData;
    });

    // Créer un nouveau classeur
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(dataForExport);
    
    // Ajouter la feuille au classeur
    XLSX.utils.book_append_sheet(wb, ws, "AventuraTime-Synthèse Mensuelle");
    
    // Générer le fichier Excel
    const monthName = new Date(currentMonthRange.end).toLocaleDateString('fr', { month: 'long', year: 'numeric' });
    XLSX.writeFile(wb, `AventuraTime-Synthèse Mensuelle - ${monthName}.xlsx`);
  }, [viewMode, filteredScheduleData, monthWeeks, monthsAttendance, currentMonthRange, departments]);

  // Fonctions de gestion du modal
  const openModal = useCallback((employee, date, dailyAttendances) => {
    setModalData({
      isOpen: true,
      employee,
      date,
      dailyAttendances
    });
  }, []);

  const closeModal = useCallback(() => {
    setModalData(prev => ({...prev, isOpen: false}));
  }, []);

  // Fetch des données
  const fetchData = useCallback(async () => {
    try {
      const [departmentsRes, employeesRes, attendancesRes, weeksRes, monthsRes] = await Promise.all([
        axios.get(apiconfig.Endpoint.departments),
        axios.get(apiconfig.Endpoint.employees),
        axios.get(apiconfig.Endpoint.pointagesSummary),  // Données journalieres
        axios.get(apiconfig.Endpoint.weeks),   // Données hebdomadaires
        axios.get(apiconfig.Endpoint.month)   // données mensuelles
      ]);

      setDepartments(departmentsRes.data);
      setEmployees(employeesRes.data);
      setAttendances(attendancesRes.data);
      setWeeksAttendance(Array.isArray(weeksRes.data) ? weeksRes.data : []);
      setMonthsAttendance(monthsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      setWeeksAttendance([]);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fonctions de calcul mémoïsées
  const calculateTotalHours = useCallback((employee, dates) => {
    let totalHours = 0;
    
    dates.forEach(date => {
      const dailyAttendances = attendances
        .filter(p => p.employee_id === employee.attendance_id && p.date === formatDate(date));
      
      if (dailyAttendances.length > 0) {
        if (dailyAttendances[0].hours_worked) {
          totalHours += parseFloat(dailyAttendances[0].hours_worked);
        }
        if (dailyAttendances[0].worked_hours_on_holidays) {
          totalHours += parseFloat(dailyAttendances[0].worked_hours_on_holidays);
        }
      }
    });
    
    return totalHours.toFixed(2);
  }, [attendances]);

  const getWeekTotalForEmployee = useCallback((employeeId, weekStartDate) => {
    return weeksAttendance.find(wa => 
      wa.employee_id === employeeId && 
      wa.start_date === formatWeekstart(weekStartDate));
  }, [weeksAttendance]);

  // Navigation
  const goToPreviousWeek = useCallback(() => {
    setCurrentWeekStart(prev => {
      const newStartDate = new Date(prev);
      newStartDate.setDate(newStartDate.getDate() - 7);
      return newStartDate;
    });
  }, []);

  const goToNextWeek = useCallback(() => {
    setCurrentWeekStart(prev => {
      const newStartDate = new Date(prev);
      newStartDate.setDate(newStartDate.getDate() + 7);
      return newStartDate;
    });
  }, []);

  const goToPreviousMonth = useCallback(() => {
    setCurrentMonthRange(prev => {
      const newStart = new Date(prev.start);
      newStart.setMonth(newStart.getMonth() - 1);
      const newEnd = new Date(prev.end);
      newEnd.setMonth(newEnd.getMonth() - 1);
      return { start: newStart, end: newEnd };
    });
  }, []);

  const goToNextMonth = useCallback(() => {
    setCurrentMonthRange(prev => {
      const newStart = new Date(prev.start);
      newStart.setMonth(newStart.getMonth() + 1);
      const newEnd = new Date(prev.end);
      newEnd.setMonth(newEnd.getMonth() + 1);
      return { start: newStart, end: newEnd };
    });
  }, []);

  const handleWeekChange = useCallback((event) => {
    const weekValue = event.target.value;
    if (!weekValue) return;
    const [year, week] = weekValue.split('-W');
    if (!year || !week) return;
    const startOfWeek = getDateOfISOWeek(parseInt(year), parseInt(week));
    setCurrentWeekStart(startOfWeek);
  }, []);

  const handleMonthChange = useCallback((event) => {
    const monthValue = event.target.value;
    if (!monthValue) return;
    const [year, month] = monthValue.split('-');
    if (!year || !month) return;
    const selectedMonth = parseInt(month) - 1;
    const selectedYear = parseInt(year);
    const startDate = new Date(selectedYear, selectedMonth - 1, 26);
    const endDate = new Date(selectedYear, selectedMonth, 25);
    setCurrentMonthRange({ start: startDate, end: endDate });
  }, []);

  

  // Composants de rendu mémoïsés
  const renderAttendanceCell = useCallback((dailyAttendances) => {
    if (dailyAttendances.length > 0) {
      return (
        <div style={{
          border: '1px solid #ddd',
          padding: '5px',
          fontSize: '11px',
          backgroundColor: dailyAttendances[0].is_anomalie ? '#f07351' : dailyAttendances[0].autoriz_getin ? '#c9c9b9':'#e9e9e9'
        }}>
          <table style={{ borderCollapse: 'collapse' }}>
            <tbody>
              <tr><td><strong>Heure d'Entrée</strong></td><td>{dailyAttendances[0].getin || '--:--'}</td></tr>
              <tr><td><strong>Heure de Sortie</strong></td><td>{dailyAttendances[0].getout || '--:--'}</td></tr>
              <tr><td><strong>Hrs Trav</strong></td><td>{dailyAttendances[0].hours_worked || '00.00'}</td></tr>
              <tr><td><strong>Hrs Normale</strong></td><td>{dailyAttendances[0].hrs_norm_trav || '00.00'}</td></tr>
              <tr><td><strong>Hrs Absence</strong></td><td>{dailyAttendances[0].missed_hour || '00.00'}</td></tr>
              <tr><td><strong>Hrs Pénalisable</strong></td><td>{dailyAttendances[0].penalisable || '00.00'}</td></tr>
              <tr><td><strong>Hrs Trav J.Férié</strong></td><td>{dailyAttendances[0].worked_hours_on_holidays || '00.00'}</td></tr>
              <tr><td><strong>Hrs Nuit</strong></td><td>{dailyAttendances[0].night_hours || '00.00'}</td></tr>
              <tr><td><strong>Hrs Dimanche</strong></td><td>{dailyAttendances[0].sunday_hour || '00.00'}</td></tr>
              <tr><td><strong>Jour Férié</strong></td><td>{dailyAttendances[0].jf_value || 'X'}</td></tr>
              <tr><td><strong>Congé Simple</strong></td><td>{dailyAttendances[0].jc_value || 'X'}</td></tr>
              <tr><td><strong>Congé Exp</strong></td><td>{dailyAttendances[0].jcx_value || 'X'}</td></tr>
              <tr><td><strong>Sup 50%</strong></td><td>{dailyAttendances[0].sup_hour || '00.00'}</td></tr>
              <tr><td><strong>Status</strong></td><td>{dailyAttendances[0].status || ''}</td></tr>
            </tbody>
          </table>
        </div>
      );
    }
    return <p>Off</p>;
  }, []);

  const renderWeekTotalCell = useCallback((weekRecord) => {
    if (weekRecord) {
      return (
        <div className='synthese'>
          <div style={{
            border: '1px solid #ddd',
            padding: '5px',
            fontSize: '11px',
            backgroundColor: '#aeeaf9'
          }}>
            <table style={{ borderCollapse: 'collapse' }}>
              <tbody>
                <tr><td><strong>Date Debut</strong></td><td>{weekRecord.start_date }</td></tr>
                <tr><td><strong>Date Fin</strong></td><td>{weekRecord.end_date }</td></tr>
                <tr><td><strong>Hrs Trav</strong></td><td>{weekRecord.total_worked_hours || '00.00'}</td></tr>
                <tr><td><strong>Hrs Normal Trav</strong></td><td>{weekRecord.total_normal_trav || '00.00'}</td></tr>
                <tr><td><strong>Hrs Absence</strong></td><td>{weekRecord.total_missed_hours || '00.00'}</td></tr>
                <tr><td><strong>Hrs Pénalisable</strong></td><td>{weekRecord.total_penalisable || '00.00'}</td></tr>
                <tr><td><strong>HTJF</strong></td><td>{weekRecord.total_htjf || '00.00'}</td></tr>
                <tr><td><strong>Hrs Nuit</strong></td><td>{weekRecord.total_night_hours || '00.00'}</td></tr>
                <tr><td><strong>Hrs Dimanche</strong></td><td>{weekRecord.total_sunday_hours || '00.00'}</td></tr>
                <tr><td><strong>Jour Férié</strong></td><td>{weekRecord.total_jf || '0'}</td></tr>
                <tr><td><strong>Congé Simple</strong></td><td>{weekRecord.total_jc || '0'}</td></tr>
                <tr><td><strong>Congé Exp</strong></td><td>{weekRecord.total_jcx || '0'}</td></tr>
                <tr><td><strong>Hrs Sup 48h</strong></td><td>{weekRecord.total_sup || '00.00'}</td></tr>
                <tr><td><strong>Semaine</strong></td><td>{weekRecord.name || ''}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      );
    }
    return <p>Aucune donnée</p>;
  }, []);

  const renderMonthTotalCell = useCallback((MonthRecord) => {
    if (MonthRecord) {
      return (
        <div className='synthese'>
          <div style={{
            border: '1px solid #ddd',
            padding: '5px',
            fontSize: '11px',
            backgroundColor: '#70f71e'
          }}>
            <table style={{ borderCollapse: 'collapse' }}>
              <tbody>
                <tr><td><strong>Date Debut</strong></td><td>{MonthRecord.month_start }</td></tr>
                <tr><td><strong>Date Fin</strong></td><td>{MonthRecord.month_end }</td></tr>
                <tr><td><strong>Hrs Trav</strong></td><td>{MonthRecord.total_worked_hours || '00.00'}</td></tr>
                <tr><td><strong>Hrs Normal Trav</strong></td><td>{MonthRecord.total_normal_trav || '00.00'}</td></tr>
                <tr><td><strong>Hrs Absence</strong></td><td>{MonthRecord.total_missed_hours || '00.00'}</td></tr>
                <tr><td><strong>Hrs Pénalisable</strong></td><td>{MonthRecord.total_penalisable || '00.00'}</td></tr>
                <tr><td><strong>HTJF</strong></td><td>{MonthRecord.total_htjf || '00.00'}</td></tr>
                <tr><td><strong>Hrs Nuit</strong></td><td>{MonthRecord.total_night_hours || '00.00'}</td></tr>
                <tr><td><strong>Hrs Dimanche</strong></td><td>{MonthRecord.total_sunday_hours || '00.00'}</td></tr>
                <tr><td><strong>Jour Férié</strong></td><td>{MonthRecord.total_jf || '0'}</td></tr>
                <tr><td><strong>Congé Simple</strong></td><td>{MonthRecord.total_jc || '0'}</td></tr>
                <tr><td><strong>Congé Exp</strong></td><td>{MonthRecord.total_jcx || '0'}</td></tr>
                <tr><td><strong>Hrs Sup 48h</strong></td><td>{MonthRecord.total_sup || '00.00'}</td></tr>
                <tr><td><strong>Prime Assiduité</strong></td><td>{MonthRecord.prime_assiduite || '0'}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      );
    }
    return <p>Aucune donnée</p>;
  }, []);

  // Gestion de la sauvegarde du modal
  const handleSaveSuccess = useCallback(() => {
    fetchData();
    setModalData({
      isOpen: false,
      employee: null,
      date: null,
      dailyAttendances: []
    });
  }, [fetchData]);

  return (
    <div className="App">

      <div className="week-navigation">
        <Typography sx={{color: '#27aae0'}} variant="h6">
          SYNTHESE
        </Typography>
        <div className="search-container">
          <input
            type="text"
            placeholder="Rechercher par nom ou matricule..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
          >
            <option value="Tous">Tous</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        {viewMode === 'weekly' ? (
          <div className="week-navigation">
            <button onClick={goToPreviousWeek}>⬅️ Semaine précedente</button>
            <input
              type="week"
              value={formatDate(currentWeekStart).substring(0, 5) + 'W' + 
                Math.ceil((currentWeekStart.getDate() + currentWeekStart.getDay()) / 7)}
              onChange={handleWeekChange}
            />
            <button onClick={goToNextWeek}>Semaine suivante ➡️</button>
          </div>
        ) : (
          <div className="month-navigation">
            <button onClick={goToPreviousMonth}>⬅️ Mois précédent</button>
            <input
              type="month"
              value={`${currentMonthRange.end.getFullYear()}-${String(currentMonthRange.end.getMonth() + 1).padStart(2, '0')}`}
              onChange={handleMonthChange}
            />
            <button onClick={goToNextMonth}>Mois suivant ➡️</button>
          </div>
        )}

        <div className="view-mode-selector">
          <button 
            className={viewMode === 'weekly' ? 'active' : ''}
            onClick={() => setViewMode('weekly')}
          >
            Vue Hebdomadaire
          </button>
          <button 
            className={viewMode === 'monthly' ? 'active' : ''}
            onClick={() => setViewMode('monthly')}
          >
            Vue Mensuelle
          </button>
          {viewMode === 'monthly' && (
            <Button 
              variant="contained" 
              color="info" 
              onClick={exportToExcel}
              style={{ marginLeft: '10px', backgroundColor: 'green' }}
            >
              Exporter
            </Button>
          )}
        </div>
      </div>
      
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th className="sticky-column">Employé</th>
              {viewMode === 'weekly' ? (
                weekDates.map((date, index) => (
                  <th key={index}>
                    <div className="date-header">
                      <div className="day-number">{formatDayNumber(date)}</div>
                      <div className="day-month">
                        <p>{formatDayName(date)}</p>
                        <p>{formatMonth(date)}</p>
                      </div>
                    </div>
                  </th>
                ))
              ) : (
                monthWeeks.map((weekDates, weekIndex) => {
                  const weekName = weeksAttendance.find(wa => 
                    wa.start_date === formatDate(weekDates[0]))?.name || `Semaine ${weekIndex + 1}`;
                  
                  return (
                    <th key={weekIndex}>
                      <div className="date-header">
                        <div className="week-name">{weekName}:</div>
                        <div className="week-dates">
                         {formatDayNumber(weekDates[0])} - {formatDayNumber(weekDates[weekDates.length - 1])}
                        </div>
                      </div>
                    </th>
                  );
                })
              )}
              <th className="total-column">Total</th>
            </tr>
          </thead>
          <tbody>
            {filteredScheduleData.map((employee) => (
              <tr key={employee.id}>
                <td className="employee-info sticky-column">
                  <ListItem>
                    <ListItemAvatar>
                      <Avatar src={employee.avatar && `${employee.avatar}`} />
                    </ListItemAvatar>
                    <ListItemText
                      primary={employee.name}
                      secondary={employee.attendance_id}
                    />
                  </ListItem>
                </td>
                {viewMode === 'weekly' ? (
                  weekDates.map((date) => {
                    const dailyAttendances = attendances
                      .filter((p) => p.employee_id === employee.attendance_id && p.date === formatDate(date));

                    return (
                      <td 
                        key={formatDate(date)}
                        onDoubleClick={() => openModal(employee, date, dailyAttendances)}
                      >
                        <div className='synthese'>
                          {renderAttendanceCell(dailyAttendances)}
                        </div>
                      </td>
                    );
                  })
                ) : (
                  monthWeeks.map((weekDates, weekIndex) => {
                    const weekRecord = getWeekTotalForEmployee(employee.attendance_id, weekDates[0]);
                    return (
                      <td key={weekIndex}>
                        {renderWeekTotalCell(weekRecord)}
                      </td>
                    );
                  })
                )}
                
                <td className="synthese">
                  {viewMode === 'weekly' ? (
                    renderWeekTotalCell(
                      weeksAttendance.find(wa => 
                        wa.employee_id === employee.attendance_id && (
                        wa.start_date === formatWeekstart(currentWeekStart) || wa.end_date === formatWeekstart(currentWeekEnd)))
                        
                  ))
                  : (
                    renderMonthTotalCell(
                      monthsAttendance.find(ma => 
                        ma.employee_id === employee.attendance_id &&
                        ma.month_start === formatWeekstart(currentMonthRange.start))
                  ))}
                </td>
              </tr>
            ))}

            <AttendanceDetailsModal
              isOpen={modalData.isOpen}
              onClose={closeModal}
              employee={modalData.employee}
              date={modalData.date}
              dailyAttendances={modalData.dailyAttendances}
              onEdit={true}
              onSaveSuccess={handleSaveSuccess}
            />
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Synthese;