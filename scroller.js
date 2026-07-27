const chartRoot = document.querySelector("#chart");
const steps = Array.from(document.querySelectorAll(".step"));

const margin = { top: 48, right: 145, bottom: 92, left: 145 };
const baseRadius = 12;
const expandedRadius = 30;
const highlightKey = "Benigno S. Aquino III-2011";
const neutralDotColor = "#9b9b9b";
const activeDotColor = "#bc4c96";
const calloutStrokeColor = "#000000";
const gridColor = "rgba(22, 22, 22, 0.12)";
const axisColor = "#cccccc";
const axisTextColor = "#cccccc";
const emphasisColor = "#212529";
const marcosCalloutKey = "Ferdinand R. Marcos Jr.-2024";
const aquinoCalloutKey = "Benigno S. Aquino III-2015";
const arroyoAfterCalloutKey = "Gloria Macapagal-Arroyo-2009";
const stepFourAnnotationConfigs = [
  { key: aquinoCalloutKey, side: 1, labelY: -15, labelXOffset: -14 },
  { key: "Rodrigo Roa Duterte-2021", side: -1, labelY: 0, labelYMobile: 25, labelXMobile: 2, labelXOffset: 12 },
  { key: "Gloria Macapagal-Arroyo-2007", side: -1, labelY: 12 },
  { key: marcosCalloutKey, side: 1, labelY: -4, labelYMobile: 22, labelXMobile: 8, leaderLineMobile: true, labelXOffset: -10 },
];
const stepSevenAnnotationConfigs = [
  { key: arroyoAfterCalloutKey, side: 1, labelY: -14, labelXOffset: 12 },
  {
    key: "Fidel V. Ramos-1992",
    side: 1,
    sideMobile: -1,
    labelY: 0,
    labelYMobile: -64,
    labelXOffset: 4,
    labelXMobile: 4,
    firstLineOffset: -6,
    firstLineOffsetMobile: -6,
    secondLineOffset: 8,
    secondLineOffsetMobile: 8,
    leaderLineYOffsetMobile: 12,
    leaderLineMobile: true,
  },
  {
    key: "Joseph Ejercito Estrada-1998",
    side: -1,
    labelY: 0,
    labelXOffset: -10,
    labelXMobile: -5,
    firstLineOffset: -6,
    secondLineOffset: 8,
    leaderLineYOffsetMobile: 4,
    leaderLineMobile: true,
  },
];

function formatNetSatisfaction(value) {
  if (value > 0) {
    return `+${value}%`;
  }

  return `${value}%`;
}

function formatSentimentValue(value) {
  const formattedValue = d3.format(".1f")(value);

  if (value > 0) {
    return `+${formattedValue}`;
  }

  return formattedValue;
}

function getPresidentLastName(name) {
  const parts = name.trim().split(/\s+/);
  const suffix = parts[parts.length - 1];

  if (/^(?:Jr\.?|Sr\.?|I|II|III|IV|V)$/i.test(suffix) && parts.length > 1) {
    return `${parts[parts.length - 2]} ${suffix}`;
  }

  return suffix;
}

function parseNumericCell(value) {
  const trimmedValue = value.trim();

  if (trimmedValue === "") {
    return null;
  }

  const parsedValue = Number(trimmedValue);
  return Number.isNaN(parsedValue) ? null : parsedValue;
}

function linearRegression(data) {
  const xMean = d3.mean(data, (d) => d.netSatisfaction);
  const yMean = d3.mean(data, (d) => d.sentiment);

  let numerator = 0;
  let denominator = 0;

  data.forEach((datum) => {
    const xDiff = datum.netSatisfaction - xMean;
    const yDiff = datum.sentiment - yMean;
    numerator += xDiff * yDiff;
    denominator += xDiff * xDiff;
  });

  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = yMean - slope * xMean;
  return { slope, intercept };
}

function getChartMargin(width) {
  if (width <= 640) {
    return { top: 28, right: 28, bottom: 72, left: 56 };
  }

  if (width <= 960) {
    return { top: 36, right: 72, bottom: 82, left: 72 };
  }

  return margin;
}

function trimOuterGridLines(group) {
  const lines = group.selectAll(".tick line");
  const lastIndex = lines.size() - 1;

  lines
    .filter((_, index) => index === 0 || index === lastIndex)
    .remove();
}

function buildChart() {
  const bounds = chartRoot.getBoundingClientRect();
  const width = Math.max(320, Math.round(bounds.width || 960));
  const height = Math.max(420, Math.round(bounds.height || 720));
  const viewportWidth = window.innerWidth || width;
  const isCompactWidth = Math.min(width, viewportWidth) <= 640;
  const currentMargin = getChartMargin(width);
  const innerWidth = width - currentMargin.left - currentMargin.right;
  const innerHeight = height - currentMargin.top - currentMargin.bottom;

  chartRoot.innerHTML = "";

  const svg = d3
    .select(chartRoot)
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("role", "img")
    .attr("aria-label", "Scatter plot of net satisfaction and sentiment for SONA speeches");

  const plot = svg
    .append("g")
    .attr("transform", `translate(${currentMargin.left},${currentMargin.top})`);

  const defs = svg.append("defs");
  const trendlineClipRect = defs
    .append("clipPath")
    .attr("id", "trendline-clip")
    .append("rect")
    .attr("x", 0)
    .attr("y", -20)
    .attr("width", 0)
    .attr("height", innerHeight + 40);

  const afterTrendlineClipRect = defs
    .append("clipPath")
    .attr("id", "after-trendline-clip")
    .append("rect")
    .attr("x", 0)
    .attr("y", -20)
    .attr("width", 0)
    .attr("height", innerHeight + 40);

  return d3.csv("./csv/data.csv", (row) => {
    const netSatisfaction = parseNumericCell(row.net_satisfaction_before_SONA);
    const netSatisfactionAfter = parseNumericCell(row.net_satisfaction_after_SONA);
    const sentiment = parseNumericCell(row.roberta_weighted_score);

    if (sentiment === null || (netSatisfaction === null && netSatisfactionAfter === null)) {
      return null;
    }

    return {
      president: row.president,
      year: Number(row.year),
      totalWords: Number(row.total_words),
      netSatisfaction,
      netSatisfactionAfter,
      sentiment,
      key: `${row.president}-${row.year}`,
    };
  }).then((rawData) => {
    const data = rawData.filter(Boolean);
    const xExtent = d3.extent(data, (d) => d.netSatisfaction);
    const yExtent = d3.extent(data, (d) => d.sentiment);
    const sizeHighlights = stepFourAnnotationConfigs
      .filter((config) => !(isCompactWidth && config.key === aquinoCalloutKey))
      .map((config) => {
        const datum = data.find((entry) => entry.key === config.key);

        if (!datum) {
          return null;
        }

        return {
          ...datum,
          side: config.side,
          labelY: isCompactWidth && config.labelYMobile !== undefined ? config.labelYMobile : config.labelY,
          labelXOffset: (config.labelXOffset || 0) + (isCompactWidth && config.labelXMobile !== undefined ? config.labelXMobile : 0),
          leaderLineMobile: Boolean(config.leaderLineMobile),
        };
      })
      .filter(Boolean);
    const afterHighlights = stepSevenAnnotationConfigs
      .filter((config) => !(isCompactWidth && config.key === arroyoAfterCalloutKey))
      .map((config) => {
        const datum = data.find((entry) => entry.key === config.key);

        if (!datum || datum.netSatisfactionAfter === null) {
          return null;
        }

        return {
          ...datum,
          side: isCompactWidth && config.sideMobile !== undefined ? config.sideMobile : config.side,
          labelY: isCompactWidth && config.labelYMobile !== undefined ? config.labelYMobile : config.labelY,
          labelXOffset: (config.labelXOffset || 0) + (isCompactWidth && config.labelXMobile !== undefined ? config.labelXMobile : 0),
          firstLineOffset:
            isCompactWidth && config.firstLineOffsetMobile !== undefined
              ? config.firstLineOffsetMobile
              : config.firstLineOffset,
          secondLineOffset:
            isCompactWidth && config.secondLineOffsetMobile !== undefined
              ? config.secondLineOffsetMobile
              : config.secondLineOffset,
          leaderLineYOffset:
            isCompactWidth && config.leaderLineYOffsetMobile !== undefined
              ? config.leaderLineYOffsetMobile
              : config.leaderLineYOffset,
          leaderLineMobile: Boolean(config.leaderLineMobile),
        };
      })
      .filter(Boolean);
    const wordCountFormat = d3.format(",");
    const yMin = Math.floor((Math.min(yExtent[0], 0) - 0.05) * 10) / 10;
    const regression = linearRegression(data);
    const afterData = data
      .filter((d) => d.netSatisfactionAfter !== null)
      .map((d) => ({ ...d, netSatisfaction: d.netSatisfactionAfter }));
    const regressionAfter = linearRegression(afterData);
    const yTickStart = Math.ceil(yMin * 2) / 2;
    const yTickValues = d3.range(yTickStart, 1.01, 0.5).filter((value) => value <= 1);

    const xScale = d3
      .scaleLinear()
      .domain([Math.floor(xExtent[0] - 5), Math.ceil(xExtent[1] + 5)])
      .range([0, innerWidth])
      .nice();

    const xAxisTickCount = isCompactWidth ? 3 : width <= 960 ? 5 : Math.min(8, innerWidth / 90);
    const xGridTickCount = isCompactWidth ? 5 : xAxisTickCount;
    const xAxisTickValues = xScale.ticks(xAxisTickCount);
    const xGridTickValues = xScale.ticks(xGridTickCount);

    const yScale = d3
      .scaleLinear()
      .domain([yMin, 1])
      .range([innerHeight, 0]);

    const sizeScale = d3
      .scaleSqrt()
      .domain(d3.extent(data, (d) => d.totalWords))
      .range([baseRadius, expandedRadius]);

    const xGrid = d3.axisBottom(xScale).tickValues(xGridTickValues).tickSize(-innerHeight).tickFormat("");
    const yGrid = d3.axisLeft(yScale).tickValues(yTickValues).tickSize(-innerWidth).tickFormat("");

    plot
      .append("g")
      .attr("class", "grid grid-x")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(xGrid)
      .call((group) => group.selectAll("line").attr("stroke", gridColor))
      .call(trimOuterGridLines)
      .call((group) => group.select(".domain").remove());

    plot
      .append("g")
      .attr("class", "grid grid-y")
      .call(yGrid)
      .call((group) => group.selectAll("line").attr("stroke", gridColor))
      .call(trimOuterGridLines)
      .call((group) => group.select(".domain").remove());

    const xAxis = plot
      .append("g")
      .attr("class", "axis axis-x")
      .attr("transform", `translate(0,${innerHeight})`)
      .call(
        d3
          .axisBottom(xScale)
          .tickValues(xAxisTickValues)
          .tickSize(0)
          .tickFormat((value) => formatNetSatisfaction(value))
      )
      .call((group) => group.selectAll("text").attr("fill", axisTextColor).attr("font-size", 13))
      .call((group) => group.select(".domain").remove());

    const yAxis = plot
      .append("g")
      .attr("class", "axis axis-y")
      .call(
        d3
          .axisLeft(yScale)
          .tickValues(yTickValues)
          .tickSize(0)
          .tickFormat((value) => formatSentimentValue(value))
      )
      .call((group) => group.selectAll("text").attr("fill", axisTextColor).attr("font-size", 13))
      .call((group) => group.select(".domain").remove());

    // Restore only the requested full grid lines.
    const customGridLines = plot.append("g").attr("class", "custom-grid-lines");

    customGridLines
      .append("line")
      .attr("x1", xScale(-60))
      .attr("x2", xScale(-60))
      .attr("y1", 0)
      .attr("y2", innerHeight)
      .attr("stroke", gridColor)
      .attr("stroke-width", 1);

    customGridLines
      .append("line")
      .attr("x1", xScale(80))
      .attr("x2", xScale(80))
      .attr("y1", 0)
      .attr("y2", innerHeight)
      .attr("stroke", gridColor)
      .attr("stroke-width", 1);

    customGridLines
      .append("line")
      .attr("x1", 0)
      .attr("x2", innerWidth)
      .attr("y1", yScale(1))
      .attr("y2", yScale(1))
      .attr("stroke", gridColor)
      .attr("stroke-width", 1);

    const zeroSentimentLine = plot
      .append("line")
      .attr("class", "zero-line zero-line-y")
      .attr("x1", 0)
      .attr("x2", innerWidth)
      .attr("y1", yScale(0))
      .attr("y2", yScale(0))
      .attr("stroke", axisColor)
      .attr("stroke-width", 1.2)
      .attr("opacity", 0);

    const zeroSatisfactionLine = plot
      .append("line")
      .attr("class", "zero-line zero-line-x")
      .attr("x1", xScale(0))
      .attr("x2", xScale(0))
      .attr("y1", 0)
      .attr("y2", innerHeight)
      .attr("stroke", axisColor)
      .attr("stroke-width", 1.2)
      .attr("opacity", 0);

    plot
      .append("text")
      .attr("x", innerWidth / 2)
      .attr("y", innerHeight + 55)
      .attr("text-anchor", "middle")
      .attr("fill", axisTextColor)
      .attr("font-size", 13)
      .text("Net satisfaction");

    plot
      .append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -innerHeight / 2)
      .attr("y", -58)
      .attr("text-anchor", "middle")
      .attr("fill", axisTextColor)
      .attr("font-size", 13)
      .text("Sentiment");

    const dots = plot
      .append("g")
      .attr("class", "dots")
      .selectAll("circle")
      .data(data, (d) => d.key)
      .join("circle")
      .attr("cx", (d) => xScale(d.netSatisfaction ?? d.netSatisfactionAfter))
      .attr("cy", (d) => yScale(d.sentiment))
      .attr("r", baseRadius)
      .attr("fill", neutralDotColor)
      .attr("fill-opacity", (d) => (d.netSatisfaction === null ? 0 : 0.82))
      .attr("stroke", "transparent")
      .attr("stroke-width", 0);

    const highlightedDatum = data.find((d) => d.key === highlightKey) || data[0];

    const annotation = plot
      .append("g")
      .attr("class", "annotation")
      .style("opacity", 0)
      .attr(
        "transform",
        `translate(${xScale(highlightedDatum.netSatisfaction)},${yScale(highlightedDatum.sentiment)})`
      );

    annotation
      .append("text")
      .attr("x", isCompactWidth ? -(baseRadius + 7) : baseRadius + 7)
      .attr("y", 4)
      .attr("text-anchor", isCompactWidth ? "end" : "start")
      .attr("fill", emphasisColor)
      .attr("font-size", 14)
      .each(function appendMixedWeightLabel() {
        const text = d3.select(this);
        text.append("tspan").attr("font-weight", 700).text("Benigno Aquino");
        text.append("tspan").attr("font-weight", 400).text(", 2011");
      });

    const sizeAnnotationGroup = plot
      .append("g")
      .attr("class", "size-annotations")
      .style("opacity", 0);

    const sizeAnnotations = sizeAnnotationGroup
      .selectAll("g")
      .data(sizeHighlights)
      .join("g")
      .attr("transform", (d) => `translate(${xScale(d.netSatisfaction)},${yScale(d.sentiment)})`);

    const marcosLeaderLines = sizeAnnotations
      .filter((d) => isCompactWidth && d.leaderLineMobile && d.key === marcosCalloutKey)
      .append("line")
      .attr("x1", (d) => d.side * (sizeScale(d.totalWords) + 7) + d.labelXOffset)
      .attr("y1", (d) => d.labelY - 3)
      .attr("x2", 0)
      .attr("y2", 0)
      .attr("stroke", emphasisColor)
      .attr("stroke-width", 1);

    sizeAnnotations
      .append("text")
      .attr("x", (d) => d.side * (sizeScale(d.totalWords) + 7) + d.labelXOffset)
      .attr("y", (d) => d.labelY)
      .attr("text-anchor", (d) => (d.side < 0 ? "end" : "start"))
      .attr("fill", emphasisColor)
      .attr("font-size", 14)
      .attr("font-weight", 600)
      .text((d) => getPresidentLastName(d.president));

    sizeAnnotations
      .append("text")
      .attr("x", (d) => d.side * (sizeScale(d.totalWords) + 7) + d.labelXOffset)
      .attr("y", (d) => d.labelY + 15)
      .attr("text-anchor", (d) => (d.side < 0 ? "end" : "start"))
      .attr("fill", "rgba(22, 22, 22, 0.7)")
      .attr("font-size", 13)
      .text((d) => d.year);

    const sentimentAnnotationGroup = plot
      .append("g")
      .attr("class", "sentiment-annotations")
      .style("opacity", 0);

    sentimentAnnotationGroup
      .append("text")
      .attr("x", 25)
      .attr("y", yScale(0) - 7)
      .attr("text-anchor", "start")
      .attr("fill", emphasisColor)
      .attr("font-size", 14)
      .text("Positive sentiment");

    sentimentAnnotationGroup
      .append("text")
      .attr("x", 25)
      .attr("y", yScale(0) + 19)
      .attr("text-anchor", "start")
      .attr("fill", emphasisColor)
      .attr("font-size", 14)
      .text("Negative sentiment");

    const satisfactionAnnotationGroup = plot
      .append("g")
      .attr("class", "satisfaction-annotations")
      .style("opacity", 0);

    const afterAnnotationGroup = plot
      .append("g")
      .attr("class", "after-annotations")
      .style("opacity", 0);

    const afterAnnotations = afterAnnotationGroup
      .selectAll("g")
      .data(afterHighlights)
      .join("g")
      .attr(
        "transform",
        (d) => `translate(${xScale(d.netSatisfactionAfter)},${yScale(d.sentiment)})`
      );

    afterAnnotations
      .filter((d) => isCompactWidth && d.leaderLineMobile)
      .append("line")
      .attr("x1", (d) => d.side * (baseRadius + 8) + d.labelXOffset)
      .attr("y1", (d) => d.labelY + (d.leaderLineYOffset ?? ((d.firstLineOffset ?? 0) + (d.secondLineOffset ?? 15)) / 2))
      .attr("x2", 0)
      .attr("y2", 0)
      .attr("stroke", emphasisColor)
      .attr("stroke-width", 1);

    afterAnnotations
      .append("text")
      .attr("x", (d) => d.side * (baseRadius + 8) + d.labelXOffset)
      .attr("y", (d) => d.labelY + (d.firstLineOffset ?? 0))
      .attr("text-anchor", (d) => (d.side < 0 ? "end" : "start"))
      .attr("fill", emphasisColor)
      .attr("font-size", 14)
      .attr("font-weight", 600)
      .text((d) => getPresidentLastName(d.president));

    afterAnnotations
      .append("text")
      .attr("x", (d) => d.side * (baseRadius + 8) + d.labelXOffset)
      .attr("y", (d) => d.labelY + (d.secondLineOffset ?? 15))
      .attr("text-anchor", (d) => (d.side < 0 ? "end" : "start"))
      .attr("fill", "rgba(22, 22, 22, 0.7)")
      .attr("font-size", 13)
      .text((d) => d.year);

    if (isCompactWidth) {
      const spacingFromZeroLine = 7;
      const secondWordBaselineY = innerHeight - 12;
      const firstWordBaselineY = secondWordBaselineY - 15;
      const leftLabel = satisfactionAnnotationGroup
        .append("text")
        .attr("x", xScale(0) - spacingFromZeroLine)
        .attr("text-anchor", "end")
        .attr("fill", emphasisColor)
        .attr("font-size", 14);

      leftLabel
        .append("tspan")
        .attr("x", xScale(0) - spacingFromZeroLine)
        .attr("y", firstWordBaselineY)
        .text("Net");
      leftLabel
        .append("tspan")
        .attr("x", xScale(0) - spacingFromZeroLine)
        .attr("y", secondWordBaselineY)
        .text("dissatisfied");

      const rightLabel = satisfactionAnnotationGroup
        .append("text")
        .attr("x", xScale(0) + spacingFromZeroLine)
        .attr("text-anchor", "start")
        .attr("fill", emphasisColor)
        .attr("font-size", 14);

      rightLabel
        .append("tspan")
        .attr("x", xScale(0) + spacingFromZeroLine)
        .attr("y", firstWordBaselineY)
        .text("Net");
      rightLabel
        .append("tspan")
        .attr("x", xScale(0) + spacingFromZeroLine)
        .attr("y", secondWordBaselineY)
        .text("satisfied");
    } else {
      satisfactionAnnotationGroup
        .append("text")
        .attr("x", xScale(0) - 7)
        .attr("y", 22)
        .attr("text-anchor", "end")
        .attr("fill", emphasisColor)
        .attr("font-size", 14)
        .text("Net dissatisfied");

      satisfactionAnnotationGroup
        .append("text")
        .attr("x", xScale(0) + 7)
        .attr("y", 22)
        .attr("text-anchor", "start")
        .attr("fill", emphasisColor)
        .attr("font-size", 14)
        .text("Net satisfied");
    }

    const trendLineData = xScale.domain().map((xValue) => ({
      x: xValue,
      y: regression.slope * xValue + regression.intercept,
    }));

    const trendLineMidX = (xScale.domain()[0] + xScale.domain()[1]) / 2;
    const trendLineMidY = yScale(regression.slope * trendLineMidX + regression.intercept);
    const trendLabelDomainX =
      xScale.domain()[0] + (xScale.domain()[1] - xScale.domain()[0]) * 0.3;
    const trendLabelX = xScale(trendLabelDomainX);
    const trendLabelY = yScale(regression.slope * trendLabelDomainX + regression.intercept) - 12;

    const trendLine = plot
      .append("path")
      .datum(trendLineData)
      .attr("class", "trend-line")
      .attr("fill", "none")
      .attr("stroke", emphasisColor)
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "8 6")
      .attr("clip-path", "url(#trendline-clip)")
      .attr(
        "d",
        d3
          .line()
          .x((d) => xScale(d.x))
          .y((d) => yScale(d.y))
      );

    const trendlineLabel = plot
      .append("text")
      .attr("class", "trendline-label")
      .attr("x", trendLabelX)
      .attr("y", trendLabelY)
      .attr("text-anchor", "middle")
      .attr("fill", emphasisColor)
      .attr("font-size", 14)
      .attr("font-weight", 700)
      .attr("stroke", "white")
      .attr("stroke-width", 4)
      .attr("paint-order", "stroke fill")
      .style("opacity", 0)
      .text("Trendline");

    const afterTrendLineData = xScale.domain().map((xValue) => ({
      x: xValue,
      y: regressionAfter.slope * xValue + regressionAfter.intercept,
    }));
    const afterTrendLineMidX = (xScale.domain()[0] + xScale.domain()[1]) / 2;
    const afterTrendLineMidY = yScale(
      regressionAfter.slope * afterTrendLineMidX + regressionAfter.intercept
    );
    const afterTrendLabelDomainX =
      xScale.domain()[0] + (xScale.domain()[1] - xScale.domain()[0]) * 0.3;
    const afterTrendLabelX = xScale(afterTrendLabelDomainX);
    const afterTrendLabelY =
      yScale(regressionAfter.slope * afterTrendLabelDomainX + regressionAfter.intercept) - 12;

    const afterTrendLine = plot
      .append("path")
      .datum(afterTrendLineData)
      .attr("class", "after-trend-line")
      .attr("fill", "none")
      .attr("stroke", emphasisColor)
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "8 6")
      .attr("clip-path", "url(#after-trendline-clip)")
      .attr(
        "d",
        d3
          .line()
          .x((d) => xScale(d.x))
          .y((d) => yScale(d.y))
      );

    const afterTrendlineLabel = plot
      .append("text")
      .attr("class", "after-trendline-label")
      .attr("x", afterTrendLabelX)
      .attr("y", afterTrendLabelY)
      .attr("text-anchor", "middle")
      .attr("fill", emphasisColor)
      .attr("font-size", 14)
      .attr("font-weight", 700)
      .attr("stroke", "white")
      .attr("stroke-width", 4)
      .attr("paint-order", "stroke fill")
      .style("opacity", 0)
      .text("Trendline");

    function setAxisZeroState(axisGroup, orientation, isActive) {
      axisGroup.selectAll(".tick text").attr("font-weight", 400).attr("fill", axisTextColor);

      const zeroTick = axisGroup
        .selectAll(".tick")
        .filter((value) => value === 0 || value === "0" || value === 0.0);

      zeroTick
        .select("text")
        .attr("font-weight", isActive ? 700 : 400)
        .attr("fill", isActive ? emphasisColor : axisTextColor);

      if (orientation === "y") {
        zeroSentimentLine
          .attr("opacity", isActive ? 1 : 0)
          .attr("stroke-width", isActive ? 2.4 : 1.2)
          .attr("stroke", isActive ? emphasisColor : axisColor);
      }

      if (orientation === "x") {
        zeroSatisfactionLine
          .attr("opacity", isActive ? 1 : 0)
          .attr("stroke-width", isActive ? 2.4 : 1.2)
          .attr("stroke", isActive ? emphasisColor : axisColor);
      }
    }

    function updateStep(stepIndex) {
      const transition = svg.transition().duration(700).ease(d3.easeCubicOut);
      const showSentimentZero = stepIndex === 3;
      const showSatisfactionZero = stepIndex === 4;
      const showTrendLine = stepIndex === 5;
      const useAfterPositions = stepIndex === 6 || stepIndex === 7;
      const showAfterTrendline = stepIndex === 7;
      const showAfterCallouts = stepIndex === 7;
      const useNeutralDots = stepIndex === 0 || showSentimentZero || showSatisfactionZero;

      setAxisZeroState(yAxis, "y", showSentimentZero);
      setAxisZeroState(xAxis, "x", showSatisfactionZero);

      dots
        .transition(transition)
        .attr("cx", (d) => {
          if (useAfterPositions && d.netSatisfactionAfter !== null) {
            return xScale(d.netSatisfactionAfter);
          }

          return xScale(d.netSatisfaction ?? d.netSatisfactionAfter);
        })
        .attr("fill-opacity", (d) => {
          if (useAfterPositions) {
            return d.netSatisfactionAfter === null ? 0 : 0.82;
          }

          return d.netSatisfaction === null ? 0 : 0.82;
        })
        .attr("fill", useAfterPositions ? "#003f5c" : useNeutralDots ? neutralDotColor : activeDotColor)
        .attr("r", baseRadius)
        .attr("stroke", (d) => {
          if (stepIndex === 2 && d.key === highlightedDatum.key) {
            return calloutStrokeColor;
          }

          if (stepIndex === 5 && sizeHighlights.some((highlight) => highlight.key === d.key)) {
            return calloutStrokeColor;
          }

          if (stepIndex === 7 && afterHighlights.some((highlight) => highlight.key === d.key)) {
            return calloutStrokeColor;
          }

          return "transparent";
        })
        .attr("stroke-width", (d) => {
          if (stepIndex === 2 && d.key === highlightedDatum.key) {
            return 2;
          }

          if (stepIndex === 5 && sizeHighlights.some((highlight) => highlight.key === d.key)) {
            return 2;
          }

          if (stepIndex === 7 && afterHighlights.some((highlight) => highlight.key === d.key)) {
            return 2;
          }

          return 0;
        });

      annotation
        .transition(transition)
        .style("opacity", stepIndex === 2 ? 1 : 0);

      sizeAnnotationGroup
        .transition(transition)
        .style("opacity", stepIndex === 5 ? 1 : 0);

      sentimentAnnotationGroup
        .transition(transition)
        .style("opacity", stepIndex === 3 ? 1 : 0);

      satisfactionAnnotationGroup
        .transition(transition)
        .style("opacity", stepIndex === 4 ? 1 : 0);

      afterAnnotationGroup
        .transition(transition)
        .style("opacity", showAfterCallouts ? 1 : 0);

      if (showTrendLine) {
        trendlineClipRect
          .interrupt()
          .attr("width", 0)
          .transition(transition)
          .attr("width", innerWidth);
      } else {
        trendlineClipRect.interrupt().attr("width", 0);
      }

      trendlineLabel
        .transition(transition)
        .style("opacity", showTrendLine ? 1 : 0);

      if (showAfterTrendline) {
        afterTrendlineClipRect
          .interrupt()
          .attr("width", 0)
          .transition(transition)
          .attr("width", innerWidth);
      } else {
        afterTrendlineClipRect.interrupt().attr("width", 0);
      }

      afterTrendlineLabel
        .transition(transition)
        .style("opacity", showAfterTrendline ? 1 : 0);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          const stepIndex = Number(entry.target.dataset.step);
          steps.forEach((step) => step.classList.toggle("is-active", step === entry.target));
          updateStep(stepIndex);
        });
      },
      {
        threshold: 0.6,
        rootMargin: "0px 0px -10% 0px",
      }
    );

    steps.forEach((step) => observer.observe(step));

    const activeStep = document.querySelector(".step.is-active");
    const initialStepIndex = activeStep ? Number(activeStep.dataset.step) : 0;
    updateStep(initialStepIndex);
  });
}

buildChart();

window.addEventListener("resize", () => {
  clearTimeout(window.__sonaResizeTimer);
  window.__sonaResizeTimer = setTimeout(buildChart, 150);
});