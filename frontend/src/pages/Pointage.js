import React, { useState, useEffect } from 'react';
import './Pointage.css'; // Import the CSS file for styling
import { ListItem, ListItemText, Avatar, ListItemAvatar } from '@mui/material';
import { yellow, blue } from '@mui/material/colors';
import axios from 'axios';
import apiconfig from '../config/Endpoint';
import AttendanceDetailsModal from '../components/AttendanceDetailsModal';

function Pointage() {
  // State to manage the current week's start date (Monday)
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 (Sunday) to 6 (Saturday)
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)); // Calculate Monday
    return startOfWeek;
  });
  
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [attendances, setAttendances] = useState([]);
  
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

  // Fetch departments and employees from the API
      useEffect(() => {
          fetchDepartments();
          fetchEmployees(); // Fetch employees when the component mounts
          fetchAttendances();
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



  // State to manage the search term
  const [searchTerm, setSearchTerm] = useState('');

  // State to manage the selected department filter
  const [selectedDepartment, setSelectedDepartment] = useState('Tous');

  // Function to get the dates for the current week (Monday to Sunday)
  const getCurrentWeekDates = (startDate) => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      dates.push(currentDate);
    }
    return dates;
  };

  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Les mois commencent à 0
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Format date as "DD" (e.g., "09")
  const formatDayNumber = (date) => {
    return date.toLocaleDateString('en-US', { day: '2-digit' });
  };

  // Format date as "MMM" (e.g., "Oct")
  const formatMonth = (date) => {
    return date.toLocaleDateString('fr', { month: 'short' });
  };

  // Function to go to the previous week
  const goToPreviousWeek = () => {
    const newStartDate = new Date(currentWeekStart);
    newStartDate.setDate(newStartDate.getDate() - 7);
    setCurrentWeekStart(newStartDate);
  };

  // Function to go to the next week
  const goToNextWeek = () => {
    const newStartDate = new Date(currentWeekStart);
    newStartDate.setDate(newStartDate.getDate() + 7);
    setCurrentWeekStart(newStartDate);
  };

  // Function to handle week selection from the input
  const handleWeekChange = (event) => {
    const weekValue = event.target.value; // Format: "YYYY-Www"
    if (!weekValue) return;

    // Parse the year and week number from the input value
    const [year, week] = weekValue.split('-W');
    if (!year || !week) return;

    // Calculate the start date of the selected week (Monday)
    const startOfWeek = getDateOfISOWeek(parseInt(year), parseInt(week));
    setCurrentWeekStart(startOfWeek);
  };

  // Helper function to get the start date (Monday) of an ISO week
  const getDateOfISOWeek = (year, week) => {
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const dayOfWeek = simple.getDay(); // 0 (Sunday) to 6 (Saturday)
    const startOfWeek = new Date(simple);
    startOfWeek.setDate(simple.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)); // Calculate Monday
    return startOfWeek;
  };

  // Get the current week's dates
  const weekDates = getCurrentWeekDates(currentWeekStart);


  // Filter employees based on search term (name or matricule) and department
  const filteredScheduleData = employees.filter((employee) => {
    const matchesSearchTerm =
      employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.attendance_id.toString().includes(searchTerm.toLowerCase());

    const matchesDepartment =
      selectedDepartment === 'Tous' || employee.department_id == selectedDepartment;


    return matchesSearchTerm && matchesDepartment  && employee.is_active;
  });

  return (
    <div className="App">
      <div className="week-navigation">
        {/* Add search input */}
        <div className="search-container">
          <input
            type="text"
            placeholder="Rechercher par nom ou matricule..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {/* Add department filter dropdown */}
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
          >
            <option value="Tous">Tous</option>
            {departments.map((d) => (
              <option value={d.id}>{d.name}</option>)
            )}
        
          </select>
        </div>
        <button onClick={goToPreviousWeek}>⬅️ Semaine précedente</button>
        <input
          type="week"
          value={formatDate(currentWeekStart).substring(0, 5) + 'W' + 
            Math.ceil((currentWeekStart.getDate() + currentWeekStart.getDay()) / 7)}
          onChange={handleWeekChange}
        />
        <button onClick={goToNextWeek}>Semaine suivante ➡️</button>
      </div>
      
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th className="sticky-column">Employé</th>
              {weekDates.map((date, index) => (
                <th key={index}>
                  <div className="date-header">
                    <div className="day-number">{formatDayNumber(date)}</div>
                    <div className="day-month">
                      <p>{['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'][index]}</p>
                      <p>{formatMonth(date)}</p>
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredScheduleData.map((employee) => (
              <tr key={employee.id}>
                <td className="employee-info sticky-column">

                  <ListItem>
                  <ListItemAvatar>
                    <Avatar
                    src={(employee.avatar && `${employee.avatar}`)}>
                     </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={employee.name}
                    secondary={employee.attendance_id}
                  />
                </ListItem>

                </td>
                {weekDates.map((date) => {
              const dailyAttendances = attendances
                .filter((p) => p.employee_id === employee.attendance_id && p.date === formatDate(date));

              return (
                <td 
                key={formatDate(date)}
                onDoubleClick={() => openModal(employee, date, dailyAttendances)}>
                    <div className={
                        dailyAttendances.length > 0
                          ? dailyAttendances[0].is_anomalie
                            ? "anomalie" // Classe spéciale pour les anomalies
                              : dailyAttendances[0].status // Cas normal
                          : "cell-miss" // Cas par défaut si tableau vide
                      }>
                    {dailyAttendances.length > 0 ? (
                      <> 
                        {(dailyAttendances[0].has_night_shift && !dailyAttendances[0].isholidays &&
                         !dailyAttendances[0].is_conge && !dailyAttendances[0].islayoff &&
                         !dailyAttendances[0].is_congex && !dailyAttendances[0].is_maladie
                         && !dailyAttendances[0].is_accident && !dailyAttendances[0].is_anomalie  && dailyAttendances[0].getin
                        ) && (
                          <>
                          <p>
                          🌟 {dailyAttendances[0].getin || "- -:- -"} ➡️ {dailyAttendances[0].getout || "- -:- -"} <br />
                          
                          🌙 {dailyAttendances[0].night_getin} ➡️ {dailyAttendances[0].night_getout} <br />
                         </p>
                         </>
                        )}
                        { (!dailyAttendances[0].has_night_shift && !dailyAttendances[0].isholidays &&
                          !dailyAttendances[0].is_conge && !dailyAttendances[0].islayoff && 
                          !dailyAttendances[0].is_congex && !dailyAttendances[0].is_maladie
                          && !dailyAttendances[0].is_accident && !dailyAttendances[0].is_anomalie  && dailyAttendances[0].getin
                        ) && (
                           <p>
                           🕒 {dailyAttendances[0].getin || "- -:- -"} ➡️ {dailyAttendances[0].getout || "- -:- -"} <br/>
                           <span className={"status-dot status-"+dailyAttendances[0].status}></span>
                           ⏱️{dailyAttendances[0].hours_worked || "00"} <span style={{fontSize:10}} >HEURES TRAV</span>
                         </p>
                        )}
                        {dailyAttendances[0].isholidays && (
                           <p>
                            <span >JOUR FERIE</span> <br />
                            ⏱️{dailyAttendances[0].worked_hours_on_holidays || "00"} <span style={{fontSize:10}} >Heure Trav JF</span>

                          </p>
                        )}

                        {dailyAttendances[0].is_conge && (
                          <p>
                            <span >CONGE</span> <br />
                          </p>
                        )}

                        {(dailyAttendances[0].islayoff) && (
                          <p>
                            <span >MISE A PIED</span> <br />
                          </p>
                        )}

                        {(dailyAttendances[0].is_congex) && (
                          <p>
                            <span >CONGE EXCEPTIONNEL</span> <br />
                          </p>
                        )}

                        {(dailyAttendances[0].status == 'rdv_medical') && (
                          <p>
                            <span >RDV MEDICAL</span> <br />
                          </p>
                        )}

                        {(dailyAttendances[0].status == 'absent' && !dailyAttendances[0].getin && !dailyAttendances[0].getout && !dailyAttendances[0].is_weekend) && (
                          <p>
                            <span >ABSENT</span> <br />
                          </p>
                        )}

                        {dailyAttendances[0].is_maladie && (
                          <p>
                            <span >CONGE MALADIE</span> <br />
                          </p>
                        )}
                        
                        {dailyAttendances[0].is_accident && (
                          <p>
                            <span >ACCIDENT DE TRAVAIL</span> <br />
                          </p>
                        )}

                        {dailyAttendances[0].is_anomalie && (
                          <p>
                            <p>
                           🕒 {dailyAttendances[0].getin || "- -:- -"} ➡️ {dailyAttendances[0].getout || "- -:- -"} <br/>
                           <span className={"status-dot status-map"}></span> <br/>
                           <span >Anomalie</span>
                         </p>
                          </p>
                        )}

                        
                       
                      </>
                    ) : (
                      <p>Off</p>
                    )}
                    </div>

                </td>
              );
            })}

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

export default Pointage;