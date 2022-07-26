const CaptchaSolver = require('./CaptchaSolver');
const fetch = require('node-fetch');
const { objectToURI, delay} = require("../utils/generic");

class TwoCaptcha extends CaptchaSolver {
    constructor(apiKey) {
        super(apiKey);
        this.in = "https://2captcha.com/in.php";
        this.res = "https://2captcha.com/res.php";
    }

    async solveGee(pageUrl, gt, challenge) {
        const payload = {
            key: this.apiKey,
            json: 1,
            method: 'geetest',
            gt: gt,
            challenge: challenge,
            api_server: "api.geetest.com",
            pageurl: pageUrl
        }
        const response = await fetch(`${this.in}${objectToURI(payload)}`)
        const result = await response.text()

        let data;
        try {
            data = JSON.parse(result)
        } catch {
            throw Error(result);
        }

        if (data.status === 1) {
            return this.pollResponse(data.request)
        } else {
            throw new Error(data.request)
        }
    }

    async solveRecaptcha(url, siteKey) {
        const payload = {
            key: this.apiKey,
            invisible: false,
            googlekey: siteKey,
            method: "userrecaptcha",
            pageurl: url,
            json:1
        }
        const response = await fetch(`${this.in}${objectToURI(payload)}`)
        const result = await response.text()

        let data;
        try {
            data = JSON.parse(result)
        } catch {
            throw Error(result);
        }

        if (data.status === 1) {
            return this.pollResponse(data.request)
        } else {
            throw new Error(data.request)
        }
    }

    async pollResponse(id) {
        const payload = {
            key: this.apiKey,
            action: 'get',
            json: 1,
            id: id
        }
        await delay(5000);

        const res = await fetch(this.res + objectToURI(payload))
        const result = await res.text()

        let data;
        try {
            data = JSON.parse(result)
            if (data.status === 1) {
                return { data: data.request, id: id }
            }
        } catch {
            throw new Error(result)
        }
        switch (data.request) {
            case "CAPCHA_NOT_READY": return this.pollResponse(id);
            default: {
                throw new Error(data.request)
            }
        }
    }
}

module.exports = TwoCaptcha;