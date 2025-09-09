const express = require('express');
const router = express.Router({ mergeParams: true });
const favoriteListController = require('../controllers/favoriteListController');
const { validateFavoriteList } = require('../middleware/validation');

// @route   GET /api/v1/tenants/:tenantId/favorite-lists
// @desc    Get all favorite lists for user (owned + shared)
// @access  Private (Tenant)
router.get('/', (req, res, next) => favoriteListController.getFavoriteLists(req, res, next));

// @route   POST /api/v1/tenants/:tenantId/favorite-lists
// @desc    Create new favorite list
// @access  Private (Tenant)
router.post('/', 
  validateFavoriteList.create,
  (req, res, next) => favoriteListController.createFavoriteList(req, res, next)
);

// @route   GET /api/v1/tenants/:tenantId/favorite-lists/:id
// @desc    Get specific favorite list with processes
// @access  Private (Tenant)
router.get('/:id', (req, res, next) => favoriteListController.getFavoriteList(req, res, next));

// @route   PUT /api/v1/tenants/:tenantId/favorite-lists/:id
// @desc    Update favorite list (name, description, color, public status)
// @access  Private (Tenant, Owner or Edit permission)
router.put('/:id', 
  validateFavoriteList.update,
  (req, res, next) => favoriteListController.updateFavoriteList(req, res, next)
);

// @route   DELETE /api/v1/tenants/:tenantId/favorite-lists/:id
// @desc    Delete favorite list
// @access  Private (Tenant, Owner only)
router.delete('/:id', (req, res, next) => favoriteListController.deleteFavoriteList(req, res, next));

// @route   GET /api/v1/tenants/:tenantId/favorite-lists/:id/processes
// @desc    Get processes in favorite list with pagination
// @access  Private (Tenant)
router.get('/:id/processes', (req, res, next) => favoriteListController.getProcessesInList(req, res, next));

// @route   POST /api/v1/tenants/:tenantId/favorite-lists/:id/processes
// @desc    Add process to favorite list
// @access  Private (Tenant, Owner or Edit permission)
router.post('/:id/processes', 
  validateFavoriteList.addProcess,
  (req, res, next) => favoriteListController.addProcessToList(req, res, next)
);

// @route   DELETE /api/v1/tenants/:tenantId/favorite-lists/:id/processes/:processId
// @desc    Remove process from favorite list
// @access  Private (Tenant, Owner or Edit permission)
router.delete('/:id/processes/:processId', (req, res, next) => favoriteListController.removeProcessFromList(req, res, next));

// @route   POST /api/v1/tenants/:tenantId/favorite-lists/:id/processes/bulk
// @desc    Add multiple processes to favorite list
// @access  Private (Tenant, Owner or Edit permission)
router.post('/:id/processes/bulk', 
  validateFavoriteList.bulkAddProcesses,
  (req, res, next) => favoriteListController.bulkAddProcesses(req, res, next)
);

// @route   GET /api/v1/tenants/:tenantId/favorite-lists/:id/available-processes
// @desc    Get processes that can be added to the list (not already included)
// @access  Private (Tenant, Owner or Edit permission)
router.get('/:id/available-processes', (req, res, next) => favoriteListController.getAvailableProcesses(req, res, next));

// @route   POST /api/v1/tenants/:tenantId/favorite-lists/:id/share
// @desc    Share list with another user in the same tenant
// @access  Private (Tenant, Owner only)
router.post('/:id/share', 
  validateFavoriteList.shareList,
  (req, res, next) => favoriteListController.shareList(req, res, next)
);

// @route   DELETE /api/v1/tenants/:tenantId/favorite-lists/:id/share/:userId
// @desc    Remove user from list sharing
// @access  Private (Tenant, Owner only)
router.delete('/:id/share/:userId', (req, res, next) => favoriteListController.removeUserFromList(req, res, next));

// @route   GET /api/v1/tenants/:tenantId/processes/:processId/favorite-lists
// @desc    Get all lists containing a specific process
// @access  Private (Tenant)
router.get('/processes/:processId/lists', (req, res, next) => favoriteListController.getListsContainingProcess(req, res, next));

// @route   POST /api/v1/tenants/:tenantId/favorite-lists/:id/validate
// @desc    Validate and clean favorite list (remove deleted processes)
// @access  Private (Tenant)
router.post('/:id/validate', (req, res, next) => favoriteListController.validateAndCleanList(req, res, next));

module.exports = router;