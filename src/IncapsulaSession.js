const tough = require('tough-cookie');
const fetchCookie = require('fetch-cookie');
const nodeFetch = require('node-fetch');
const {Cookie} = require("tough-cookie");
const ProxyAgent = require('proxy-agent');
const { getDomain } = require('tldjs');
const CaptchaFactory = require('./captcha/CaptchaFactory');
require('./extensions/tough-cookie');
const {objectToURI} = require("./utils/generic");
const cookieJar = new tough.CookieJar("", {ignoreError: true});
const fetch = fetchCookie(nodeFetch, cookieJar);

class IncapsulaSession {
    constructor(apiKey, captcha, configs) {
        this.apiKey = apiKey;
        this.captchaSolver = CaptchaFactory.create(captcha);
        this.configs = configs;
    }

    async request(url, opts) {
        const request = {
            url: url,
            parsedUrl: require('url').parse(url),
            opts: { ...opts, agent: opts.proxy ? new ProxyAgent(opts.proxy) : null }
        }

        const response = await this.doRequestInternal(request);
        return await this.handleRetry(request, response, 3);
    }

    getConfigForSite(url){
        for(const config of this.configs) {
            const a = require('url').parse(config.url);
            const b = require('url').parse(url);
            if (a.hostname === b.hostname){
                return config;
            }
        }
        throw new Error(`No config found for ${url}`)
    }

    async getIncapsulaCookies(targetUrl, proxy) {
        let config = this.getConfigForSite(targetUrl);
        config = {...config, proxy: proxy}
        const apiResponse = await fetch('https://api.yoghurtbot.net/incapsula/cookies/gen', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey
            },
            body: JSON.stringify(config)
        })
        return await apiResponse.json();
    }

    async doRequestInternal(request) {
        //Do request with node-fetch
        const response = await fetch(request.url, request.opts);

        //Handle
        return await this.handleResponseCookies(await this.buildResponse(response));
    }

    async buildResponse(response) {
        return {
            url: response.url,
            redirected: response.redirected,
            status: response.status,
            headers: response.headers.raw(),
            body: await response.text()
        }
    }

    async handleRetry(request, response, retries) {
        return await this.handleRetryInternal(request, response, retries);
    }

    async handleRetryInternal(request, response, retries) {
        //TODO: Add Proxy Rotation

        while(this.isIncapsulaBlocked(response) && retries < 5) {
            if (cookieJar.doesShCookieExist()){
                //TODO: Handle Captcha
                console.log("-> Captcha Detected")
                await this.handleCaptcha(request, response);
            } else {
                console.log("-> Detected block, getting bypass cookies...")
                //Blocked, generate bypass cookies
                const bypassCookies = await this.getIncapsulaCookies(response.redirected ? response.url : request.url, request.opts.proxy);

                const parsedUrl = require('url').parse(response.redirected ? response.url : request.url);
                for(const cookie of bypassCookies.cookies){
                    await cookieJar.setCookie(new Cookie({
                        key: cookie.name,
                        value: cookie.value,
                        domain: cookie.name !== "reese84" ? `${getDomain(parsedUrl.hostname)}` : parsedUrl.hostname,
                        path: '/'
                    }), request.url, {ignoreError:true});
                }
            }
            //Handles edge cases where the redirect is on a different URL
            if (response.redirected) {
                request.opts.method = "GET";
                request.opts.body = null;
                request.url = response.url;
            }
            response = await this.doRequestInternal(request);

            return this.handleRetryInternal(request, response, retries++);
        }

        if (retries >= 5)
            throw new Error("Couldn't solve Incapsula after 5 retries");

        return Promise.resolve(response);
    }

    //TODO: This is incomplete
    async handleCaptcha(request, response) {
        //Follow iFrame to get captcha details
        const url = response.body.split("\"main-iframe\" src=\"")[1].split('"')[0];
        const iFrameResponse = await this.doRequestInternal({
            url: `https://${require('url').parse(request.url).hostname}${url}`,
            opts: request.opts
        })

        //Handle geetest captcha
        if (iFrameResponse.body.includes("geetest_challenge")){
            const challengeParams = iFrameResponse.body.split("SWCNGEEC=")[1].split('"')[0];
            const dai = iFrameResponse.body.split("dai=")[1].split("&")[0];
            const challengeResourceUrl = `${request.parsedUrl.protocol}//${request.parsedUrl.hostname}/_Incapsula_Resource?SWCNGEEC=${challengeParams}`

            //Get challenge details
            const getChallengeResponse = await this.doRequestInternal({
                url: challengeResourceUrl, opts: request.opts
            })
            const challengeData = JSON.parse(getChallengeResponse.body);

            //Solve captcha using captcha solver service
            const result = await this.captchaSolver.solveGee(request.url, challengeData.gt, challengeData.challenge);

            const urlParams = { "SWCGHOEL": "gee", dai: dai, cts: challengeParams }
            const challengeSubmitUrl = `${request.parsedUrl.protocol}//${request.parsedUrl.hostname}/_Incapsula_Resource${objectToURI(urlParams)}`
            const postParams = `geetest_challenge=${result.data.geetest_challenge}&geetest_validate=${result.data.geetest_validate}&geetest_seccode=${result.data.geetest_seccode}`

            //Post captcha response
            await this.request(challengeSubmitUrl, {
                method: "POST",
                headers: {
                    "content-type": "application/x-www-form-urlencoded"
                },
                body: postParams,
                proxy: request.opts.proxy
            })
        } else if (iFrameResponse.body.includes("g-recaptcha")) {
            const dai = iFrameResponse.body.split("dai=")[1].split("&")[0];
            const cts = iFrameResponse.body.split("cts=")[1].split('"')[0];
            const siteKey = iFrameResponse.body.split('data-sitekey="')[0].split('"')[0];

            const result = await this.captchaSolver.solveRecaptcha(request.url, challengeData.siteKey);

        }
    }

    isIncapsulaBlocked(response) {
        if (response.body.includes("Incapsula incident ID") ||
            response.status === 403 ||
            response.body.includes("Get Your Identity Verified") ||
            response.body.toLowerCase().includes("META NAME=\"ROBOTS\" CONTENT=\"NOINDEX, NOFOLLOW\"".toLowerCase()) ||
            response.body.toLowerCase().includes("META NAME=\"robots\" CONTENT=\"noindex,nofollow".toLowerCase())) {
            return true;
        }
        return false;
    }

    async handleResponseCookies(response) {
        //Handle cookies
        const cookieHeader = response.headers['set-cookie'];
        if (cookieHeader) {
            const cookies = cookieHeader.map(Cookie.parse);
            for (const cookie of cookies) {
                cookieJar.setCookieSync(cookie, response.url);
            }
        }
        return response;
    }
}

module.exports = IncapsulaSession;