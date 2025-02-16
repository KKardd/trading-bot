// 비동기 대기 함수
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDateNow() {
    const offset = new Date().getTimezoneOffset() * 60000; // UTC와 로컬 시간의 차이를 밀리초로 계산
    const localDate = new Date(Date.now() - offset); // 로컬 시간 계산

    const month = String(localDate.getMonth() + 1).padStart(2, "0"); // 월 (0부터 시작하므로 +1)
    const day = String(localDate.getDate()).padStart(2, "0"); // 일
    const hours = String(localDate.getHours()).padStart(2, "0"); // 시
    const minutes = String(localDate.getMinutes()).padStart(2, "0"); // 분
    const seconds = String(localDate.getSeconds()).padStart(2, "0"); // 초

    return `${month}/${day} ${hours}:${minutes}:${seconds}`;
}

// 업비트 수수료 계산 함수
function calculateFee(amount) {
    const feeRate = 0.0005; // 0.05%
    return amount * feeRate;
}

// 수수료를 적용한 금액 반환 함수
function adjustForFee(amount, isBuy = true) {
    const fee = calculateFee(amount);
    return isBuy ? amount + fee : amount - fee;
}

module.exports = {delay, formatDateNow, adjustForFee};
