import axios from "axios";
import apiConfig from "../config/Endpoint";



// Créer un employe
const createEmployee = async (data) => {
    try {
      const response = await axios.post(apiConfig.Endpoint.employees, data);
      return { success: true, data: response.data }; 
    } catch (error) {
      console.error("Error creating employee:", error);
      return { 
        success: false, 
        message: error.response?.data?.message || "Erreur serveur" 
      };
    }
  }

// Update an employee
const updateEmployee = async (id, data) => {
    try {
        const response = await axios.put(`${apiConfig.Endpoint.employees}/${id}`, data);
        return { success: true, data: response.data }; 
    } catch (error) {
        console.error("Error updating employee:", error);
        throw error;
    }
};


// Fetching employees
const fetchEmployees = async (setter) => {
    try {
        const response = await axios.get(apiConfig.Endpoint.employees);
        setter(response.data)
    }
    catch(error) {
        console.log("Error fectching employees", error);
    }
};

// Fetching departments
const fetchDepartments = async (setter) => {
    try {
        const response = await axios.get(apiConfig.Endpoint.departments);
        setter(response.data)
    }catch(error) {
        console.log("Error fetching departments", error);
    }
    
}

// Fetching layoffs
const fetchLayoffs = async (setter) => {
    try {
        const response = await axios.get(apiConfig.Endpoint.layoffs);
        setter(response.data)
    }catch(error) {
        console.log("Error fetching layoffs", error);
    }
    
}

// fetching holidays
const fetchHolidays = async (setter) => {
    try {
        const response = await axios.get(apiConfig.Endpoint.holidays);
        setter(response.data)
    }catch(error) {
        console.log("Error fetching holidays", error);
    }
    
}

// update holiday
const updateHoliday = async (id, data) => {
    try {
        const response = await axios.put(`${apiConfig.Endpoint.holidays}/${id}`, data);
        return response.data;
    } catch (error) {
        console.error("Error updating holiday:", error);
        throw error;
    }
};

// create holiday
const createHoliday = async (data) => {
    try {
        const response = await axios.post(apiConfig.Endpoint.holidays, data);
        return response.data;
    } catch (error) {
        console.error("Error creating holiday:", error);
        throw error;
    }
};

const getHoliday = async (id) => {
    try {
      const response = await axios.get(`${apiConfig.Endpoint.holidays}/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error getting holiday:', error);
      throw error;
    }
  };

// delete holiday
 const deleteHoliday = async (id) => {
     try {
        const response = await axios.delete(`${apiConfig.Endpoint.holidays}/${id}`);
        return response.data;
    } catch (error) {
        console.error("Error deleting holiday:", error);
        throw error;
    }   
};

// Fonction pour login
const login = async (data) => {
    try {
        const response = await axios.post(apiConfig.Endpoint.login, data);
        return { role: response.data.role};
    } catch (error) {
        console.error("Error logging in:", error);
        throw error;
    }
};

// Fontion pour ajout de pointage manuel
const addManualPointage = async (data) => {
    try {
        const response = await axios.post(apiConfig.Endpoint.pointage, data);
        return response.data;
    } catch (error) {
        console.error("Error adding manual pointage:", error);
        throw error;
    }
};

// Fontion pour corriger le pointage manuellement
const fixManuallyPointage = async (data) => {
    try {
        const response = await axios.post(apiConfig.Endpoint.attendance, data);
        return response.data;
    } catch (error) {
        console.error("Error adding manual pointage:", error);
        throw error;
    }
};

// Fonction pour supprimer un pointage
const deletePointage = async (id) => {
    try {
        const response = await axios.delete(`${apiConfig.Endpoint.attendance}/${id}`);
        return response.data;
    } catch (error) {
        console.error("Erreur de suppression du Pointage:", error);
        throw error;
    } 
}


// Fonction pour recupérer les pointages hebdomadaires avec start et end date
const fetchWeeklyPointages = async () => {
    try {
        const response = await axios.get(apiConfig.Endpoint.weeks);
        return response;
    } catch (error) {
        console.error("Error fetching weekly pointages:", error);
        throw error;
    }
};


// Récupérer les pointages summary
const fetchPointagesSummary = async () => {
    try {
        const response = await axios.get(apiConfig.Endpoint.pointagesSummary);
        return response;
    } catch (error) {
        console.error("Error fetching pointages summary:", error);
        throw error;
    }
};


// Récupérer les données du Dashboard

const fetchDashboardDatas = async () => {
    try {

        const response = await axios.get(apiConfig.Endpoint.dashboard);
        return response.data;

    } catch (error) {
        console.log("Erreur fetching data for dashboard from month_attendnce Table");
        throw error;
    }
};

const fetchNotification = async () => {
    try {

        const response = await axios.get(apiConfig.Endpoint.notif);
        return response;

    } catch (error) {
        console.log("Erreur fetching data for dashboard from month_attendnce Table");
        throw error;
    }
};



const readNotification = async (notificationIds) => {
    try {
      // Envoyer la requête au backend pour marquer les notifications comme lues
      const response = await fetch(`${apiConfig.baseUri}/notifications/mark-as-read`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ notification_ids: notificationIds })
      });
  
      if (!response.ok) {
        throw new Error('Erreur lors de la mise à jour des notifications');
      }
  
      return await response.json();
    } catch (error) {
      console.error("Erreur de mise à jour de notification:", error);
      throw error;
    }
  };









export default {fetchEmployees, fetchWeeklyPointages, login, fetchPointagesSummary, fetchDashboardDatas, readNotification,
    fetchDepartments, deleteHoliday, createEmployee, updateEmployee, addManualPointage, fetchNotification,
    fetchLayoffs, fetchHolidays, updateHoliday,getHoliday, createHoliday, deletePointage, fixManuallyPointage};


