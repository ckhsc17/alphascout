"use client";

import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  LineSeries,
} from "lightweight-charts";
import { useEffect, useRef } from "react";

export interface Bar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume_lots: number;
}

function movingAverage(bars: Bar[], period: number) {
  const out: { time: string; value: number }[] = [];
  let sum = 0;
  bars.forEach((b, i) => {
    sum += b.close;
    if (i >= period) sum -= (bars[i - period] as Bar).close;
    if (i >= period - 1) out.push({ time: b.date, value: sum / period });
  });
  return out;
}

/** Candlesticks (Taiwan colors: red up / green down) with 20 / 60-day MAs and volume. */
export function PriceChart({ bars }: { bars: Bar[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const css = getComputedStyle(document.documentElement);
    const color = (name: string) => css.getPropertyValue(name).trim();

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: color("--muted"),
        fontSize: 11,
      },
      grid: { vertLines: { visible: false }, horzLines: { color: color("--border") } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
    });

    const up = color("--up-tw");
    const down = color("--down-tw");
    chart
      .addSeries(CandlestickSeries, {
        upColor: up,
        downColor: down,
        borderUpColor: up,
        borderDownColor: down,
        wickUpColor: up,
        wickDownColor: down,
      })
      .setData(
        bars.map((b) => ({ time: b.date, open: b.open, high: b.high, low: b.low, close: b.close })),
      );

    chart
      .addSeries(LineSeries, {
        color: "#f59e0b",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      })
      .setData(movingAverage(bars, 20));
    chart
      .addSeries(LineSeries, {
        color: "#8b5cf6",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      })
      .setData(movingAverage(bars, 60));

    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });
    volume.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    volume.setData(
      bars.map((b, i) => ({
        time: b.date,
        value: b.volume_lots,
        color: `${b.close >= (bars[i - 1]?.close ?? b.open) ? up : down}66`,
      })),
    );

    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [bars]);

  return (
    <div>
      <div ref={ref} className="h-80 w-full" />
      <p className="mt-2 flex gap-4 text-xs text-muted">
        <span>
          <span className="mr-1 inline-block h-0.5 w-3 bg-[#f59e0b] align-middle" />
          20 日均線
        </span>
        <span>
          <span className="mr-1 inline-block h-0.5 w-3 bg-[#8b5cf6] align-middle" />
          60 日均線
        </span>
      </p>
    </div>
  );
}
