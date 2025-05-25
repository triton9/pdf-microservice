const express = require('express');
const router = express.Router();
const { generateTestResultPDF } = require('../services/pdfGenerator');

// POST endpoint to generate PDF
router.post('/generate-test-result', async (req, res) => {
  try {
    console.log('Received PDF generation request');
    
    // Validate request body
    const { test, charts, resultFiltered, result_scales, result_criteria, historical_data } = req.body;
    
    if (!test) {
      return res.status(400).json({ error: 'Test data is required' });
    }

    // Generate PDF
    const pdfBuffer = await generateTestResultPDF(req.body);
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="test-result.pdf"');
    
    // Send PDF buffer
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate PDF',
      details: error.message 
    });
  }
});

module.exports = router;