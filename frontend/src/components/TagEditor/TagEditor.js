import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Slider,
  Typography,
  IconButton,
  Stack,
  Paper,
  Tooltip,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';

const TagEditor = ({ tags = [], onSave, onCancel, open = false }) => {
  const [editableTags, setEditableTags] = useState([]);
  const [newTagName, setNewTagName] = useState('');
  const [newTagWeight, setNewTagWeight] = useState(0.5);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [editingWeight, setEditingWeight] = useState(0.5);

  useEffect(() => {
    // Initialize with current tags
    if (Array.isArray(tags)) {
      setEditableTags(tags.map(tag => ({
        name: tag.name,
        weight: tag.weight || 0.5
      })));
    }
  }, [tags]);

  const handleAddTag = () => {
    const trimmedName = newTagName.trim().toLowerCase();
    
    // Validation
    if (!trimmedName) return;
    if (editableTags.some(tag => tag.name === trimmedName)) {
      alert('This tag already exists');
      return;
    }
    if (trimmedName.length > 50) {
      alert('Tag name must be less than 50 characters');
      return;
    }

    setEditableTags([...editableTags, { name: trimmedName, weight: newTagWeight }]);
    setNewTagName('');
    setNewTagWeight(0.5);
  };

  const handleDeleteTag = (index) => {
    const newTags = editableTags.filter((_, i) => i !== index);
    setEditableTags(newTags);
  };

  const handleStartEdit = (index) => {
    setEditingIndex(index);
    setEditingName(editableTags[index].name);
    setEditingWeight(editableTags[index].weight);
  };

  const handleSaveEdit = () => {
    const trimmedName = editingName.trim().toLowerCase();
    
    // Validation
    if (!trimmedName) return;
    if (editableTags.some((tag, i) => i !== editingIndex && tag.name === trimmedName)) {
      alert('This tag already exists');
      return;
    }

    const newTags = [...editableTags];
    newTags[editingIndex] = { name: trimmedName, weight: editingWeight };
    setEditableTags(newTags);
    setEditingIndex(null);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingName('');
    setEditingWeight(0.5);
  };

  const handleSave = () => {
    onSave(editableTags);
  };

  const getChipSize = (weight) => {
    if (weight >= 0.8) return 'medium';
    if (weight >= 0.5) return 'small';
    return 'small';
  };

  const getChipColor = (weight) => {
    if (weight >= 0.8) return 'primary';
    if (weight >= 0.5) return 'default';
    return 'default';
  };

  const getChipVariant = (weight) => {
    if (weight >= 0.8) return 'filled';
    return 'outlined';
  };

  if (!open) {
    // Inline display mode
    return (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
        {editableTags.map((tag, index) => (
          <Tooltip key={index} title={`Weight: ${(tag.weight * 100).toFixed(0)}%`}>
            <Chip
              label={tag.name}
              size={getChipSize(tag.weight)}
              color={getChipColor(tag.weight)}
              variant={getChipVariant(tag.weight)}
              sx={{
                fontWeight: tag.weight >= 0.7 ? 'bold' : 'normal',
                fontSize: tag.weight >= 0.7 ? '0.875rem' : '0.75rem',
              }}
            />
          </Tooltip>
        ))}
      </Box>
    );
  }

  // Full editor dialog
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="md" fullWidth>
      <DialogTitle>Edit Tags with Weights</DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>
          Tag weights determine their importance and visual prominence. Higher weights (70-100%) make tags appear larger and bolder.
        </Alert>

        {/* Add new tag */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Add New Tag
          </Typography>
          <Stack spacing={2}>
            <TextField
              size="small"
              label="Tag name"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleAddTag();
                }
              }}
              fullWidth
            />
            <Box>
              <Typography variant="body2" gutterBottom>
                Weight: {(newTagWeight * 100).toFixed(0)}%
              </Typography>
              <Slider
                value={newTagWeight}
                onChange={(e, value) => setNewTagWeight(value)}
                min={0}
                max={1}
                step={0.05}
                marks={[
                  { value: 0, label: '0%' },
                  { value: 0.5, label: '50%' },
                  { value: 1, label: '100%' },
                ]}
              />
            </Box>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddTag}
              disabled={!newTagName.trim()}
            >
              Add Tag
            </Button>
          </Stack>
        </Paper>

        {/* Existing tags */}
        <Typography variant="subtitle2" gutterBottom>
          Existing Tags ({editableTags.length})
        </Typography>
        <Stack spacing={2}>
          {editableTags.map((tag, index) => (
            <Paper key={index} sx={{ p: 2 }}>
              {editingIndex === index ? (
                <Stack spacing={2}>
                  <TextField
                    size="small"
                    label="Tag name"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    fullWidth
                  />
                  <Box>
                    <Typography variant="body2" gutterBottom>
                      Weight: {(editingWeight * 100).toFixed(0)}%
                    </Typography>
                    <Slider
                      value={editingWeight}
                      onChange={(e, value) => setEditingWeight(value)}
                      min={0}
                      max={1}
                      step={0.05}
                      marks={[
                        { value: 0, label: '0%' },
                        { value: 0.5, label: '50%' },
                        { value: 1, label: '100%' },
                      ]}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<SaveIcon />}
                      onClick={handleSaveEdit}
                    >
                      Save
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<CancelIcon />}
                      onClick={handleCancelEdit}
                    >
                      Cancel
                    </Button>
                  </Box>
                </Stack>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Chip
                      label={tag.name}
                      size={getChipSize(tag.weight)}
                      color={getChipColor(tag.weight)}
                      variant={getChipVariant(tag.weight)}
                      sx={{
                        fontWeight: tag.weight >= 0.7 ? 'bold' : 'normal',
                        fontSize: tag.weight >= 0.7 ? '0.875rem' : '0.75rem',
                      }}
                    />
                    <Typography variant="body2" color="text.secondary">
                      Weight: {(tag.weight * 100).toFixed(0)}%
                    </Typography>
                  </Box>
                  <Box>
                    <IconButton size="small" onClick={() => handleStartEdit(index)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => handleDeleteTag(index)} color="error">
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
              )}
            </Paper>
          ))}
        </Stack>

        {editableTags.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
            No tags yet. Add your first tag above.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">
          Save Tags
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TagEditor;