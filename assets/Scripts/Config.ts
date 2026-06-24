function isIP(host: string): boolean {
    return /^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(host);
}

const API_HOST = "121.4.62.126";
const wsProto = isIP(API_HOST) ? "ws" : "wss";
const httpProto = isIP(API_HOST) ? "http" : "https";

export const Config = {
    API_HOST,
    CDN_HOST: "crawclaw-1312271570.cos.ap-shanghai.myqcloud.com",
    API_BASE_URL: `${httpProto}://${API_HOST}`,
    WS_LOBBY_URL: `${wsProto}://${API_HOST}/ws/lobby`,
    WS_ROOM_URL: `${wsProto}://${API_HOST}/ws`,
};
