// 거래대금 조건 필터링
function filterVolume(tickerData, minVolume = 5000000000) {
    const tickerInfo = tickerData[0];
    const tradeAmount = tickerInfo.acc_trade_price_24h;
    if (minVolume <= tradeAmount) {
        return true;
    } else {
        return false;
    }
}

module.exports = {filterVolume};
