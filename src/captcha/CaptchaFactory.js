const TwoCaptcha = require('./2captcha');

class CaptchaFactory {
    create(type) {
        switch(type.provider) {
            case '2captcha':
                return new TwoCaptcha(type.apiKey);
            default:
                throw new Error('Unsupported captcha solver');
        }
    }
}

module.exports = new CaptchaFactory();