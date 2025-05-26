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
      
      // Ensure proper chart dimensions and configuration for PDF
      const chartWidth = 800;
      const chartHeight = chart.height || 400;
      
      // Initialize ECharts with SSR configuration
      const chartInstance = echarts.init(null, null, {
        renderer: 'svg',
        ssr: true,
        width: chartWidth,
        height: chartHeight
      });
      
      // Enhance chart options for better PDF rendering
      chartOption = enhanceChartForPDF(chartOption, chartWidth, chartHeight);
      
      // Set chart options
      chartInstance.setOption(chartOption);
      
      // Get SVG string using the new SSR method
      const svgString = chartInstance.renderToSVGString();
      
      // Clean up the SVG string and optimize for PDF
      const optimizedSvg = optimizeSvgForPDF(svgString);
      
      // Convert to data URI
      const svgDataUri = `data:image/svg+xml;base64,${Buffer.from(optimizedSvg).toString('base64')}`;
      
      renderedCharts.push({
        svg: svgDataUri,
        extraInfo: chart.extra_info || null
      });
      
      // Clean up
      chartInstance.dispose();
      
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

function enhanceChartForPDF(chartOption, width, height) {
  // Ensure proper font settings for PDF
  const defaultFont = {
    fontFamily: 'Arial, sans-serif',
    fontSize: 12,
    fontWeight: 'normal'
  };
  
  // Apply consistent font settings throughout the chart
  if (chartOption.title) {
    chartOption.title = {
      ...chartOption.title,
      textStyle: {
        ...defaultFont,
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
        ...defaultFont,
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
            ...defaultFont,
            margin: 8,
            fontSize: 11
          };
        }
        if (axisConfig.nameTextStyle) {
          axisConfig.nameTextStyle = {
            ...defaultFont,
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
          ...defaultFont,
          fontSize: 10
        };
      }
      
      // Fix bar alignment issues
      if (series.type === 'bar') {
        series.barCategoryGap = series.barCategoryGap || '20%';
        series.barGap = series.barGap || '30%';
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
            ...defaultFont,
            fontSize: 10
          };
        }
        if (series.markLine.lineStyle) {
          series.markLine.lineStyle = {
            width: 2,
            ...series.markLine.lineStyle
          };
        }
      }
      
      // Fix scatter plot alignment
      if (series.type === 'scatter') {
        series.symbolSize = series.symbolSize || 8;
        if (series.label) {
          series.label = {
            ...series.label,
            ...defaultFont,
            fontSize: 10,
            offset: [0, -15] // Ensure labels don't overlap with points
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
    left: '10%',
    right: '10%',
    top: '15%',
    bottom: '15%',
    containLabel: true,
    ...chartOption.grid
  };
  
  // Disable animations for consistent PDF rendering
  chartOption.animation = false;
  
  return chartOption;
}

function optimizeSvgForPDF(svgString) {
  // Remove any problematic attributes that might cause rendering issues
  let optimized = svgString
    .replace(/xmlns:xlink="[^"]*"/g, '') // Remove xlink namespace if present
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/>\s+</g, '><'); // Remove whitespace between tags
  
  // Ensure proper viewBox and dimensions
  if (!optimized.includes('viewBox')) {
    optimized = optimized.replace(
      /<svg([^>]*)>/,
      '<svg$1 viewBox="0 0 800 400" preserveAspectRatio="xMidYMid meet">'
    );
  }
  
  return optimized;
}

// Chart processing functions (enhanced for better alignment)
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
  
  // Ensure bars are properly aligned
  chartConfig.series.forEach(series => {
    if (series.type === 'bar') {
      series.barCategoryGap = '20%';
      series.barGap = '0%'; // No gap between stacked bars
    }
  });
  
  return chartConfig;
}

function processMultiStackedBarChart(chartConfig, resultScales, scaleIdentifiers) {
  const scatterSeriesIndices = chartConfig.series
    .map((series, index) => series.type === 'scatter' ? index : -1)
    .filter(index => index !== -1);
  
  if (scatterSeriesIndices.length === 0) return chartConfig;
  
  // Ensure bars are aligned first
  chartConfig.series.forEach(series => {
    if (series.type === 'bar') {
      series.barCategoryGap = '20%';
      series.barGap = '0%';
    }
  });
  
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
      // Ensure the scatter point aligns with the bar center
      scatterSeries.data[0][0] = resultValue;
      scatterSeries.data[0][1] = idx; // Use the category index for Y position
    }
    
    if (scatterSeries.label) {
      scatterSeries.label.formatter = `${cutOffArea} (${resultValue})`;
      
      // Determine optimal position
      const minValue = chartConfig.xAxis?.min || 0;
      const maxValue = chartConfig.xAxis?.max || 100;
      const relativePosition = (resultValue - minValue) / (maxValue - minValue);
      
      scatterSeries.label.position = relativePosition > 0.7 ? 'left' : 'right';
      scatterSeries.label.offset = [relativePosition > 0.7 ? -10 : 10, 0];
    }
  });
  
  return chartConfig;
}

function processMultiSingleBarChart(chartConfig, resultScales, scaleIdentifiers) {
  if (!chartConfig.series[0]?.data) return chartConfig;
  
  // Ensure proper bar alignment
  chartConfig.series.forEach(series => {
    if (series.type === 'bar') {
      series.barCategoryGap = '20%';
      series.barWidth = '60%';
    }
  });
  
  for (let i = 0; i < Math.min(scaleIdentifiers.length, chartConfig.series[0].data.length); i++) {
    const scaleId = scaleIdentifiers[i];
    const scaleResult = resultScales[scaleId] || resultScales[scaleId.toLowerCase()];
    
    if (scaleResult?.value !== undefined) {
      const dataIndex = chartConfig.series[0].data.length - 1 - i;
      if (chartConfig.series[0].data[dataIndex]) {
        chartConfig.series[0].data[dataIndex].value = scaleResult.value;
      }
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
          fontSize: 10,
          color: '#333',
          fontFamily: 'Arial, sans-serif'
        }
      };
    }).filter(item => item !== null);
    
    if (seriesData.length > 0 && chartConfig.series[0]) {
      chartConfig.series[0].data = seriesData;
      
      // Ensure proper line styling
      chartConfig.series[0].lineStyle = {
        width: 2,
        ...chartConfig.series[0].lineStyle
      };
      chartConfig.series[0].symbol = 'circle';
      chartConfig.series[0].symbolSize = 6;
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