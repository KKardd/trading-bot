const path = require("path");
require("dotenv").config({path: path.resolve(__dirname, ".env")});
const axios = require("axios");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const {v4: uuidv4} = require("uuid");
const {filterVolume} = require("./calculate-volume");
const {filterHeikinAshi} = require("./calculate-heikinashi");
const {filterEMA} = require("./calculate-ema");
const {filterStochasticRSI} = require("./calculate-stochastic-rsi");
const {delay, formatDateNow, adjustForFee} = require("./util");
const {google} = require("googleapis");
const fs = require("fs");
const querystring = require("querystring").encode;

// 업비트 API 사용 -----------------------------------------------------------------------------
// 업비트 API 키 설정
const ACCESS_KEY = process.env.UPBIT_ACCESS_KEY;
const SECRET_KEY = process.env.UPBIT_SECRET_KEY;
const SERVER_URL = "https://api.upbit.com/v1";

// Google Sheets API 설정
const credentials = JSON.parse(fs.readFileSync("credentials.json"));
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: SCOPES,
});
const sheets = google.sheets({version: "v4", auth});
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
let spreadAppendData = [];

// 시드 설정
let seed = Number(process.env.SEED);
const profitRatio = Number(process.env.PROFIT_RATIO);
const lossRatio = Number(process.env.LOSS_RATIO);

async function appendToSheet(data) {
    try {
        const resource = {
            values: [data],
        };
        sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `A1`, // A1 시작
            valueInputOption: "RAW",
            resource,
        });
        console.log("데이터가 스프레드시트에 성공적으로 추가되었습니다.");
    } catch (error) {
        console.error("Google Sheets에 데이터 추가 중 에러 발생:", error.message);
    }
}

// 업비트 API 요청 함수
async function upbitRequest(endpoint, method = "GET", params = {}, isHash = false, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const query = querystring(params);

            const hash = crypto.createHash("sha512");
            const queryHash = hash.update(query, "utf-8").digest("hex");

            const payload = {
                access_key: ACCESS_KEY,
                nonce: uuidv4(),
                query_hash: queryHash,
                query_hash_alg: "SHA512",
            };

            const jwtToken = jwt.sign(payload, SECRET_KEY);
            const url = `${SERVER_URL}${endpoint}${query ? `?${query}` : ""}`;

            const options = {
                method,
                url,
                headers: {Authorization: `Bearer ${jwtToken}`},
                json: params,
            };

            const response = await axios(options);
            return response.data;
        } catch (error) {
            if (attempt < retries) {
                console.error(`API 요청 실패. 재시도 ${attempt}/${retries} 중...`);
                await delay(1000); // 1초 대기 후 재시도
            } else {
                console.error(`API 요청 중 에러 발생 (최대 시도 초과):`, error.response?.data || error.message);
                throw error; // 최종 실패 시 에러 던짐
            }
        }
    }
}

// 캔들 데이터 가져오기(default = 30분)
async function getCandleData(market, interval = "minutes/30", count = 200) {
    const retries = 3;
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const endpoint = `/candles/${interval}`;
            const options = {
                method: "GET",
                url: `${SERVER_URL}${endpoint}?market=${market}&count=${count}`,
            };
            const response = await axios(options);

            return response.data;
        } catch (error) {
            if (attempt < retries) {
                console.error(`API 요청 실패. 재시도 ${attempt}/${retries} 중...`);
                await delay(1000); // 1초 대기 후 재시도
            } else {
                console.error(`API 요청 중 에러 발생 (최대 시도 초과):`, error.response?.data || error.message);
                throw error; // 최종 실패 시 에러 던짐
            }
        }
    }
}

// 업비트의 모든 코인 리스트 가져오기
async function getAllMarkets() {
    const url = "https://api.upbit.com/v1/market/all";
    try {
        const response = await axios.get(url);
        return response.data.filter((market) => market.market.startsWith("KRW-")).map((market) => market.market);
    } catch (error) {
        console.error("Error fetching market list:", error.message);
        return [];
    }
}

// 조건 만족하는 코인 필터링
async function filterMarket(markets) {
    for (const market of markets) {
        await delay(100);

        const tickerData = await upbitRequest(`/ticker`, "GET", {markets: market});
        const candleData = await getCandleData(market, "minutes/30", 5000);
        if (!tickerData || tickerData.length === 0 || !candleData || candleData.length === 0) {
            console.log(`${market} Step 0 ended`);
            continue;
        }

        // Step 1: 거래대금 조건 필터링
        if (!filterVolume(tickerData, 3000000000)) {
            // min Volume = 30억
            console.log(`${market} Volume ended`);
            continue;
        }

        // Step 2: EMA 조건 필터링
        // if (!filterEMA(candleData)) {
        //     console.log(`${market} EMA200 ended`);
        //     continue;
        // }

        // Step 3: Stochastic RSI 지표 조건 필터링
        if (!filterStochasticRSI(candleData)) {
            console.log(`${market} Stochastic RSI ended`);
            continue;
        }

        // Step 4: 하이캔 아시 캔들 조건 필터링
        if (!filterHeikinAshi(candleData)) {
            console.log(`${market} HeikinAshi ended`);
            continue;
        }
        console.log("매수 성공: ", market);
        return market;
    }
}

// 매수 함수
async function buyMarketOrder(market, amount) {
    try {
        const adjustedAmount = adjustForFee(amount, true); // 매수 수수료 적용
        const response = await upbitRequest("/orders", "POST", {
            market: market,
            side: "bid", // 매수
            ord_type: "price", // 시장가 매수
            price: adjustedAmount, // 매수 금액
        });

        const buyTime = formatDateNow();
        console.log(`매수 성공: ${market}, 금액: ${adjustedAmount}, uuid: ${response.uuid}`);

        spreadAppendData.push(buyTime);

        return response;
    } catch (error) {
        console.error(`매수 실패: ${market}`, error.message);
    }
}

// 매도 함수
async function sellMarketOrder(market, volume) {
    try {
        const response = await upbitRequest("/orders", "POST", {
            market: market,
            side: "ask", // 매도
            volume: volume, // 매도량
            ord_type: "market", // 시장가 매도
        });

        return response;
    } catch (error) {
        console.error(`매도 실패: ${market}`, error.message);
        await delay(1000);
    }
}

// 실시간 가격 모니터링 및 매도 조건 실행
async function monitorAndSell(market, buyPrice, volume) {
    const targetProfit = buyPrice * profitRatio; // 0.5% 익절가
    const stopLoss = buyPrice * lossRatio; // 0.3% 손절가
    const adjustedBuyPrice = adjustForFee(buyPrice, true); // 매수 가격(수수료 반영)
    let sellPrice;
    let sellType;

    let tryCount = 0;
    while (true) {
        try {
            // 현재 가격 가져오기
            const tickerData = await upbitRequest(`/ticker`, "GET", {markets: market});
            const currentPrice = tickerData[0].trade_price * volume;
            const adjustedCurrentPrice = adjustForFee(currentPrice, false); // 현재 가격(수수료 반영)

            const sellTime = formatDateNow();

            if (tryCount % 1000 === 0) {
                console.log(
                    `시도 횟수: ${tryCount}\n매수 가격: ${seed} \n현재 시간: ${formatDateNow()} \n현재 가격: ${adjustedCurrentPrice} \n익절 조건 가격: ${targetProfit} \n손절 조건 가격: ${stopLoss}`
                );
            }

            // 익절 조건
            if (adjustedCurrentPrice >= targetProfit) {
                await sellMarketOrder(market, volume);
                console.log("익절 조건 충족. 매도 완료.");

                sellPrice = adjustedCurrentPrice;
                sellType = "익절";

                spreadAppendData.push(sellTime);
                spreadAppendData.push(adjustedBuyPrice.toFixed(2));

                break;
            }

            // 손절 조건
            if (adjustedCurrentPrice <= stopLoss) {
                await sellMarketOrder(market, volume);
                console.log("손절 조건 충족. 매도 완료.");

                sellPrice = adjustedCurrentPrice;
                sellType = "손절";

                spreadAppendData.push(sellTime);
                spreadAppendData.push(adjustedBuyPrice.toFixed(2));

                break;
            }

            tryCount++;
            // 일정 시간 대기 (1초)
            await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error) {
            console.error("매도 조건 실행 중 에러 발생:", error.message);
            await sellMarketOrder(market, volume);
        }
    }

    spreadAppendData.push(sellPrice.toFixed(2));
    spreadAppendData.push(sellType);
    await appendToSheet(spreadAppendData);
    spreadAppendData = []; // init spreadData

    return sellPrice;
}

async function checkVolume(orderId) {
    const order = await upbitRequest(`/order`, "GET", {
        uuid: orderId,
    });

    let volume = 0;
    for (let i = 0; i < order.trades.length; i++) {
        volume += Number(order.trades[i].volume);
    }

    return volume;
}

// 메인 실행
async function main() {
    const markets = await getAllMarkets();
    console.log(`${formatDateNow()} Fetched ${markets.length} markets.`);

    const market = await filterMarket(markets);
    if (market) {
        spreadAppendData.push(market);
        // 해당 코인 매수
        console.log(`${market} 코인 매수 요청`);

        const boughtMarket = await buyMarketOrder(market, seed);

        await delay(100);
        const myMarketVolume = await checkVolume(boughtMarket.uuid);
        // 매수 후 모니터링 및 매도 조건 실행 / 시드 변경
        const sellRes = await monitorAndSell(market, seed, myMarketVolume);

        seed = Math.floor(Number(sellRes));
        console.log("매도 완료. 다시 실행합니다.");
    }

    await main();
}

// 메인 실행
(async () => {
    await main();
})();
