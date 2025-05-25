const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs').promises;
const handlebars = require('handlebars');
const { renderCharts } = require('./chartRenderer');
const { processMarkdown, formatDate, handlebarsHelpers } = require('../utils/helpers');

// Register Handlebars helpers
handlebars.registerHelper('processMarkdown', processMarkdown);
handlebars.registerHelper('formatDate', formatDate);
handlebars.registerHelper('if_eq', function(a, b, opts) {
  return a === b ? opts.fn(this) : opts.inverse(this);
});
handlebars.registerHelper('includes', function(array, value) {
  return array && array.includes(value);
});

// Register additional helpers
Object.entries(handlebarsHelpers).forEach(([name, helper]) => {
  handlebars.registerHelper(name, helper);
});

async function generateTestResultPDF(data) {
  let browser;
  
  try {
    // Launch Puppeteer with specific viewport for consistent rendering
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080'
      ]
    });

    const page = await browser.newPage();
    
    // Set consistent viewport (A4 at 96 DPI)
    await page.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1
    });

    // Prepare data for template
    const templateData = {
      ...data,
      chartSvgs: [],
      hasCutOff: false,
      hasPercentileRank: false,
      hasTScore: false
    };

    // Check for special columns in result_scales
    if (data.result_scales) {
      for (const scale in data.result_scales) {
        const scaleData = data.result_scales[scale];
        if (scaleData.cutOffArea) templateData.hasCutOff = true;
        if (scaleData.percentileRank !== undefined) templateData.hasPercentileRank = true;
        if (scaleData.tScore !== undefined) templateData.hasTScore = true;
      }
    }

    // Render charts to SVG if available
    if (data.charts && data.charts.length > 0) {
      console.log(`Rendering ${data.charts.length} charts...`);
      templateData.chartSvgs = await renderCharts(data.charts, data.result_scales, data.historical_data);
    }

    // Load HTML template
    const templatePath = path.join(__dirname, '../templates/testResult.html');
    const templateContent = await fs.readFile(templatePath, 'utf-8');
    const template = handlebars.compile(templateContent);
    
    // Generate HTML
    const html = template(templateData);
    
    // Set page content
    await page.setContent(html, {
      waitUntil: 'networkidle0'
    });

    // Wait for any chart rendering to complete
    await page.waitForTimeout(1000);

    // Generate PDF with A4 format
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '15mm',
        bottom: '20mm',
        left: '15mm'
      },
      displayHeaderFooter: false,
      preferCSSPageSize: false
    });

    return pdfBuffer;

  } catch (error) {
    console.error('PDF generation error:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

module.exports = {
  generateTestResultPDF
};