const express = require('express');
const { createTable, getTables, updateTablePositions, deleteTable, updateTable, duplicateTable } = require('../controllers/tableController');

const router = express.Router({ mergeParams: true });

// UUID format validation for :tableId param
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
router.param('tableId', (req, res, next, value) => {
  if (!UUID_REGEX.test(value)) {
    return res.status(400).json({ success: false, error: 'INVALID_PARAM', message: 'tableId must be a valid UUID.' });
  }
  next();
});

// Route to fetch all tables with seating occupancy
router.get('/', getTables);

// Route to create a new table
router.post('/', createTable);

// Route to save visual coordinates layout changes
router.patch('/positions', updateTablePositions);

// Route to update table settings
router.patch('/:tableId', updateTable);

// Route to duplicate a table
router.post('/:tableId/duplicate', duplicateTable);

// Route to delete an empty table
router.delete('/:tableId', deleteTable);

module.exports = router;
