import React, { useState, useEffect, useMemo } from 'react';
import './synthese.css';
import { ListItem, ListItemText, Avatar, ListItemAvatar } from '@mui/material';
import axios from 'axios';
import apiconfig from '../config/Endpoint';
import AttendanceDetailsModal from '../components/AttendanceDetailsModal';

function Synthese() {
  const [viewMode, setViewMode] = useState('weekly');
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
    return startOfWeek;
  });

  

  const [currentMonthRange, setCurrentMonthRange] = useState(() => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const startDate = new Date(currentYear, currentMonth - 1, 26);
    const endDate = new Date(currentYear, currentMonth, 25);
    return { start: startDate, end: endDate };
  });

  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [attendances, setAttendances] = useState([]);
  const [weeksAttendance, setWeeksAttendance] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('Tous');

  const [modalData, setModalData] = useState({
    isOpen: false,
    employee: null,
    date: null,
    dailyAttendances: []
  });

    // Fonction pour ouvrir le modal avec les données
    const openModal = (employee, date, dailyAttendances) => {
        setModalData({
          isOpen: true,
          employee,
          date,
          dailyAttendances
        });
      };
    
      // Fonction pour fermer le modal
      const closeModal = () => {
        setModalData(prev => ({...prev, isOpen: false}));
      };



  useEffect(() => {
    fetchDepartments();
    fetchEmployees();
    fetchAttendances();
    fetchWeeksattendance();
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await axios.get(apiconfig.Endpoint.employees);
      setEmployees(response.data);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await axios.get(apiconfig.Endpoint.departments);
      setDepartments(response.data);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const fetchAttendances = async () => {
    try {
      const response = await axios.get(apiconfig.Endpoint.pointagesSummary);
      setAttendances(response.data);
    } catch (error) {
      console.error('Error fetching attendances:', error);
    }
  };

  const fetchWeeksattendance = async () => {
    try {
      const response = await axios.get(apiconfig.Endpoint.weeks);
      setWeeksAttendance(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching weeks attendances:', error);
      setWeeksAttendance([]);
    }
  };

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

  //console.log('Value of currentweekStart using formatWeekstart function: ',formatWeekstart(currentWeekStart));

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
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      dates.push(currentDate);
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

  const calculateTotalHours = (employee, dates) => {
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
  };

  const getWeekTotalForEmployee = (employeeId, weekStartDate) => {
    const weekRecord = weeksAttendance.find(wa => 
      wa.employee_id === employeeId && 
      wa.start_date === formatWeekstart(weekStartDate));
    
    return weekRecord || null;
  };

  const goToPreviousWeek = () => {
    const newStartDate = new Date(currentWeekStart);
    newStartDate.setDate(newStartDate.getDate() - 7);
    setCurrentWeekStart(newStartDate);
  };

  const goToNextWeek = () => {
    const newStartDate = new Date(currentWeekStart);
    newStartDate.setDate(newStartDate.getDate() + 7);
    setCurrentWeekStart(newStartDate);
  };

  const goToPreviousMonth = () => {
    const newStart = new Date(currentMonthRange.start);
    newStart.setMonth(newStart.getMonth() - 1);
    const newEnd = new Date(currentMonthRange.end);
    newEnd.setMonth(newEnd.getMonth() - 1);
    setCurrentMonthRange({ start: newStart, end: newEnd });
  };

  const goToNextMonth = () => {
    const newStart = new Date(currentMonthRange.start);
    newStart.setMonth(newStart.getMonth() + 1);
    const newEnd = new Date(currentMonthRange.end);
    newEnd.setMonth(newEnd.getMonth() + 1);
    setCurrentMonthRange({ start: newStart, end: newEnd });
  };

  const handleWeekChange = (event) => {
    const weekValue = event.target.value;
    if (!weekValue) return;
    const [year, week] = weekValue.split('-W');
    if (!year || !week) return;
    const startOfWeek = getDateOfISOWeek(parseInt(year), parseInt(week));
    setCurrentWeekStart(startOfWeek);
  };

  const handleMonthChange = (event) => {
    const monthValue = event.target.value;
    if (!monthValue) return;
    const [year, month] = monthValue.split('-');
    if (!year || !month) return;
    const selectedMonth = parseInt(month) - 1;
    const selectedYear = parseInt(year);
    const startDate = new Date(selectedYear, selectedMonth - 1, 26);
    const endDate = new Date(selectedYear, selectedMonth, 25);
    setCurrentMonthRange({ start: startDate, end: endDate });
  };

  const getDateOfISOWeek = (year, week) => {
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const dayOfWeek = simple.getDay();
    const startOfWeek = new Date(simple);
    startOfWeek.setDate(simple.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));
    return startOfWeek;
  };

  const weekDates = useMemo(() => getCurrentWeekDates(currentWeekStart), [currentWeekStart]);
  const monthDates = useMemo(() => getCurrentMonthDates(currentMonthRange.start, currentMonthRange.end), [currentMonthRange]);
  const monthWeeks = useMemo(() => groupDatesByWeek(monthDates), [monthDates]);

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

  const renderAttendanceCell = (dailyAttendances) => {
    if (dailyAttendances.length > 0) {
      return (
        <div style={{
          border: '1px solid #ddd',
          padding: '5px',
          fontSize: '11px',
          backgroundColor: dailyAttendances[0].is_anomalie ? '#f07351' : '#e9e9e9',
          width: '200px'
        }}>
          <table style={{ borderCollapse: 'collapse' }}>
            <tbody>
              <tr><td><strong>Hrs Travaillées</strong></td><td>{dailyAttendances[0].hours_worked || '00.00'}</td></tr>
              <tr><td><strong>Hrs Absence</strong></td><td>{dailyAttendances[0].missed_hour || '00.00'}</td></tr>
              <tr><td><strong>Hrs Pénalisable</strong></td><td>{dailyAttendances[0].penalisable || '00.00'}</td></tr>
              <tr><td><strong>Hrs Trav J.Férié</strong></td><td>{dailyAttendances[0].worked_hours_on_holidays || '00.00'}</td></tr>
              <tr><td><strong>Hrs Nuit</strong></td><td>{dailyAttendances[0].night_hours || '00.00'}</td></tr>
              <tr><td><strong>Hrs Dimanche</strong></td><td>{dailyAttendances[0].sunday_hour || '00.00'}</td></tr>
              <tr><td><strong>Jour Férié</strong></td><td>{dailyAttendances[0].jf_value || 'X'}</td></tr>
              <tr><td><strong>Congé Simple</strong></td><td>{dailyAttendances[0].jc_value || 'X'}</td></tr>
              <tr><td><strong>Congé Exp</strong></td><td>{dailyAttendances[0].jcx_value || 'X'}</td></tr>
            </tbody>
          </table>
        </div>
      );
    } else {
      return <p>Off</p>;
    }
  };

  const renderWeekTotalCell = (weekRecord) => {
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
                <tr><td><strong>Hrs Trav</strong></td><td>{weekRecord.total_worked_hours || '00.00'}</td></tr>
                <tr><td><strong>Hrs Absence</strong></td><td>{weekRecord.total_missed_hours || '00.00'}</td></tr>
                <tr><td><strong>Hrs Pénalisable</strong></td><td>{weekRecord.total_penalisable || '00.00'}</td></tr>
                <tr><td><strong>HTJF</strong></td><td>{weekRecord.total_htjf || '00.00'}</td></tr>
                <tr><td><strong>Hrs Nuit</strong></td><td>{weekRecord.total_night_hours || '00.00'}</td></tr>
                <tr><td><strong>Hrs Dimanche</strong></td><td>{weekRecord.total_sunday_hours || '00.00'}</td></tr>
                <tr><td><strong>Jour Férié</strong></td><td>{weekRecord.total_jf || '0'}</td></tr>
                <tr><td><strong>Congé Simple</strong></td><td>{weekRecord.total_jc || '0'}</td></tr>
                <tr><td><strong>Congé Exp</strong></td><td>{weekRecord.total_jcx || '0'}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      );
    } else {
      return <p>No data</p>;
    }
  };

  return (
    <div className="App">
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
      </div>

      <div className="navigation-container">
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
                      <Avatar src={(employee.avatar && `${employee.avatar}`)} />
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
                      <td 
                        key={weekIndex}
                      >
                        {renderWeekTotalCell(weekRecord)}
                      </td>
                    );
                  })
                )}
                
                <td className="synthese">
                  {viewMode === 'weekly' ? (
                    renderWeekTotalCell(
                      weeksAttendance.find(wa => 
                        wa.employee_id === employee.attendance_id && 
                        wa.start_date === formatWeekstart(currentWeekStart))
                    ))
                  : (
                    `${calculateTotalHours(employee, monthDates)} heures`
                  )}
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
            onSaveSuccess={() => {
            fetchAttendances();
            fetchWeeksattendance();
            setModalData({
                isOpen: false,
                employee: null,
                date: null,
                dailyAttendances: []
            });
            }}
        />
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Synthese;