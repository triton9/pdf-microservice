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
    const fs = require('fs');
    const chromePath = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable';
    if (process.env.NODE_ENV === 'production') {
      try {
        await fs.promises.access(chromePath, fs.constants.F_OK);
        console.log('Chrome executable found at:', chromePath);
      } catch (error) {
        console.error('Chrome executable not found at:', chromePath);
        throw new Error(`Chrome not found at ${chromePath}. Available files in /usr/bin: ${await fs.promises.readdir('/usr/bin').then(files => files.filter(f => f.includes('chrome')).join(', ')).catch(() => 'unable to list')}`);
      }
    }
    
    // Get browser configuration
    const browserConfig = getBrowserConfig();
    console.log('Browser config:', JSON.stringify(browserConfig, null, 2));
    
    // Launch Puppeteer with environment-specific configuration
    browser = await puppeteer.launch(browserConfig);
    console.log('Browser launched successfully');

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
    console.log('Loading template from:', templatePath);
    const templateContent = await fs.readFile(templatePath, { encoding: 'utf-8' });
    const template = handlebars.compile(templateContent);
    
    // Generate HTML
    const html = template(templateData);
    console.log('HTML template compiled successfully');
    
    // Set page content
    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    console.log('Page content set successfully');

    // Wait for any chart rendering to complete
    await page.waitForTimeout(1000);

    // Generate PDF with A4 format
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
      preferCSSPageSize: false,
      timeout: 30000
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