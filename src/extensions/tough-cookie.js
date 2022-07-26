const tough = require('tough-cookie');

tough.CookieJar.prototype.doesShCookieExist = function() {
    let found = false;
    this.store.getAllCookies((err, cookies) => {
        for(const cookie of cookies){
            if (cookie.key.includes("incap_sh_")) {
                found = true;
            }
        }
    });
    return found;
}
