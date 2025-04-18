import axios from "axios";
import Endpoint from "../config/Endpoint";


// Créer un employe
const createEmployee = async (data) => {
    try {
      const response = await axios.post(Endpoint.employees, data);
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
        const response = await axios.put(`${Endpoint.employees}/${id}`, data);
        return { success: true, data: response.data }; 
    } catch (error) {
        console.error("Error updating employee:", error);
        throw error;
    }
};


// Fetching employees
const fetchEmployees = async (setter) => {
    try {
        const response = await axios.get(Endpoint.employees);
        setter(response.data)
    }
    catch(error) {
        console.log("Error fectching employees", error);
    }
};

// Fetching departments
const fetchDepartments = async (setter) => {
    try {
        const response = await axios.get(Endpoint.departments);
        setter(response.data)
    }catch(error) {
        console.log("Error fetching departments", error);
    }
    
}

// Fetching layoffs
const fetchLayoffs = async (setter) => {
    try {
        const response = await axios.get(Endpoint.layoffs);
        setter(response.data)
    }catch(error) {
        console.log("Error fetching layoffs", error);
    }
    
}

// fetching holidays
const fetchHolidays = async (setter) => {
    try {
        const response = await axios.get(Endpoint.holidays);
        setter(response.data)
    }catch(error) {
        console.log("Error fetching holidays", error);
    }
    
}

// update holiday
const updateHoliday = async (id, data) => {
    try {
        const response = await axios.put(`${Endpoint.holidays}/${id}`, data);
        return response.data;
    } catch (error) {
        console.error("Error updating holiday:", error);
        throw error;
    }
};

// create holiday
const createHoliday = async (data) => {
    try {
        const response = await axios.post(Endpoint.holidays, data);
        return response.data;
    } catch (error) {
        console.error("Error creating holiday:", error);
        throw error;
    }
};

const getHoliday = async (id) => {
    try {
      const response = await axios.get(`${Endpoint.holidays}/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error getting holiday:', error);
      throw error;
    }
  };

// delete holiday
 const deleteHoliday = async (id) => {
     try {
        const response = await axios.delete(`${Endpoint.holidays}/${id}`);
        return response.data;
    } catch (error) {
        console.error("Error deleting holiday:", error);
        throw error;
    }   
};

// Fonction pour login
const login = async (data) => {
    try {
        const response = await axios.post(Endpoint.login, data);
        return { role: response.data.role};
    } catch (error) {
        console.error("Error logging in:", error);
        throw error;
    }
};

// Fontion pour ajout de pointage manuel
const addManualPointage = async (data) => {
    try {
        const response = await axios.post(Endpoint.pointage, data);
        return response.data;
    } catch (error) {
        console.error("Error adding manual pointage:", error);
        throw error;
    }
};










export default {fetchEmployees, fetchDepartments, deleteHoliday, createEmployee, updateEmployee, addManualPointage,
    fetchLayoffs, fetchHolidays, updateHoliday,getHoliday, createHoliday};


