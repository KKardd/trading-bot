function calculateHeikinAshi(candles) {
    const heikinAshiCandles = [];

    candles.forEach((candle, index) => {
        const open = candle.opening_price;
        const high = candle.high_price;
        const low = candle.low_price;
        const close = candle.trade_price;

        const haClose = (open + high + low + close) / 4;
        const prevHaOpen = heikinAshiCandles[index - 1]?.haOpen || open; // 이전 haOpen 또는 기본값 open
        const prevHaClose = heikinAshiCandles[index - 1]?.haClose || close; // 이전 haClose 또는 기본값 close
        const haOpen = (prevHaOpen + prevHaClose) / 2; // 평균값으로 haOpen 계산
        const haHigh = Math.max(high, haOpen, haClose);
        const haLow = Math.min(low, haOpen, haClose);

        heikinAshiCandles.push({
            haOpen,
            haClose,
            haHigh,
            haLow,
            original: candle, // 원래 캔들 데이터 포함
        });
    });

    return heikinAshiCandles;
}

// 하이켄 아시 조건 필터링
function filterHeikinAshi(candles) {
    const heikinAshiCandles = calculateHeikinAshi(candles.reverse());

    if (heikinAshiCandles.length < 3) {
        console.log("Heikin-Ashi 캔들 데이터 부족");
        return false;
    }

    const currentCandle = heikinAshiCandles[heikinAshiCandles.length - 1]; // 현재 캔들 (0)
    const prevCandle = heikinAshiCandles[heikinAshiCandles.length - 2]; // 이전 캔들 (-1)
    const prevPrevCandle = heikinAshiCandles[heikinAshiCandles.length - 3]; // 이전의 이전 캔들 (-2)

    const prevPrevBodySize = Math.abs(prevPrevCandle.haClose - prevPrevCandle.haOpen);
    const prevPrevUpperWick = prevPrevCandle.haHigh - Math.max(prevPrevCandle.haOpen, prevPrevCandle.haClose);
    const prevPrevLowerWick = Math.min(prevPrevCandle.haOpen, prevPrevCandle.haClose) - prevPrevCandle.haLow;

    const isPrevPrevCandleIndecision =
        prevPrevBodySize < (prevPrevCandle.haHigh - prevPrevCandle.haLow) * 0.5 &&
        prevPrevUpperWick > prevPrevBodySize * 1.5 &&
        prevPrevLowerWick > prevPrevBodySize * 1.5; // 몸통이 얇고 양쪽 꼬리가 몸통보다 긺

    const prevBodySize = prevCandle.haClose - prevCandle.haOpen;
    const prevLowerWick = prevCandle.haOpen - prevCandle.haLow;

    const isPrevCandleStrong =
        // prevCandle.haClose > prevCandle.haOpen && // 양봉확인
        prevBodySize > (prevCandle.haHigh - prevCandle.haLow) * 0.3 && // 몸통이 큼
        prevLowerWick < prevBodySize * 0.3; // 아래꼬리가 짧음

    const currentBodySize = currentCandle.haClose - currentCandle.haOpen;
    const currentLowerWick = currentCandle.haOpen - currentCandle.haLow;

    const isCurrentCandleStrong =
        currentCandle.haClose > currentCandle.haOpen && // 양봉 확인
        currentLowerWick < currentBodySize * 0.1; // 아래꼬리가 짧음

    return isPrevPrevCandleIndecision && isPrevCandleStrong && isCurrentCandleStrong;
}

module.exports = {filterHeikinAshi};
