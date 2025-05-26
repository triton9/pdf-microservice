const express = require('express');
const router = express.Router();
const { generateChartImages } = require('../services/chartRenderer');

// Add logging middleware for this router
router.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// POST endpoint to generate chart images
router.post('/generate', async (req, res) => {
  try {
    console.log('Received chart generation request');
    
    // Validate request body
    const { charts, result_scales, historical_data } = req.body;
    
    if (!charts || !Array.isArray(charts)) {
      console.error('Missing or invalid charts data in request');
      return res.status(400).json({ 
        error: 'Charts data is required and must be an array',
        success: false 
      });
    }

    console.log('Chart generation request:', {
      chartsCount: charts.length,
      hasResultScales: !!result_scales,
      hasHistoricalData: !!historical_data
    });

    // Generate chart images
    const result = await generateChartImages({
      charts,
      result_scales: result_scales || {},
      historical_data: historical_data || {}
    });
    
    console.log('Charts generated successfully:', {
      imageCount: result.images.length,
      totalSize: result.images.reduce((sum, img) => sum + img.length, 0)
    });
    
    // Return success response
    res.json({
      success: true,
      images: result.images,
      heights: result.heights,
      count: result.images.length
    });
    
  } catch (error) {
    console.error('Chart generation error:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ 
      success: false,
      error: 'Failed to generate charts',
      details: error.message 
    });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'Chart Generation Service'
  });
});

module.exports = router;