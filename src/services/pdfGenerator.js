const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs'); // For synchronous operations
const handlebars = require('handlebars');
const { renderCharts } = require('./chartRenderer');
const { processMarkdown, formatDate, handlebarsHelpers, hasAnyPropertyWithValue } = require('../utils/helpers');

// Register Handlebars helpers
handlebars.registerHelper('processMarkdown', processMarkdown);
handlebars.registerHelper('formatDate', formatDate);

// Register all additional helpers
Object.entries(handlebarsHelpers).forEach(([name, helper]) => {
  handlebars.registerHelper(name, helper);
});

function getBrowserConfig() {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    // Production configuration for Railway/Docker
    return {
      headless: 'new',
      executablePath: '/usr/bin/google-chrome-stable',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--window-size=1920,1080',
        '--single-process',
        '--no-zygote',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    };
  } else {
    // Development configuration
    return {
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080'
      ]
    };
  }
}

async function generateTestResultPDF(data) {
  let browser;
  
  try {
    console.log('Starting PDF generation...');
    console.log('Environment:', process.env.NODE_ENV);
    console.log('Chrome path:', process.env.PUPPETEER_EXECUTABLE_PATH);
    
    // Check if Chrome executable exists
    const chromePath = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable';
    if (process.env.NODE_ENV === 'production') {
      try {
        await fs.access(chromePath, fsSync.constants.F_OK);
        console.log('Chrome executable found at:', chromePath);
      } catch (error) {
        console.error('Chrome executable not found at:', chromePath);
        try {
          const files = await fs.readdir('/usr/bin');
          const chromeFiles = files.filter(f => f.includes('chrome'));
          throw new Error(`Chrome not found at ${chromePath}. Available Chrome files in /usr/bin: ${chromeFiles.join(', ')}`);
        } catch (listError) {
          throw new Error(`Chrome not found at ${chromePath} and unable to list directory`);
        }
      }
    }
    
    // Get browser configuration
    const browserConfig = getBrowserConfig();
    console.log('Browser config:', JSON.stringify(browserConfig, null, 2));
    
    // Launch Puppeteer with environment-specific configuration
    browser = await puppeteer.launch(browserConfig);
    console.log('Browser launched successfully');

    const page = await browser.newPage();
    
    // Set viewport for consistent rendering
    await page.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1
    });

    // Set media type to print
    await page.emulateMediaType('print');

    // Prepare data for template
    const templateData = {
      ...data,
      chartSvgs: [],
      hasCutOff: false,
      hasPercentileRank: false,
      hasTScore: false
    };

    // Check for special columns in result_scales - only show columns that have actual data
    if (data.result_scales) {
      templateData.hasCutOff = hasAnyPropertyWithValue(data.result_scales, 'cutOffArea');
      templateData.hasPercentileRank = hasAnyPropertyWithValue(data.result_scales, 'percentileRank');
      templateData.hasTScore = hasAnyPropertyWithValue(data.result_scales, 'tScore');
    }

    // Render charts to PNG if available
    if (data.charts && data.charts.length > 0) {
      console.log(`Rendering ${data.charts.length} charts...`);
      templateData.chartSvgs = await renderCharts(data.charts, data.result_scales, data.historical_data);
    }

    // Load HTML template
    const templatePath = path.join(__dirname, '../templates/testResult.html');
    console.log('Loading template from:', templatePath);
    const templateContent = await fs.readFile(templatePath, 'utf8');
    const template = handlebars.compile(templateContent);
    
    // Generate HTML
    const html = template(templateData);
    console.log('HTML template compiled successfully');
    
    // Set page content
    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 60000
    });
    console.log('Page content set successfully');

    // Wait for any fonts to load
    await page.evaluateHandle('document.fonts.ready');
    
    // Wait additional time for images to load
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Generate PDF with specific settings to preserve font size
    console.log('Generating PDF...');
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
      preferCSSPageSize: true, // This helps preserve CSS font sizes
      timeout: 60000,
      scale: 1.0 // Ensure no scaling
    });

    console.log('PDF generated successfully, size:', pdfBuffer.length, 'bytes');
    return pdfBuffer;

  } catch (error) {
    console.error('PDF generation error:', error);
    console.error('Error stack:', error.stack);
    throw error;
  } finally {
    if (browser) {
      try {
        await browser.close();
        console.log('Browser closed successfully');
      } catch (closeError) {
        console.error('Error closing browser:', closeError);
      }
    }
  }
}

module.exports = {
  generateTestResultPDF
};