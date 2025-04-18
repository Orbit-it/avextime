import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, parseISO, parse, startOfDay, startOfWeek, getDay, isBefore, isAfter, set } from 'date-fns';
import fr from 'date-fns/locale/fr';
import { Card, CardContent, Typography, TextField, Button, Box, Modal } from '@mui/material';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import api from '../api/api';

const locales = {
  fr: fr,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

const formatHolidays = (holidays) => {
  return holidays?.map((holiday) => ({
    id: holiday.id,
    title: holiday.description,
    start: startOfDay(new Date(holiday.holiday_date)),
    end: startOfDay(new Date(holiday.holiday_date)),
    allDay: true,
  }));
};

const HolidayModal = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  onDelete,
  selectedDate,
  holidayDescription,
  setHolidayDescription,
  previousWorkingDay,
  setPreviousWorkingDay,
  nextWorkingDay,
  setNextWorkingDay,
  isEditMode,
  isLoading
}) => {
  const [errors, setErrors] = useState({});
  
  const validate = () => {
    const newErrors = {};
    if (!holidayDescription.trim()) newErrors.description = 'Description requise';
    if (!previousWorkingDay) newErrors.previous = 'Jour ouvré précédent requis';
    if (!nextWorkingDay) newErrors.next = 'Jour ouvré suivant requis';
    
    if (previousWorkingDay && nextWorkingDay && isAfter(previousWorkingDay, nextWorkingDay)) {
      newErrors.dateOrder = 'Le jour précédent doit être avant le jour suivant';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onSubmit();
    }
  };

  return (
    <Modal 
      open={isOpen} 
      onClose={onClose}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Box sx={{ 
        p: 3, 
        bgcolor: 'white', 
        width: '50%', 
        minWidth: 400,
        borderRadius: 2, 
        boxShadow: 3 
      }}>
        <Typography variant="h6" gutterBottom>
          {isEditMode ? 'Modifier jour férié' : 'Ajouter jour férié'}
        </Typography>
        
        <Typography variant="body1" gutterBottom>
          Date du jour férié: {selectedDate?.toLocaleDateString('fr-FR')}
        </Typography>

        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={fr}>
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <DatePicker
              label="Jour ouvré précédent"
              minDate={new Date(selectedDate?.getTime() - 5 * 24 * 60 * 60 * 1000)} // 5 jours avant selectedDate
              maxDate={nextWorkingDay || selectedDate} // Ne peut pas dépasser nextWorkingDay ou selectedDate
              value={previousWorkingDay}
              onChange={setPreviousWorkingDay}
              disabled={isLoading}
              renderInput={(params) => (
                <TextField 
                  {...params} 
                  size="small" 
                  fullWidth 
                  required 
                  error={!!errors.previous || !!errors.dateOrder}
                  helperText={errors.previous || (errors.dateOrder && ' ')}
                />
              )}
            />
            <DatePicker
              label="Jour ouvré suivant"
              minDate={selectedDate}
              maxDate={new Date(selectedDate?.getTime() + 5 * 24 * 60 * 60 * 1000)} // 5 jours après selectedDate
              value={nextWorkingDay}
              onChange={setNextWorkingDay}
              disabled={isLoading}
              renderInput={(params) => (
                <TextField 
                  {...params} 
                  size="small" 
                  fullWidth 
                  required 
                  error={!!errors.next || !!errors.dateOrder}
                  helperText={errors.next || errors.dateOrder}
                />
              )}
            />
          </Box>
        </LocalizationProvider>

        <TextField
          label="Description du jour férié"
          size="small"
          value={holidayDescription}
          onChange={(e) => setHolidayDescription(e.target.value)}
          fullWidth
          required
          error={!!errors.description}
          helperText={errors.description}
          sx={{ mb: 3 }}
          disabled={isLoading}
        />

        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          {isEditMode && (
            <Button
              variant="contained"
              color="error"
              onClick={onDelete}
              disabled={isLoading}
            >
              {isLoading ? 'Suppression...' : 'Supprimer'}
            </Button>
          )}
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={onClose}
              disabled={isLoading}
            >
              Annuler
            </Button>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={isLoading}
              sx={{ backgroundColor: isEditMode ? '#27aae0' : '#27eea0' }}
            >
              {isLoading ? 'En cours...' : (isEditMode ? 'Modifier' : 'Ajouter')}
            </Button>
          </Box>
        </Box>
      </Box>
    </Modal>
  );
};

const CalendarView = () => {
  const [holidays, setHolidays] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [holidayDescription, setHolidayDescription] = useState('');
  const [previousWorkingDay, setPreviousWorkingDay] = useState(null);
  const [nextWorkingDay, setNextWorkingDay] = useState(null);
  const [editHoliday, setEditHoliday] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const formattedHolidays = useMemo(() => formatHolidays(holidays), [holidays]);

  useEffect(() => {
    const fetchHolidays = async () => {
      setIsLoading(true);
      try {
        await api.fetchHolidays(setHolidays);
      } catch (error) {
        console.error('Erreur lors du chargement des jours fériés:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchHolidays();
  }, []);

  const handleSubmitHoliday = async () => {
    setIsLoading(true);
    
    try {
      const holidayData = {
        description: holidayDescription,
        holiday_date: format(selectedDate, 'yyyy-MM-dd'),
        previous_working_day: previousWorkingDay ? format(previousWorkingDay, 'yyyy-MM-dd') : null,
        next_working_day: nextWorkingDay ? format(nextWorkingDay, 'yyyy-MM-dd') : null,
      };

      if (editHoliday) {
        await api.updateHoliday(editHoliday.id, holidayData);
      } else {
        await api.createHoliday(holidayData);
      }
      
      await api.fetchHolidays(setHolidays);
      resetForm();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteHoliday = async () => {
    if (!editHoliday) return;
    
    setIsLoading(true);
    try {
      await api.deleteHoliday(editHoliday.id);
      await api.fetchHolidays(setHolidays);
      resetForm();
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setIsModalVisible(false);
    setSelectedDate(null);
    setHolidayDescription('');
    setPreviousWorkingDay(null);
    setNextWorkingDay(null);
    setEditHoliday(null);
  };

  const handleSelectSlot = (slotInfo) => {
    setSelectedDate(startOfDay(slotInfo.start));
    setHolidayDescription('');
    setPreviousWorkingDay(null);
    setNextWorkingDay(null);
    setEditHoliday(null);
    setIsModalVisible(true);
  };

  const handleSelectEvent = async (event) => {
    try {
      setIsLoading(true);
      const response = await api.getHoliday(event.id);
      
      if (!response) {
        console.error('Aucune donnée reçue');
        return;
      }
      console.log('Données reçues:', response);
      setSelectedDate(startOfDay(new Date(response.holiday_date)));
      setHolidayDescription(response.description);
      setPreviousWorkingDay(
        response.previous_working_day 
          ? startOfDay(parseISO(response.previous_working_day))
          : null
      );
      setNextWorkingDay(
        response.next_working_day 
          ? startOfDay(parseISO(response.next_working_day))
          : null
      );
      setEditHoliday(response);
      setIsModalVisible(true);
    } catch (error) {
      console.error('Erreur lors de la récupération:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const customDayPropGetter = (date) => {
    if (selectedDate && date.toDateString() === selectedDate.toDateString()) {
      return {
        style: {
          backgroundColor: '#27eea0',
        },
      };
    }
    return {};
  };

  const customEventPropGetter = () => ({
    style: {
      backgroundColor: '#27aae0',
      color: '#fff',
      borderRadius: '4px',
      cursor: 'pointer',
    },
  });

  return (
    <Card>
      <CardContent>
        {isLoading && !isModalVisible ? (
          <Typography>Chargement en cours...</Typography>
        ) : (
          <Box sx={{ '& .rbc-day-bg:hover': { backgroundColor: '#e0f7fa', cursor: 'pointer' } }}>
            <Calendar
              localizer={localizer}
              events={formattedHolidays}
              startAccessor="start"
              endAccessor="end"
              selectable
              onSelectSlot={handleSelectSlot}
              onSelectEvent={handleSelectEvent}
              style={{ height: 500 }}
              dayPropGetter={customDayPropGetter}
              eventPropGetter={customEventPropGetter}
              messages={{
                today: "Aujourd'hui",
                previous: 'Précédent',
                next: 'Suivant',
                month: 'Mois',
                week: 'Semaine',
                day: 'Jour',
                agenda: 'Agenda',
                date: 'Date',
                time: 'Heure',
                event: 'Événement',
                noEventsInRange: 'Aucun événement dans cette plage.',
              }}
              culture="fr"
            />
          </Box>
        )}
      </CardContent>

      <HolidayModal
        isOpen={isModalVisible}
        onClose={resetForm}
        onSubmit={handleSubmitHoliday}
        onDelete={handleDeleteHoliday}
        selectedDate={selectedDate}
        holidayDescription={holidayDescription}
        setHolidayDescription={setHolidayDescription}
        previousWorkingDay={previousWorkingDay}
        setPreviousWorkingDay={setPreviousWorkingDay}
        nextWorkingDay={nextWorkingDay}
        setNextWorkingDay={setNextWorkingDay}
        isEditMode={!!editHoliday}
        isLoading={isLoading}
      />
    </Card>
  );
};

export default CalendarView;