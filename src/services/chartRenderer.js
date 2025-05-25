const echarts = require('echarts');
const { createCanvas } = require('canvas');
const { JSDOM } = require('jsdom');

// Set up a virtual DOM for server-side rendering
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;

async function renderCharts(charts, resultScales, historicalData) {
  const renderedCharts = [];
  
  for (const [index, chart] of charts.entries()) {
    try {
      console.log(`Rendering chart ${index + 1} of type: ${chart.type}`);
      
      // Parse chart configuration
      let chartOption = typeof chart.chart_json === 'string' 
        ? JSON.parse(chart.chart_json) 
        : chart.chart_json;
      
      // Process chart based on type
      const scaleIdentifiers = chart.scale_identifier ? chart.scale_identifier.split(',') : [];
      
      switch (chart.type) {
        case 'gradient-bar':
          chartOption = processGradientBarChart(chartOption, resultScales, scaleIdentifiers[0]);
          break;
        case 'bar':
          chartOption = processStackedBarChart(chartOption, resultScales, scaleIdentifiers[0]);
          break;
        case 'multi-bar':
          chartOption = processMultiStackedBarChart(chartOption, resultScales, scaleIdentifiers);
          break;
        case 'line':
          const scaleKey = scaleIdentifiers[0]?.toLowerCase();
          const scaleHistory = historicalData?.[scaleKey] || [];
          chartOption = processLineChart(chartOption, resultScales, scaleIdentifiers[0], scaleHistory);
          break;
        case 'multi-single-bar':
          chartOption = processMultiSingleBarChart(chartOption, resultScales, scaleIdentifiers);
          break;
      }
      
      // Create a virtual canvas element
      const container = dom.window.document.createElement('div');
      container.style.width = '800px';
      container.style.height = `${chart.height || 400}px`;
      dom.window.document.body.appendChild(container);
      
      // Initialize ECharts with SVG renderer
      const chartInstance = echarts.init(container, null, {
        renderer: 'svg',
        width: 800,
        height: chart.height || 400
      });
      
      // Set chart options
      chartInstance.setOption(chartOption);
      
      // Get SVG string
      const svgString = chartInstance.renderToSVGString();
      
      // Convert to data URI
      const svgDataUri = `data:image/svg+xml;base64,${Buffer.from(svgString).toString('base64')}`;
      
      renderedCharts.push({
        svg: svgDataUri,
        extraInfo: chart.extra_info || null
      });
      
      // Clean up
      chartInstance.dispose();
      container.remove();
      
    } catch (error) {
      console.error(`Error rendering chart ${index}:`, error);
      renderedCharts.push({
        svg: null,
        extraInfo: chart.extra_info || null,
        error: error.message
      });
    }
  }
  
  return renderedCharts;
}

// Chart processing functions (same as in your frontend)
function processGradientBarChart(chartConfig, resultScales, scaleIdentifier) {
  if (!resultScales?.[scaleIdentifier]) return chartConfig;
  
  const resultValue = resultScales[scaleIdentifier].value;
  const cutOffArea = resultScales[scaleIdentifier].cutOffArea;
  
  if (resultValue === undefined) return chartConfig;
  
  // Update the indicator line position
  if (chartConfig.series?.[1]?.markLine?.data?.[0]) {
    chartConfig.series[1].markLine.data[0].xAxis = resultValue;
    
    if (chartConfig.series[1].markLine.label) {
      let labelText = `Wert: ${resultValue}`;
      if (cutOffArea) labelText += ` (${cutOffArea})`;
      chartConfig.series[1].markLine.label.formatter = labelText;
    }
  }
  
  return chartConfig;
}

function processStackedBarChart(chartConfig, resultScales, scaleIdentifier) {
  const normalizedScaleId = scaleIdentifier.toLowerCase();
  const scaleResult = resultScales[scaleIdentifier] || resultScales[normalizedScaleId];
  
  if (!scaleResult) return chartConfig;
  
  const resultValue = scaleResult.value;
  const cutOffArea = scaleResult.cutOffArea;
  
  if (resultValue === undefined) return chartConfig;
  
  const lineSeriesIndex = chartConfig.series.findIndex(series =>
    series.type === 'line' && series.markLine);
  
  if (lineSeriesIndex === -1) return chartConfig;
  
  const lineSeries = chartConfig.series[lineSeriesIndex];
  if (lineSeries.markLine?.data?.[0]) {
    lineSeries.markLine.data[0].xAxis = resultValue;
    
    if (lineSeries.markLine.label) {
      lineSeries.markLine.label.formatter = `${cutOffArea} (${resultValue})`;
    }
  }
  
  return chartConfig;
}

function processMultiStackedBarChart(chartConfig, resultScales, scaleIdentifiers) {
  const scatterSeriesIndices = chartConfig.series
    .map((series, index) => series.type === 'scatter' ? index : -1)
    .filter(index => index !== -1);
  
  if (scatterSeriesIndices.length === 0) return chartConfig;
  
  scatterSeriesIndices.forEach((seriesIndex, idx) => {
    if (idx >= scaleIdentifiers.length) return;
    
    const scaleId = scaleIdentifiers[idx];
    const scaleResult = resultScales[scaleId] || resultScales[scaleId.toLowerCase()];
    
    if (!scaleResult) return;
    
    const resultValue = scaleResult.value;
    const cutOffArea = scaleResult.cutOffArea;
    
    if (resultValue === undefined) return;
    
    const scatterSeries = chartConfig.series[seriesIndex];
    
    if (scatterSeries.data?.[0]) {
      scatterSeries.data[0][0] = resultValue;
    }
    
    if (scatterSeries.label) {
      scatterSeries.label.formatter = `${cutOffArea} (${resultValue})`;
      
      // Determine optimal position
      const minValue = chartConfig.xAxis.min || 0;
      const maxValue = chartConfig.xAxis.max || 100;
      const relativePosition = (resultValue - minValue) / (maxValue - minValue);
      
      scatterSeries.label.position = relativePosition > 0.7 ? 'left' : 'right';
    }
  });
  
  return chartConfig;
}

function processMultiSingleBarChart(chartConfig, resultScales, scaleIdentifiers) {
  if (!chartConfig.series[0]?.data) return chartConfig;
  
  for (let i = 0; i < Math.min(scaleIdentifiers.length, chartConfig.series[0].data.length); i++) {
    const scaleId = scaleIdentifiers[i];
    const scaleResult = resultScales[scaleId] || resultScales[scaleId.toLowerCase()];
    
    if (scaleResult?.value !== undefined) {
      const dataIndex = chartConfig.series[0].data.length - 1 - i;
      chartConfig.series[0].data[dataIndex].value = scaleResult.value;
    }
  }
  
  return chartConfig;
}

function processLineChart(chartConfig, resultScales, scaleIdentifier, scaleHistory) {
  if (scaleHistory && scaleHistory.length > 0) {
    // Sort by date
    scaleHistory.sort((a, b) => {
      const dateA = parseDate(a.date);
      const dateB = parseDate(b.date);
      return dateA - dateB;
    });
    
    const seriesData = scaleHistory.map(point => {
      if (point.value === undefined || point.value === null) return null;
      
      const value = parseFloat(point.value);
      let labelText = value.toFixed(1);
      if (point.cutOffArea) labelText += ` (${point.cutOffArea})`;
      
      return {
        value: [point.date, value],
        label: {
          show: true,
          formatter: labelText,
          position: 'top',
          fontSize: 12,
          color: '#333'
        }
      };
    }).filter(item => item !== null);
    
    if (seriesData.length > 0 && chartConfig.series[0]) {
      chartConfig.series[0].data = seriesData;
    }
  }
  
  return chartConfig;
}

function parseDate(dateString) {
  const parts = dateString.split('.');
  return new Date(
    parseInt(parts[2]), // year
    parseInt(parts[1]) - 1, // month (0-based)
    parseInt(parts[0]) // day
  );
}

module.exports = {
  renderCharts
};