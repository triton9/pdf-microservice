function processChartData({ chartOption, chartType, scaleIdentifiers, resultScales, historicalData }) {
  console.log(`Processing ${chartType} chart for scales:`, scaleIdentifiers);
  
  switch (chartType) {
    case 'gradient-bar':
      return processGradientBarChart(chartOption, resultScales, scaleIdentifiers[0]);
    case 'bar':
      return processStackedBarChart(chartOption, resultScales, scaleIdentifiers[0]);
    case 'multi-bar':
      return processMultiStackedBarChart(chartOption, resultScales, scaleIdentifiers);
    case 'line':
      const scaleKey = scaleIdentifiers[0]?.toLowerCase();
      const scaleHistory = historicalData[scaleKey] || [];
      return processLineChart(chartOption, resultScales, scaleIdentifiers[0], scaleHistory);
    case 'multi-single-bar':
      return processMultiSingleBarChart(chartOption, resultScales, scaleIdentifiers);
    default:
      console.warn(`Unknown chart type: ${chartType}`);
      return chartOption;
  }
}

function processGradientBarChart(chartConfig, resultScales, scaleIdentifier) {
  console.log(`Processing gradient bar chart for scale: ${scaleIdentifier}`);
  
  if (!resultScales[scaleIdentifier]) {
    console.log(`Scale ${scaleIdentifier} not found in results`);
    return chartConfig;
  }

  const resultValue = resultScales[scaleIdentifier].value;
  const cutOffArea = resultScales[scaleIdentifier].cutOffArea;

  console.log(`Result value: ${resultValue}, Cut-off area: ${cutOffArea}`);

  if (resultValue === undefined) {
    console.log('Result value is undefined, not updating chart');
    return chartConfig;
  }

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
  console.log(`Processing stacked bar chart for scale: ${scaleIdentifier}`);

  const normalizedScaleId = scaleIdentifier.toLowerCase();
  const scaleResult = resultScales[scaleIdentifier] || resultScales[normalizedScaleId];

  if (!scaleResult) {
    console.log(`Scale ${scaleIdentifier} not found in results`);
    return chartConfig;
  }

  const resultValue = scaleResult.value;
  const cutOffArea = scaleResult.cutOffArea;

  console.log(`Result value: ${resultValue}, Cut-off area: ${cutOffArea}`);

  if (resultValue === undefined) {
    console.log('Result value is undefined, not updating chart');
    return chartConfig;
  }

  const lineSeriesIndex = chartConfig.series.findIndex(series =>
    series.type === 'line' && series.markLine);

  if (lineSeriesIndex === -1) {
    console.log('No line series with markLine found in chart config');
    return chartConfig;
  }

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
  console.log(`Processing multi stacked bar chart for scales:`, scaleIdentifiers);

  const scatterSeriesIndices = chartConfig.series
    .map((series, index) => series.type === 'scatter' ? index : -1)
    .filter(index => index !== -1);

  if (scatterSeriesIndices.length === 0) {
    console.log('No scatter series found in chart config');
    return chartConfig;
  }

  console.log(`Found ${scatterSeriesIndices.length} scatter series for indicators`);

  scatterSeriesIndices.forEach((seriesIndex, idx) => {
    if (idx >= scaleIdentifiers.length) {
      console.log(`No scale identifier for scatter series at index ${idx}`);
      return;
    }

    const scaleId = scaleIdentifiers[idx];
    const scaleResult = resultScales[scaleId] || resultScales[scaleId.toLowerCase()];

    if (!scaleResult) {
      console.log(`Scale ${scaleId} not found in results`);
      return;
    }

    console.log(`Updating scatter indicator for scale ${scaleId} with data:`, scaleResult);

    const resultValue = scaleResult.value;
    const cutOffArea = scaleResult.cutOffArea;

    if (resultValue === undefined) {
      console.log(`No result value for scale ${scaleId}`);
      return;
    }

    const scatterSeries = chartConfig.series[seriesIndex];

    // Update position
    if (scatterSeries.data?.[0]) {
      scatterSeries.data[0][0] = resultValue;
      scatterSeries.data[0][1] = idx;
      console.log(`Updated scatter point position to [${resultValue}, ${idx}]`);
    }

    // Update label
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

  console.log('Multi stacked bar chart processing complete');
  return chartConfig;
}

function processMultiSingleBarChart(chartConfig, resultScales, scaleIdentifiers) {
  console.log(`Processing multi single bar chart for scales:`, scaleIdentifiers);

  if (!chartConfig.series[0]?.data) {
    console.log('Warning: No data found in bar series');
    return chartConfig;
  }

  for (let i = 0; i < Math.min(scaleIdentifiers.length, chartConfig.series[0].data.length); i++) {
    const scaleId = scaleIdentifiers[i];
    const scaleResult = resultScales[scaleId] || resultScales[scaleId.toLowerCase()];

    if (scaleResult?.value !== undefined) {
      const dataIndex = chartConfig.series[0].data.length - 1 - i;
      if (chartConfig.series[0].data[dataIndex]) {
        chartConfig.series[0].data[dataIndex].value = scaleResult.value;
        console.log(`Updated bar at index ${dataIndex} for scale ${scaleId} with value ${scaleResult.value}`);
      }
    } else {
      console.log(`No result found for scale ${scaleId}`);
    }
  }

  console.log('Multi single bar chart processing complete');
  return chartConfig;
}

function processLineChart(chartConfig, resultScales, scaleIdentifier, scaleHistory) {
  console.log(`Processing line chart for scale: ${scaleIdentifier}`);

  if (scaleHistory && scaleHistory.length > 0) {
    console.log(`Found ${scaleHistory.length} historical data points for scale: ${scaleIdentifier}`);

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
          fontFamily: 'Arial'
        }
      };
    }).filter(item => item !== null);

    if (seriesData.length > 0 && chartConfig.series[0]) {
      chartConfig.series[0].data = seriesData;
      console.log(`Updated line chart with ${seriesData.length} historical data points`);
    }
  } else {
    // Fall back to current test result
    console.log(`No historical data found, checking current test result for: ${scaleIdentifier}`);

    if (!resultScales[scaleIdentifier]) {
      console.log(`Scale ${scaleIdentifier} not found in results`);
      return chartConfig;
    }

    const resultValue = resultScales[scaleIdentifier].value;
    const cutOffArea = resultScales[scaleIdentifier].cutOffArea;

    if (resultValue === undefined) {
      console.log('Result value is undefined, not updating chart');
      return chartConfig;
    }

    // Update the most recent data point
    if (chartConfig.series[0]?.data?.length > 0) {
      const lastDataPointIndex = chartConfig.series[0].data.length - 1;
      const lastDataPoint = chartConfig.series[0].data[lastDataPointIndex];

      let labelText = parseFloat(resultValue).toFixed(1);
      if (cutOffArea) labelText += ` (${cutOffArea})`;

      chartConfig.series[0].data[lastDataPointIndex] = {
        value: [lastDataPoint.value[0], resultValue],
        label: {
          show: true,
          formatter: labelText,
          position: 'top',
          fontSize: 10,
          color: '#333',
          fontFamily: 'Arial'
        }
      };

      console.log(`Updated last data point to value: ${resultValue}`);
    }
  }

  console.log('Line chart processing complete');
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
  processChartData
};