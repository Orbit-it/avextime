import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogContentText,
  CircularProgress,
  Typography,
  Box
} from '@mui/material';

const DownloadModal = ({ open, progress, message, machine_name }) => {
  return (
    <Dialog open={open} aria-labelledby="download-dialog">
      <DialogContent>
        <Box display="flex" flexDirection="column" alignItems="center">
          <CircularProgress />
          
        <Typography variant="body1" sx={{ mt: 2 }}>
          {machine_name}
        </Typography>
          
        <DialogContentText sx={{ mt: 2 }}>
            {message || "Téléchargement en cours..."}
        </DialogContentText>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default DownloadModal;