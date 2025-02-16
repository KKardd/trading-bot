const {StochasticRSI} = require("technicalindicators");
// StochasticRSI 계산
function calculateStochasticRSI(data, rsiPeriod = 14, stochasticPeriod = 14, kPeriod = 3, dPeriod = 3) {
    const closePrices = data.map((candle) => candle.trade_price).reverse(); // 종가 데이터를 역순으로 정렬

    const stochRSI = StochasticRSI.calculate({
        values: closePrices,
        rsiPeriod: rsiPeriod,
        stochasticPeriod: stochasticPeriod,
        kPeriod: kPeriod,
        dPeriod: dPeriod,
    });

    return stochRSI;
}

function filterStochasticRSI(data) {
    const stochRSIValues = calculateStochasticRSI(data);

    // 최신 데이터의 %K와 %D 값 가져오기
    const latestStochRSI = stochRSIValues[stochRSIValues.length - 1];

    const K = latestStochRSI.k; // 파란색 선 (%K)
    const D = latestStochRSI.d; // 주황색 선 (%D)

    // 조건: %K가 40 미만이고 %K가 %D 위에 있음
    if (K < 20 && K > D) {
        return true;
    } else {
        return false;
    }
}

module.exports = {filterStochasticRSI};
