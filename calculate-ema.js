// EMA 계산
function calculateEMA(data, period = 200) {
    // 데이터를 오래된 순서에서 최신 순서로 뒤집기
    const closePrices = data.map((candle) => candle.trade_price).reverse();
    const multiplier = 2 / (period + 1);

    // 첫 데이터로 초기 EMA 설정
    let ema = closePrices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;
    const emaValues = [ema];

    // 모든 데이터에 대해 EMA 계산
    for (let i = period; i < closePrices.length; i++) {
        ema = (closePrices[i] - ema) * multiplier + ema;
        emaValues.push(ema);
    }

    // 다시 역순으로 뒤집어 최신 데이터가 앞에 오도록 함
    return emaValues.reverse();
}

// EMA 조건 필터링: EMA200선 위에서 근접 시 true
function filterEMA(data, proximityThreshold = 0.035, period = 200) {
    if (!data || data.length === 0) {
        return false;
    }

    // EMA 값 계산
    const emaValues = calculateEMA(data, period);
    if (emaValues.length === 0) {
        return false;
    }

    const latestClose = data[0].low_price; // 최신 종가
    const latestEMA = emaValues[0]; // 최신 EMA 값

    // 종가가 EMA200 위에 있으면서 근접 조건을 만족하는지 확인
    // const difference = Math.abs(latestClose - latestEMA);
    // const proximity = latestEMA * proximityThreshold; // 근접 기준 계산

    // return latestClose >= latestEMA && difference <= proximity;
    return latestClose >= latestEMA;
}

module.exports = {filterEMA};
