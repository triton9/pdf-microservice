const echarts = require('echarts');
const { createCanvas } = require('canvas');
const { processChartData } = require('./chartProcessor');

// Set up ECharts platform API for canvas rendering
echarts.setPlatformAPI({
  createCanvas() {
    return createCanvas();
  }
});

async function generateChartImages({ charts, result_scales, historical_data }) {
  const images = [];
  const heights = [];
  
  console.log(`Processing ${charts.length} charts...`);
  
  for (const [index, chart] of charts.entries()) {
    try {
      console.log(`Rendering chart ${index + 1} of type: ${chart.type}`);
      
      // Parse chart configuration
      let chartOption = typeof chart.chart_json === 'string' 
        ? JSON.parse(chart.chart_json) 
        : chart.chart_json;
      
      // Process chart with real data
      const scaleIdentifiers = chart.scale_identifier ? chart.scale_identifier.split(',') : [];
      chartOption = processChartData({
        chartOption,
        chartType: chart.type,
        scaleIdentifiers,
        resultScales: result_scales,
        historicalData: historical_data
      });
      
      // Set chart dimensions
      const chartWidth = parseInt(process.env.CHART_WIDTH) || 700;
      const chartHeight = chart.height || 400;
      const dpi = parseInt(process.env.CHART_DPI) || 2;
      
      // Create canvas with high DPI for better quality
      const canvas = createCanvas(chartWidth * dpi, chartHeight * dpi);
      const ctx = canvas.getContext('2d');
      
      // Scale context for high DPI rendering
      ctx.scale(dpi, dpi);
      
      // Initialize ECharts with canvas
      const chartInstance = echarts.init(canvas, null, {
        width: chartWidth,
        height: chartHeight,
        devicePixelRatio: dpi
      });
      
      // Enhance chart options for better rendering
      chartOption = enhanceChartForImageGeneration(chartOption, chartWidth, chartHeight);
      
      // Set chart options and render
      chartInstance.setOption(chartOption);
      
      // Get PNG buffer with transparent background
      const dataUrl = chartInstance.getDataURL({
        type: 'png',
        pixelRatio: dpi,
        backgroundColor: 'transparent'
      });
      
      images.push(dataUrl);
      heights.push(chartHeight);
      
      // Clean up
      chartInstance.dispose();
      
      console.log(`Chart ${index + 1} rendered successfully`);
      
    } catch (error) {
      console.error(`Error rendering chart ${index + 1}:`, error);
      
      // Create a placeholder image or skip this chart
      const placeholderDataUrl = createPlaceholderImage(chart.height || 400);
      images.push(placeholderDataUrl);
      heights.push(chart.height || 400);
    }
  }
  
  return {
    images,
    heights
  };
}

function enhanceChartForImageGeneration(chartOption, width, height) {
  // Set consistent font settings for better rendering
  const defaultTextStyle = {
    fontFamily: 'Arial, sans-serif',
    fontSize: 12,
    fontWeight: 'normal',
    color: '#333333'
  };
  
  // Ensure transparent background
  chartOption.backgroundColor = 'transparent';
  
  // Disable animations for consistent rendering
  chartOption.animation = false;
  
  // Apply consistent font settings throughout the chart
  if (chartOption.title) {
    chartOption.title = {
      ...chartOption.title,
      textStyle: {
        ...defaultTextStyle,
        fontSize: 16,
        fontWeight: 'bold',
        ...chartOption.title.textStyle
      }
    };
  }
  
  if (chartOption.legend) {
    chartOption.legend = {
      ...chartOption.legend,
      textStyle: {
        ...defaultTextStyle,
        fontSize: 11,
        ...chartOption.legend.textStyle
      }
    };
  }
  
  // Enhance axis configurations
  ['xAxis', 'yAxis'].forEach(axisType => {
    if (chartOption[axisType]) {
      const axis = Array.isArray(chartOption[axisType]) ? chartOption[axisType] : [chartOption[axisType]];
      axis.forEach(axisConfig => {
        if (axisConfig.axisLabel) {
          axisConfig.axisLabel = {
            ...axisConfig.axisLabel,
            ...defaultTextStyle,
            fontSize: 10,
            margin: 8
          };
        }
        if (axisConfig.nameTextStyle) {
          axisConfig.nameTextStyle = {
            ...defaultTextStyle,
            fontSize: 11,
            ...axisConfig.nameTextStyle
          };
        }
      });
    }
  });
  
  // Enhance series configurations
  if (chartOption.series) {
    chartOption.series.forEach(series => {
      // Fix label configurations
      if (series.label) {
        series.label = {
          ...series.label,
          ...defaultTextStyle,
          fontSize: 10
        };
      }
      
      // Ensure proper bar rendering
      if (series.type === 'bar') {
        series.barCategoryGap = '20%';
        series.barGap = series.stack ? '0%' : '30%';
        series.barMaxWidth = 40;
      }
      
      // Ensure consistent line styles
      if (series.type === 'line') {
        series.lineStyle = {
          width: 2,
          ...series.lineStyle
        };
        series.symbol = series.symbol || 'circle';
        series.symbolSize = series.symbolSize || 6;
      }
      
      // Fix markLine configurations
      if (series.markLine) {
        if (series.markLine.label) {
          series.markLine.label = {
            ...series.markLine.label,
            ...defaultTextStyle,
            fontSize: 10
          };
        }
        if (series.markLine.lineStyle) {
          series.markLine.lineStyle = {
            width: 2,
            type: 'solid',
            ...series.markLine.lineStyle
          };
        }
      }
      
      // Fix scatter plot styling
      if (series.type === 'scatter') {
        series.symbolSize = series.symbolSize || 8;
        if (series.label) {
          series.label = {
            ...series.label,
            ...defaultTextStyle,
            fontSize: 10,
            offset: [0, -15]
          };
        }
      }
    });
  }
  
  // Ensure proper grid configuration
  if (!chartOption.grid) {
    chartOption.grid = {};
  }
  chartOption.grid = {
    left: '12%',
    right: '8%',
    top: '15%',
    bottom: '15%',
    containLabel: true,
    ...chartOption.grid
  };
  
  return chartOption;
}

function createPlaceholderImage(height) {
  // Create a simple placeholder image for failed charts
  const canvas = createCanvas(700, height);
  const ctx = canvas.getContext('2d');
  
  // Transparent background
  ctx.clearRect(0, 0, 700, height);
  
  // Draw placeholder text
  ctx.fillStyle = '#999999';
  ctx.font = '14px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Chart konnte nicht geladen werden', 350, height / 2);
  
  return canvas.toDataURL('image/png');
}

module.exports = {
  generateChartImages
};