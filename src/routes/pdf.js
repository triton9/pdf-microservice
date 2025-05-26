const express = require('express');
const router = express.Router();
const { generateTestResultPDF } = require('../services/pdfGenerator');

// Add logging middleware for this router
router.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  console.log('Headers:', req.headers);
  console.log('Body preview:', req.body ? Object.keys(req.body) : 'No body');
  next();
});

// POST endpoint to generate PDF
router.post('/generate-test-result', async (req, res) => {
  try {
    console.log('Received PDF generation request');
    console.log('Request URL:', req.originalUrl);
    console.log('Request path:', req.path);
    
    // Validate request body
    const { test, charts, resultFiltered, result_scales, result_criteria, historical_data } = req.body;
    
    if (!test) {
      console.error('Missing test data in request');
      return res.status(400).json({ error: 'Test data is required' });
    }

    console.log('Test data received:', {
      testId: test.id,
      chartsCount: charts ? charts.length : 0,
      hasResultFiltered: !!resultFiltered,
      hasResultScales: !!result_scales,
      hasResultCriteria: !!result_criteria,
      hasHistoricalData: !!historical_data
    });

    // Generate PDF
    const pdfBuffer = await generateTestResultPDF(req.body);
    
    console.log('PDF generated successfully, size:', pdfBuffer.length, 'bytes');
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="test-result.pdf"');
    
    // Send PDF buffer
    res.send(pdfBuffer);
    
  } catch (error) {
    console.error('PDF generation error:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ 
      error: 'Failed to generate PDF',
      details: error.message 
    });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'PDF Generation Microservice'
  });
});

module.exports = router;