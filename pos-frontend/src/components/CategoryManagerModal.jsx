import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Divider,
  Chip
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Category as CategoryIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import axiosInstance from '../utils/axiosInstance';

const CategoryManagerModal = ({ open, onClose, onSuccess }) => {
  const [categories, setCategories] = useState([]);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);

  useEffect(() => {
    if (open) {
      loadCategories();
    }
  }, [open]);

  const loadCategories = async () => {
    try {
      const response = await axiosInstance.get('/categories/');
      setCategories(response.data);
    } catch (err) {
      console.error('Failed to load categories:', err);
      setError('Failed to load categories');
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setError('Category name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (editingCategory) {
        // Update existing category
        await axiosInstance.put(`/categories/${editingCategory.id}/`, formData);
      } else {
        // Create new category
        await axiosInstance.post('/categories/', formData);
      }
      
      onSuccess?.();
      setFormData({ name: '', description: '' });
      setEditingCategory(null);
      loadCategories();
    } catch (err) {
      console.error('Category operation failed:', err);
      if (err.response?.data) {
        const errors = err.response.data;
        if (typeof errors === 'object') {
          const errorMessages = Object.values(errors).flat().join(', ');
          setError(errorMessages);
        } else {
          setError('Operation failed');
        }
      } else {
        setError('Operation failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (categoryId) => {
    if (!window.confirm('Are you sure you want to delete this category? Products in this category will become uncategorized.')) {
      return;
    }

    try {
      await axiosInstance.delete(`/categories/${categoryId}/`);
      onSuccess?.();
      loadCategories();
    } catch (err) {
      console.error('Delete failed:', err);
      setError('Failed to delete category');
    }
  };

  const handleEdit = (category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || ''
    });
  };

  const handleCancelEdit = () => {
    setEditingCategory(null);
    setFormData({ name: '', description: '' });
    setError('');
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <CategoryIcon color="primary" />
          <Typography variant="h6">
            {editingCategory ? 'Edit Category' : 'Manage Categories'}
          </Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* Add/Edit Category Form */}
        <Box sx={{ mb: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
          <Typography variant="subtitle1" gutterBottom>
            {editingCategory ? 'Edit Category' : 'Add New Category'}
          </Typography>
          
          <Box display="flex" gap={2} alignItems="flex-start">
            <TextField
              label="Category Name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
              sx={{ flex: 1 }}
              placeholder="e.g., Beverages, Snacks, Dairy"
            />
            
            <TextField
              label="Description (Optional)"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              sx={{ flex: 1 }}
              placeholder="Brief description of this category"
            />
            
            <Box display="flex" gap={1}>
              {editingCategory && (
                <Button onClick={handleCancelEdit} variant="outlined">
                  Cancel
                </Button>
              )}
              <Button 
                onClick={handleSubmit} 
                variant="contained" 
                disabled={loading || !formData.name.trim()}
                startIcon={<AddIcon />}
              >
                {loading ? 'Saving...' : editingCategory ? 'Update' : 'Add'}
              </Button>
            </Box>
          </Box>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Categories List */}
        <Typography variant="subtitle1" gutterBottom>
          Existing Categories ({categories.length})
        </Typography>
        
        {categories.length === 0 ? (
          <Box textAlign="center" py={4}>
            <CategoryIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography color="textSecondary">
              No categories created yet
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Add your first category to organize products
            </Typography>
          </Box>
        ) : (
          <List>
            {categories.map((category, index) => (
              <ListItem 
                key={category.id}
                divider={index < categories.length - 1}
                sx={{ 
                  bgcolor: editingCategory?.id === category.id ? 'action.selected' : 'transparent',
                  borderRadius: 1
                }}
              >
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="body1" fontWeight="medium">
                        {category.name}
                      </Typography>
                      {category.description && (
                        <Chip 
                          label={category.description} 
                          size="small" 
                          variant="outlined"
                          color="primary"
                        />
                      )}
                    </Box>
                  }
                  secondary={
                    category.description && (
                      <Typography variant="body2" color="textSecondary">
                        {category.description}
                      </Typography>
                    )
                  }
                />
                
                <ListItemSecondaryAction>
                  <Box display="flex" gap={1}>
                    <IconButton 
                      size="small" 
                      onClick={() => handleEdit(category)}
                      color="primary"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton 
                      size="small" 
                      onClick={() => handleDelete(category.id)}
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CategoryManagerModal;