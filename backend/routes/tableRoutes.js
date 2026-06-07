const express = require('express');
const { createTable, getTables, updateTablePositions, deleteTable } = require('../controllers/tableController');

const router = express.Router({ mergeParams: true });

// Route to fetch all tables with seating occupancy
router.get('/', getTables);

// Route to create a new table
router.post('/', createTable);

// Route to save visual coordinates layout changes
router.patch('/positions', updateTablePositions);

// Route to delete an empty table
router.delete('/:tableId', deleteTable);

module.exports = router;
