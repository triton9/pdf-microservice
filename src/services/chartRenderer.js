const echarts = require('echarts');
const { createCanvas, Image } = require('canvas');

// Set up ECharts platform API for canvas rendering
echarts.setPlatformAPI({
  createCanvas() {
    return createCanvas();
  },
  loadImage(src, onload, onerror) {
    const img = new Image();
    img.onload = onload.bind(img);
    img.onerror = onerror.bind(img);
    img.src = src;
    return img;
  }
});

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
      
      // Create canvas
      const chartWidth = 800;
      const chartHeight = chart.height || 400;
      const canvas = createCanvas(chartWidth, chartHeight);
      
      // Initialize ECharts with canvas
      const chartInstance = echarts.init(canvas);
      
      // Enhance chart options for better PDF rendering
      chartOption = enhanceChartForPDF(chartOption, chartWidth, chartHeight);
      
      // Set chart options
      chartInstance.setOption(chartOption);
      
      // Get PNG buffer
      const buffer = canvas.toBuffer('image/png');
      
      // Convert to data URI
      const pngDataUri = `data:image/png;base64,${buffer.toString('base64')}`;
      
      renderedCharts.push({
        png: pngDataUri,
        extraInfo: chart.extra_info || null
      });
      
      // Clean up
      chartInstance.dispose();
      
    } catch (error) {
      console.error(`Error rendering chart ${index}:`, error);
      renderedCharts.push({
        png: null,
        extraInfo: chart.extra_info || null,
        error: error.message
      });
    }
  }
  
  return renderedCharts;
}

function enhanceChartForPDF(chartOption, width, height) {
  // Set consistent font settings for better PDF rendering
  const defaultTextStyle = {
    fontFamily: 'Arial',
    fontSize: 14,
    fontWeight: 'normal',
    color: '#333'
  };
  
  // Apply consistent font settings throughout the chart
  if (chartOption.title) {
    chartOption.title = {
      ...chartOption.title,
      textStyle: {
        ...defaultTextStyle,
        fontSize: 18,
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
        fontSize: 12,
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
            fontSize: 12,
            margin: 10
          };
        }
        if (axisConfig.nameTextStyle) {
          axisConfig.nameTextStyle = {
            ...defaultTextStyle,
            fontSize: 12,
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
          fontSize: 11
        };
      }
      
      // Fix bar alignment issues - ensure proper spacing and alignment
      if (series.type === 'bar') {
        series.barCategoryGap = '20%';
        series.barGap = series.stack ? '0%' : '30%'; // No gap for stacked bars
        series.barMaxWidth = 50; // Limit bar width for consistency
      }
      
      // Ensure consistent line styles
      if (series.type === 'line') {
        series.lineStyle = {
          width: 3,
          ...series.lineStyle
        };
        series.symbol = series.symbol || 'circle';
        series.symbolSize = series.symbolSize || 8;
      }
      
      // Fix markLine configurations
      if (series.markLine) {
        if (series.markLine.label) {
          series.markLine.label = {
            ...series.markLine.label,
            ...defaultTextStyle,
            fontSize: 11
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
      
      // Fix scatter plot alignment
      if (series.type === 'scatter') {
        series.symbolSize = series.symbolSize || 10;
        if (series.label) {
          series.label = {
            ...series.label,
            ...defaultTextStyle,
            fontSize: 11,
            offset: [0, -20] // Ensure labels don't overlap with points
          };
        }
      }
    });
  }
  
  // Ensure proper grid configuration with adequate spacing
  if (!chartOption.grid) {
    chartOption.grid = {};
  }
  chartOption.grid = {
    left: '15%',
    right: '10%',
    top: '20%',
    bottom: '20%',
    containLabel: true,
    ...chartOption.grid
  };
  
  // Disable animations for consistent PDF rendering
  chartOption.animation = false;
  
  // Ensure proper background
  chartOption.backgroundColor = 'transparent';
  
  return chartOption;
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
  
  // Ensure all bar series have consistent alignment
  chartConfig.series.forEach(series => {
    if (series.type === 'bar') {
      series.barCategoryGap = '20%';
      series.barGap = '0%'; // No gap between stacked bars
      series.barMaxWidth = 50;
      
      // Ensure bars are properly stacked
      if (series.stack) {
        // Make sure all bars in the same stack have consistent properties
        series.emphasis = series.emphasis || {};
        series.emphasis.focus = 'series';
      }
    }
  });
  
  return chartConfig;
}

function processMultiStackedBarChart(chartConfig, resultScales, scaleIdentifiers) {
  const scatterSeriesIndices = chartConfig.series
    .map((series, index) => series.type === 'scatter' ? index : -1)
    .filter(index => index !== -1);
  
  if (scatterSeriesIndices.length === 0) return chartConfig;
  
  // First ensure all bars are properly aligned
  chartConfig.series.forEach(series => {
    if (series.type === 'bar') {
      series.barCategoryGap = '20%';
      series.barGap = '0%';
      series.barMaxWidth = 50;
    }
  });
  
  // Process scatter points for indicators
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
      // Ensure the scatter point aligns with the correct category
      scatterSeries.data[0][0] = resultValue;
      scatterSeries.data[0][1] = idx; // Category index
    }
    
    if (scatterSeries.label) {
      scatterSeries.label.formatter = `${cutOffArea} (${resultValue})`;
      
      // Determine optimal position based on value
      const minValue = chartConfig.xAxis?.min || 0;
      const maxValue = chartConfig.xAxis?.max || 100;
      const relativePosition = (resultValue - minValue) / (maxValue - minValue);
      
      scatterSeries.label.position = relativePosition > 0.7 ? 'left' : 'right';
      scatterSeries.label.offset = [relativePosition > 0.7 ? -15 : 15, 0];
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
      series.barMaxWidth = 50;
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
          fontSize: 11,
          color: '#333',
          fontFamily: 'Arial'
        }
      };
    }).filter(item => item !== null);
    
    if (seriesData.length > 0 && chartConfig.series[0]) {
      chartConfig.series[0].data = seriesData;
      
      // Ensure proper line styling
      chartConfig.series[0].lineStyle = {
        width: 3,
        ...chartConfig.series[0].lineStyle
      };
      chartConfig.series[0].symbol = 'circle';
      chartConfig.series[0].symbolSize = 8;
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