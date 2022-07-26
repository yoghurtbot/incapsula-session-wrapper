const IncapsulaSession = require("./src/IncapsulaSession");
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

(async () => {
    const proxy = "http://yoghurtbot:tDfuZaxexNRTlUST_country-Australia_session-MSbbZ41n@proxy.packetstream.io:31112";

    const session = new IncapsulaSession('xxxx', {
            provider: '2captcha',
            apiKey: 'xxxxxx'
        }, [
            {
                "url": "https://premier.ticketek.com.au",
                "solvers": {
                    "utmvc": true,
                    "reese84": true
                },
                "reese84": {
                    "reeseScriptUrl": "https://premier.ticketek.com.au/u-vnfesse-Giue-Vpon-vulgd-tunaturnes-we-feare-Ra"
                }
            }
    ]);

    while(true) {
        let response;
        response = await session.request('https://premier.ticketek.com.au/', {
            method: 'GET',
            proxy: proxy,
            headers: {
                'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                'accept-language': 'en-GB;q=0.6',
                'cache-control': 'max-age=0',
                'sec-fetch-dest': 'document',
                'sec-fetch-mode': 'navigate',
                'sec-fetch-site': 'same-origin',
                'sec-fetch-user': '?1',
                'sec-gpc': '1',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.5060.53 Safari/537.36'
            }
        });
        console.log("+++ ticketek - Response = [" +response.status+ "] " + (session.isIncapsulaBlocked(response) ? "Blocked!" : "Not Blocked!"))
    }
})();