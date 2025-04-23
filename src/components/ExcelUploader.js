import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  TextField,
  CircularProgress,
  IconButton,
  Typography
} from '@mui/material';
import { Upload as UploadIcon } from '@mui/icons-material';
import axios from 'axios';
import apiConfig from '../config/Endpoint';

const ExcelImportModal = ({ open, onClose, machineId }) => {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState({ text: '', severity: 'info' });

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      // Vérifier l'extension du fichier
      const validExtensions = ['.xlsx', '.xls'];
      const fileExtension = selectedFile.name.split('.').pop().toLowerCase();
      
      if (!validExtensions.includes(`.${fileExtension}`)) {
        setMessage({ text: 'Veuillez sélectionner un fichier Excel (.xlsx, .xls)', severity: 'error' });
        return;
      }
      
      setFile(selectedFile);
      setFileName(selectedFile.name);
      setMessage({ text: '', severity: 'info' });
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage({ text: 'Veuillez sélectionner un fichier', severity: 'error' });
      return;
    }

    setIsUploading(true);
    setMessage({ text: 'Import en cours...', severity: 'info' });

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(`${apiConfig.baseUri}/import-excel`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setMessage({ text: response.data.message ,
         imported: response.data.imported ,
         error: response.data.errors,
         skipped: response.data.skipped || 'Import terminé avec succès!', severity: 'success' });
      setTimeout(() => onClose(), 2000); // Fermer le modal après 2 secondes
    } catch (error) {
      setMessage({ 
        text: error.response?.data?.message || "Erreur lors de l'import", 
        severity: 'error' 
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Importer les pointages depuis Excel</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
          <input
            accept=".xlsx,.xls"
            style={{ display: 'none' }}
            id="excel-upload"
            type="file"
            onChange={handleFileChange}
          />
          <label htmlFor="excel-upload">
            <Button
              variant="outlined"
              component="span"
              startIcon={<UploadIcon />}
              fullWidth
            >
              Sélectionner un fichier Excel
            </Button>
          </label>
          
          {fileName && (
            <Typography variant="body2" sx={{ mt: 1 }}>
              Fichier sélectionné: <strong>{fileName}</strong>
            </Typography>
          )}

          {message.text && (
            <Typography 
              color={message.severity === 'error' ? 'error' : message.severity === 'success' ? 'success' : 'text.primary'}
              variant="body2"
              sx={{ mt: 1 }}
            >
              {message.text}
              {message.imported && (
                <Typography variant="caption" color="text.secondary">
                  {message.imported} pointages importés
                </Typography>
              )}
                {message.skipped && (
                    <Typography variant="caption" color="text.secondary"  sx={{ mt: 1, ml: 2 }}  >
                    {message.skipped} pointages ignorés
                    </Typography>
                )}  

                {message.error && (
                    <Typography variant="caption" color="text.secondary"  sx={{ mt: 1, ml: 2 }}  >
                    {message.error}
                    </Typography>
                )}
            </Typography>
          )}

          <Box sx={{ mt: 2, p: 2, border: '1px dashed #ccc', borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Format attendu: "Date", "Matricule", "Pointage_1", "Pointage_2", "Pointage_3", "Pointage_4"
            </Typography>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button 
          onClick={onClose} 
          variant="contained" 
          color="secondary"
          disabled={isUploading}
        >
          Annuler
        </Button>
        <Button
          onClick={handleUpload}
          variant="contained"
          color="primary"
          disabled={isUploading || !file}
          startIcon={isUploading ? <CircularProgress size={20} color="inherit" /> : null}
        >
          {isUploading ? 'Import en cours...' : 'Importer'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ExcelImportModal;